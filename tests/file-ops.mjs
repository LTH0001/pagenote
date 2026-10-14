import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const sharedFs = require('node:fs/promises');
const { moveFile, copyFileSafe } = require('../desktop/file-ops.cjs');
const folder = path.join(import.meta.dirname, 'file-ops-data-' + Date.now());
await fs.mkdir(folder);
const source = path.join(folder, 'new.tmp');
const destination = path.join(folder, 'notes.json');
await fs.writeFile(source, 'new');
await fs.writeFile(destination, 'old');
await moveFile(source, destination);
assert.equal(await fs.readFile(destination, 'utf8'), 'new');
const rename = sharedFs.rename,
  copyFile = sharedFs.copyFile;
try {
  sharedFs.rename = async () => {
    const e = Error('EXDEV');
    e.code = 'EXDEV';
    throw e;
  };
  await fs.writeFile(source, 'updated');
  await moveFile(source, destination);
  assert.equal(await fs.readFile(destination, 'utf8'), 'updated');
  assert.deepEqual(await fs.readdir(folder), ['notes.json']);
  await fs.writeFile(source, 'failed replacement');
  sharedFs.copyFile = async (from, to, ...args) => {
    if (from === source) {
      await fs.writeFile(to, 'partial');
      const e = Error('Simulated copy failure');
      e.code = 'EIO';
      throw e;
    }
    return copyFile(from, to, ...args);
  };
  await assert.rejects(moveFile(source, destination), /Recovery copy/);
  assert.equal(await fs.readFile(destination, 'utf8'), 'updated');
  assert.equal(await fs.readFile(source, 'utf8'), 'failed replacement');
  const backup = (await fs.readdir(folder)).find((name) =>
    name.includes('.replace-backup-'),
  );
  assert.equal(await fs.readFile(path.join(folder, backup), 'utf8'), 'updated');
} finally {
  sharedFs.rename = rename;
  sharedFs.copyFile = copyFile;
}
console.log(
  'PASS normal file replacement, EXDEV fallback and failed-copy restoration retain recovery data.',
);
const streamed = path.join(folder, 'streamed.bin');
try {
  sharedFs.copyFile = async () => {
    const error = Error('Simulated encrypted-file CopyFile failure');
    error.code = 'UNKNOWN';
    throw error;
  };
  await copyFileSafe(source, streamed);
  assert.deepEqual(await fs.readFile(streamed), await fs.readFile(source));
} finally {
  sharedFs.copyFile = copyFile;
}
console.log(
  'PASS readable encrypted-file copy fallback preserves exact bytes.',
);
