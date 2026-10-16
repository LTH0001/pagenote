import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';
import { randomUUID, createHash } from 'node:crypto';
import { test } from 'node:test';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const root = path.resolve(import.meta.dirname, '..');
const require = createRequire(import.meta.url);
const { createMacOffice } = require('../desktop/mac-office.cjs');
const sha = (bytes) => createHash('sha256').update(bytes).digest('hex');
await fs.mkdir(path.join(root, 'tmp'), { recursive: true });

test(
  'conversion refuses output aliases that overwrite the source',
  {
    skip: process.platform !== 'darwin',
    timeout: 60000,
  },
  async () => {
    const data = await fs.mkdtemp(
      path.join(root, 'tmp', 'mac-office-alias-test-'),
    );
    const file = path.join(data, 'preserved.docx');
    const alias = `${data}-alias`;
    await fs.copyFile(path.join(root, 'tests/fixtures/sample.docx'), file);
    await fs.symlink(data, alias, 'dir');
    const before = sha(await fs.readFile(file));
    try {
      const office = createMacOffice({ data });
      await assert.rejects(
        office.convert(file, path.join(alias, 'preserved.docx')),
        /覆盖|overwrite/,
      );
      assert.equal(sha(await fs.readFile(file)), before);
    } finally {
      await fs.unlink(alias);
    }
  },
);

test(
  'replacement rejects stale full text even when the target quote is unchanged',
  { skip: process.platform !== 'darwin', timeout: 90000 },
  async () => {
    const data = await fs.mkdtemp(
      path.join(root, 'tmp', 'mac-office-revision-test-'),
    );
    const file = path.join(data, `PN-${randomUUID()}-revision.docx`);
    await fs.copyFile(path.join(root, 'tests/fixtures/sample.docx'), file);
    const office = createMacOffice({ data });
    try {
      const before = await office.readWord(file);
      const updated = await office.replaceWord(file, {
        search: 'parsing',
        replacement: 'PARSED!',
        expectedText: before.text,
      });
      assert.ok(updated.text.includes('Feature'));
      const start = before.text.indexOf('Feature');
      assert.equal(
        updated.text.indexOf('Feature'),
        start,
        'the quote and its offset remain unchanged',
      );
      await assert.rejects(
        office.replaceWord(file, {
          search: 'Feature',
          replacement: 'unsafe stale edit',
          start,
          expectedText: before.text,
        }),
        /内容已变化|revision/,
      );
      assert.equal((await office.readWord(file)).text, updated.text);
      const accepted = await office.replaceWord(file, {
        search: 'Feature',
        replacement: 'Verified feature',
        start,
        expectedText: updated.text,
      });
      assert.ok(accepted.text.includes('Verified feature'));
    } finally {
      await office.closeWord(file, { save: false });
    }
  },
);

