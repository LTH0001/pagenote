import { _electron as electron } from '@playwright/test';
import fs from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';
import assert from 'node:assert/strict';
const root = path.resolve(import.meta.dirname, '..'),
  folder = path.join(root, 'tests', `word-prototype-${Date.now()}`);
await fs.mkdir(folder, { recursive: true });
const file = path.join(folder, 'working.docx');
await fs.copyFile(path.join(root, 'tests/fixtures/sample.docx'), file);
const app = await electron.launch({
  args: [root],
  env: { ...process.env, PAGE_NOTES_USER_DATA: folder },
  timeout: 40000,
});
const host = spawn(
  'powershell.exe',
  [
    '-STA',
    '-NoProfile',
    '-NonInteractive',
    '-ExecutionPolicy',
    'Bypass',
    '-File',
    path.join(root, 'desktop/word-host.ps1'),
  ],
  { windowsHide: true },
);
let buffer = '',
  sequence = 0;
const pending = new Map();
host.stdout.on('data', (chunk) => {
  buffer += chunk;
  let index;
  while ((index = buffer.indexOf('\n')) >= 0) {
    const line = buffer.slice(0, index).trim();
    buffer = buffer.slice(index + 1);
    if (line.startsWith('PAGE_NOTES_WORD ')) {
      const response = JSON.parse(line.slice(16));
      const task = pending.get(response.cid);
      pending.delete(response.cid);
      response.error
        ? task?.reject(Error(response.error))
        : task?.resolve(response.value);
    }
  }
});
host.stderr.on('data', (b) => process.stderr.write(b));
function call(action, extra = {}) {
  const cid = ++sequence;
  return new Promise((resolve, reject) => {
    pending.set(cid, { resolve, reject });
    host.stdin.write(JSON.stringify({ cid, action, ...extra }) + '\n');
  });
}
try {
  const w = await app.firstWindow();
  await w.waitForFunction(() => !!window.pageNotes);
  const parent = await app.evaluate(({ BrowserWindow }) =>
    BrowserWindow.getAllWindows()[0]
      .getNativeWindowHandle()
      .readBigUInt64LE()
      .toString(),
  );
  const result = await call('open', {
    file,
    parent,
    rect: { x: 0, y: 140, width: 1200, height: 650 },
  });
  assert.equal(result.parent, parent);
  assert.ok(result.text.length);
  console.log(JSON.stringify(result));
  await w.waitForTimeout(1500);
  console.log(await call('read'));
  await call('save');
  await call('close', { save: true });
  console.log('PASS embedded Word parent, document text, save and close');
} finally {
  host.stdin.end();
  await app.close();
}
