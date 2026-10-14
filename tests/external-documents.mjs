import express from 'express';
import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import { registerExternalDocuments } from '../external-documents.mjs';
const data = path.join(import.meta.dirname, 'external-data-' + Date.now()),
  app = express(),
  opened = [];
const projects = {
  sourceFile: async (value) =>
    value.projectRoot
      ? path.join(value.projectRoot, 'src', 'left' + value.ext)
      : path.join(data, 'documents', value.id, 'original' + value.ext),
  open: async (file) => JSON.parse(await fs.readFile(file, 'utf8')),
};
app.use(express.json());
registerExternalDocuments({
  app,
  data,
  projects,
  desktop: () => async (action, args) => {
    assert.equal(action, 'open-external');
    opened.push(args.filePath);
  },
  convertOffice: async (input, output) =>
    fs.writeFile(output, 'converted:' + (await fs.readFile(input, 'utf8'))),
});
app.use((error, req, res, next) =>
  res.status(400).json({ error: error.message }),
);
const server = app.listen(0, '127.0.0.1');
await new Promise((resolve) => server.once('listening', resolve));
const api = async (id, action) => {
  const response = await fetch(
    `http://127.0.0.1:${server.address().port}/api/documents/${id}/${action}`,
    { method: 'POST' },
  );
  return { ok: response.ok, ...(await response.json()) };
};
try {
  for (const [index, ext] of ['.pdf', '.docx', '.pptx'].entries()) {
    const id = String(index + 1).repeat(64),
      directory = path.join(data, 'documents', id),
      value = { id, ext, kind: 'pdf' };
    await fs.mkdir(directory, { recursive: true });
    await fs.writeFile(
      path.join(directory, 'meta.json'),
      JSON.stringify(value),
    );
    await fs.writeFile(path.join(directory, 'original' + ext), 'original');
    await fs.writeFile(path.join(directory, 'notes.json'), 'preserve notes');
    assert.ok((await api(id, 'open-external')).opened);
    assert.equal(opened.at(-1), path.join(directory, 'original' + ext));
    assert.equal((await api(id, 'refresh-external')).changed, false);
    await fs.writeFile(opened.at(-1), 'saved in default app');
    const result = await api(id, 'refresh-external');
    assert.ok(result.changed);
    assert.equal(result.document.id, id);
    assert.equal(
      await fs.readFile(path.join(directory, 'notes.json'), 'utf8'),
      'preserve notes',
    );
    assert.equal(
      await fs.readFile(path.join(directory, 'view.pdf'), 'utf8'),
      ext === '.pdf'
        ? 'saved in default app'
        : 'converted:saved in default app',
    );
    assert.equal((await api(id, 'refresh-external')).changed, false);
    assert.equal(
      (await fs.readdir(path.join(directory, 'source-history'))).length,
      1,
    );
  }
  assert.equal((await api('invalid', 'open-external')).ok, false);
  console.log(
    'PASS PDF/Word/PPT default-app routing, save refresh, unchanged-file skip, source backup, note preservation and invalid-ID rejection.',
  );
} finally {
  await new Promise((resolve) => server.close(resolve));
}
