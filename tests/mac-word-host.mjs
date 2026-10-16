import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
let createMacWordHost;
try {
  ({ createMacWordHost } = require('../desktop/mac-word.cjs'));
} catch (error) {
  assert.fail(`Mac Word session host is unavailable: ${error.message}`);
}
const data = await fs.mkdtemp(path.join(os.tmpdir(), 'pagenote-word-host-'));
const id = 'a'.repeat(64);
const dir = path.join(data, 'documents', id);
const original = path.join(dir, 'original.docx');
const metaFile = path.join(dir, 'meta.json');
const revision = (text) => createHash('sha256').update(text).digest('hex');
let alive = false;
let failExport = false;
let duringExport;
const office = {
  async readWord(file) {
    alive = true;
    const text = await fs.readFile(file, 'utf8');
    return {
      text,
      rangeStart: 0,
      rangeEnd: text.length,
      pages: 2,
      saved: true,
      alive,
    };
  },
  async saveWord(file) {
    return this.readWord(file);
  },
  async replaceWord(file, { search, replacement, start }) {
    const text = await fs.readFile(file, 'utf8');
    const offset = start ?? text.indexOf(search);
    if (text.slice(offset, offset + search.length) !== search)
      throw Error('range changed');
    await fs.writeFile(
      file,
      text.slice(0, offset) + replacement + text.slice(offset + search.length),
    );
    return this.readWord(file);
  },
  async statusWord() {
    return { alive, saved: true };
  },
  async closeWord() {
    alive = false;
    return { closed: true };
  },
  async selectionWord() {
    return { text: 'Heading', start: 0, end: 7, page: 1 };
  },
  async exportWord(file, output) {
    if (failExport) throw Error('PDF export failed');
    if (duringExport) await duringExport();
    await fs.writeFile(
      output,
      '%PDF-1.4\n' + (await fs.readFile(file, 'utf8')),
    );
  },
  async convert(file, output) {
    return this.exportWord(file, output);
  },
};