test(
  'real Mac Office preserves sources and targets only its own documents',
  {
    skip: process.platform !== 'darwin',
    timeout: 240000,
  },
  async () => {
    assert.equal(typeof createMacOffice, 'function');
    const data = await fs.mkdtemp(path.join(root, 'tmp', 'mac-office-test-'));
    const office = createMacOffice({ data });
    const sibling = createMacOffice({ data });
    const token = `PN-${randomUUID()}`;
    const file = path.join(data, `${token}-中文 ' quoted.docx`);
    const other = path.join(data, `${token}-unrelated.docx`);
    const presentation = path.join(data, `${token}.pptx`);
    await fs.copyFile(path.join(root, 'tests/fixtures/sample.docx'), file);
    await fs.copyFile(file, other);
    await fs.copyFile(
      path.join(root, 'tests/fixtures/sample.pptx'),
      presentation,
    );
    const original = sha(await fs.readFile(file));
    const originalPpt = sha(await fs.readFile(presentation));
    try {
      assert.equal((await office.statusWord(file)).alive, false);
      const [first, unrelated] = await Promise.all([
        office.readWord(file),
        sibling.readWord(other),
      ]);
      assert.ok(
        first.text.includes('Feature'),
        'reads table content from real Word',
      );
      assert.ok(
        first.text.includes('\r'),
        'keeps native Word paragraph offsets',
      );
      assert.equal(first.pages, 2);
      assert.equal(first.alive, true);
      assert.equal(first.saved, true);
      assert.equal(first.rangeStart, 0);
      assert.equal(
        first.rangeEnd,
        first.text.length,
        'public offsets address the returned raw text',
      );
      const search = 'Feature';
      const replacement = `功能 😀 "quoted" \\ ${token}`;
      const start = first.text.indexOf(search);
      await assert.rejects(
        office.replaceWord(file, {
          search: 'page',
          replacement: 'unsafe duplicate',
        }),
        /多处|start/,
      );
      await assert.rejects(
        office.replaceWord(file, {
          search,
          replacement,
          start: start + 1,
        }),
        /原文|match|变化|range/i,
      );
      assert.equal((await office.readWord(file)).text, first.text);
      const changed = await office.replaceWord(file, {
        search,
        replacement,
        start,
      });
      assert.ok(changed.text.includes(replacement));
      assert.ok(!changed.text.includes(search));
      const tailChanged = await office.replaceWord(file, {
        search: 'Independent',
        replacement: '独立笔记',
        start: changed.text.indexOf('Independent'),
      });
      assert.ok(
        tailChanged.text.includes('独立笔记 notes must follow this page.'),
        'replacement maps offsets past tables and emoji',
      );
      const uniqueChanged = await office.replaceWord(file, {
        search: 'parsing',
        replacement: 'parsing verified',
      });
      assert.ok(
        uniqueChanged.text.startsWith('Document parsing verified test'),
      );
      assert.equal((await sibling.readWord(other)).text, unrelated.text);
      await office.selectionWord(file);
      await promisify(execFile)(
        '/usr/bin/osascript',
        [
          '-e',
          `tell application id "com.microsoft.Word"
      set documentEnd to end of content of text object of active document
      set selection start of selection to documentEnd - 29
      set selection end of selection to documentEnd - 1
    end tell`,
        ],
        { timeout: 10000 },
      );
      const selection = await office.selectionWord(file);
      assert.equal(selection.text, 'notes must follow this page.');
      assert.equal(
        selection.start,
        uniqueChanged.text.indexOf('notes must follow this page.'),
      );
      assert.equal(selection.end, selection.start + 28);
      assert.ok(selection.page >= 1);
      assert.equal((await office.saveWord(file)).saved, true);
      const saved = sha(await fs.readFile(file));
      assert.notEqual(saved, original, 'save writes actual source file');
      const livePdf = path.join(data, 'live.pdf');
      await office.exportWord(file, livePdf);
      assert.equal(
        (await office.statusWord(file)).alive,
        true,
        'export leaves editor open',
      );
      assert.equal(
        sha(await fs.readFile(file)),
        saved,
        'PDF export preserves docx format',
      );
      const converted = path.join(data, 'converted.pdf');
      const slides = path.join(data, 'slides.pdf');
      await Promise.all([
        office.convert(file, converted),
        sibling.convert(presentation, slides),
      ]);
      assert.equal(
        (await office.statusWord(other)).alive,
        true,
        'conversion preserves unrelated document',
      );
      assert.equal(sha(await fs.readFile(file)), saved);
      assert.equal(sha(await fs.readFile(presentation)), originalPpt);
      for (const pdf of [livePdf, converted, slides]) {
        const bytes = await fs.readFile(pdf);
        assert.equal(bytes.subarray(0, 5).toString(), '%PDF-');
        assert.ok(bytes.length > 1000);
      }
      const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
      for (const [pdf, pages] of [
        [livePdf, 2],
        [converted, 2],
        [slides, 3],
      ]) {
        const loading = pdfjs.getDocument({
          data: new Uint8Array(await fs.readFile(pdf)),
        });
        const pdfDoc = await loading.promise;
        assert.equal(pdfDoc.numPages, pages);
        await loading.destroy();
      }
      await office.closeWord(file, { save: true });
      assert.equal((await office.statusWord(file)).alive, false);
      assert.equal(
        (await office.closeWord(file, { save: false })).alive,
        false,
      );
      assert.equal((await office.statusWord(other)).alive, true);
      console.log(`Real Office evidence: ${data}`);
    } finally {
      await office.closeWord(file, { save: false }).catch(() => {});
      await sibling.closeWord(other, { save: false }).catch(() => {});
    }
  },
);

test(
  'native automation failures explain the required macOS permission',
  {
    skip: process.platform !== 'darwin',
    timeout: 30000,
  },
  async () => {
    const data = await fs.mkdtemp(
      path.join(root, 'tmp', 'mac-office-denial-test-'),
    );
    const scriptPath = path.join(data, 'denied.applescript');
    await fs.writeFile(
      scriptPath,
      'error "Not authorized to send Apple events" number -1743\n',
    );
    const office = createMacOffice({ data, scriptPath });
    await assert.rejects(
      office.statusWord(path.join(data, 'not-open.docx')),
      /隐私与安全性.*自动化/,
    );
  },
);

test(
  'native automation timeouts fail without quitting Office',
  {
    skip: process.platform !== 'darwin',
    timeout: 30000,
  },
  async () => {
    const data = await fs.mkdtemp(
      path.join(root, 'tmp', 'mac-office-timeout-test-'),
    );
    const before = await promisify(execFile)('/usr/bin/osascript', [
      '-e',
      'application id "com.microsoft.Word" is running',
    ]);
    const scriptPath = path.join(data, 'timeout.applescript');
    await fs.writeFile(scriptPath, 'delay 5\n');
    const office = createMacOffice({ data, scriptPath, timeoutMs: 200 });
    await assert.rejects(
      office.statusWord(path.join(data, 'not-open.docx')),
      /操作超时/,
    );
    const { stdout } = await promisify(execFile)('/usr/bin/osascript', [
      '-e',
      'application id "com.microsoft.Word" is running',
    ]);
    assert.equal(stdout.trim(), before.stdout.trim());
  },
);