try {
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(original, 'Heading\rBody and table\u0007');
  await fs.writeFile(path.join(dir, 'view.pdf'), '%PDF-old');
  await fs.writeFile(
    metaFile,
    JSON.stringify({ id, ext: '.docx', name: '中文 notes.docx', kind: 'pdf' }),
  );
  const host = createMacWordHost({ data, office });
  const opened = await host.call('open', { documentId: id });
  assert.equal(opened.embedded, false);
  assert.equal(host.active, id);
  assert.equal(host.captureKind, 'pdf');
  assert.equal(opened.revision, revision('Heading\rBody and table\u0007'));
  await assert.rejects(
    host.call('replace', {
      search: 'Heading',
      replacement: 'Changed',
      expectedRevision: 'stale',
    }),
    /变化|revision/,
  );
  await assert.rejects(
    host.call('replace', {
      search: 'table\u0007',
      replacement: 'broken',
      expectedRevision: opened.revision,
    }),
    /表格/,
  );
  const changed = await host.call('replace', {
    search: 'Heading',
    replacement: '中文 heading',
    expectedRevision: opened.revision,
    start: 0,
  });
  assert.equal(changed.text, '中文 heading\rBody and table\u0007');
  const captured = await host.call('export-preview');
  assert.ok(captured.url.includes('edit-session-'));
  assert.equal(
    await fs.readFile(path.join(dir, 'view.pdf'), 'utf8'),
    '%PDF-old',
    'uncommitted captures do not replace the saved preview',
  );
  assert.equal(
    await fs.readFile(original, 'utf8'),
    'Heading\rBody and table\u0007',
    'working edit does not prematurely replace source',
  );
  failExport = true;
  await assert.rejects(host.call('close', { save: true }), /PDF export failed/);
  assert.equal(host.active, id, 'failed export retains recoverable session');
  assert.equal(
    await fs.readFile(original, 'utf8'),
    'Heading\rBody and table\u0007',
  );
  failExport = false;
  await fs.unlink(path.join(dir, 'view.pdf'));
  await fs.mkdir(path.join(dir, 'view.pdf'));
  await assert.rejects(host.call('close', { save: true }));
  assert.equal(host.active, id);
  await fs.rmdir(path.join(dir, 'view.pdf'));
  const saved = await host.call('close', { save: true });
  assert.equal(saved.saved, true);
  assert.equal(host.active, undefined);
  assert.equal(await fs.readFile(original, 'utf8'), changed.text);
  assert.ok(
    (await fs.readFile(path.join(dir, 'view.pdf'), 'utf8')).includes(
      '中文 heading',
    ),
  );
  assert.ok(JSON.parse(await fs.readFile(metaFile, 'utf8')).modified);
  const history = await fs.readdir(path.join(dir, 'source-history'));
  assert.ok(history.length >= 1);
  assert.ok(
    (
      await Promise.all(
        history.map((f) =>
          fs.readFile(path.join(dir, 'source-history', f), 'utf8'),
        ),
      )
    ).includes('Heading\rBody and table\u0007'),
  );

  const reopened = await host.call('open', { documentId: id });
  await host.call('replace', {
    search: 'heading',
    replacement: 'draft',
    expectedRevision: reopened.revision,
  });
  await fs.writeFile(original, 'User changed original concurrently');
  await assert.rejects(host.call('close', { save: true }), /变化|冲突|修改/);
  assert.equal(
    await fs.readFile(original, 'utf8'),
    'User changed original concurrently',
  );
  assert.equal(host.active, id);
  await host.call('close', { save: false });
  assert.equal(
    await fs.readFile(original, 'utf8'),
    'User changed original concurrently',
  );
  await host.call('open', { documentId: id });
  duringExport = () =>
    fs.writeFile(original, 'User edited while PDF was exporting');
  await assert.rejects(host.call('close', { save: true }), /变化|冲突|修改/);
  assert.equal(
    await fs.readFile(original, 'utf8'),
    'User edited while PDF was exporting',
  );
  assert.equal(host.active, id);
  duringExport = undefined;
  await host.call('close', { save: false });
  const projectRoot = path.join(data, 'project');
  await fs.mkdir(path.join(projectRoot, 'src'), { recursive: true });
  const projectFile = path.join(projectRoot, 'project.pagenote');
  await fs.writeFile(projectFile, JSON.stringify({ left: 'src/source.docx' }));
  await fs.writeFile(
    path.join(projectRoot, 'src/source.docx'),
    'New external project source',
  );
  await fs.writeFile(
    metaFile,
    JSON.stringify({ id, ext: '.docx', kind: 'pdf', projectFile, projectRoot }),
  );
  await assert.rejects(host.call('open', { documentId: id }), /刷新|变化|修改/);
  assert.equal(
    host.active,
    undefined,
    'outdated project cache cannot start a Word session',
  );
  assert.equal(
    await fs.readFile(path.join(projectRoot, 'src/source.docx'), 'utf8'),
    'New external project source',
  );
  await fs.copyFile(original, path.join(projectRoot, 'src/source.docx'));
  await host.call('open', { documentId: id });
  const projectRead = await host.call('read');
  await host.call('replace', {
    search: 'User edited',
    replacement: 'Persisted project',
    expectedRevision: projectRead.revision,
  });
  await fs.mkdir(path.join(projectRoot, 'src/view.pdf'));
  await assert.rejects(host.call('close', { save: true }));
  assert.equal(
    host.active,
    id,
    'project write failure retains a retryable session',
  );
  await fs.rmdir(path.join(projectRoot, 'src/view.pdf'));
  const committed = await host.call('close', { save: true });
  assert.equal(committed.projectPersisted, true);
  assert.ok(
    (
      await fs.readFile(path.join(projectRoot, 'src/source.docx'), 'utf8')
    ).startsWith('Persisted project'),
  );
  assert.ok(
    (
      await fs.readFile(path.join(projectRoot, 'src/view.pdf'), 'utf8')
    ).includes('Persisted project'),
  );
  await host.call('open', { documentId: id });
  await fs.writeFile(
    path.join(projectRoot, 'src/other.docx'),
    'Other linked source',
  );
  await fs.writeFile(projectFile, JSON.stringify({ left: 'src/other.docx' }));
  await assert.rejects(host.call('close', { save: true }), /变化|冲突|修改/);
  assert.equal(
    await fs.readFile(path.join(projectRoot, 'src/other.docx'), 'utf8'),
    'Other linked source',
  );
  await host.call('close', { save: false });
  await assert.rejects(host.call('open', { documentId: '../escape' }), /无效/);
  console.log(
    'PASS Mac Word working-copy commit, revisions, table guards, failed export recovery, source conflicts, preview and history.',
  );
} finally {
  await fs.rm(data, { recursive: true, force: true });
}
