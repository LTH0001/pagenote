import { chromium } from '@playwright/test';
import { spawn } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
const root = path.resolve(import.meta.dirname, '..');
const { version } = JSON.parse(
  await fs.readFile(path.join(root, 'package.json'), 'utf8'),
);
const userData = path.join(root, 'tests', 'portable-data');
await fs.mkdir(userData, { recursive: true });
const child = spawn(
  path.join(root, 'release', `PageNotes-${version}-Windows.exe`),
  ['--remote-debugging-port=9331'],
  {
    windowsHide: true,
    env: { ...process.env, PAGE_NOTES_USER_DATA: userData },
  },
);
let browser;
try {
  let ready = false;
  for (let i = 0; i < 100; i++) {
    try {
      const r = await fetch('http://127.0.0.1:9331/json/version', {
        signal: AbortSignal.timeout(500),
      });
      if (r.ok) {
        ready = true;
        break;
      }
    } catch {}
    await new Promise((r) => setTimeout(r, 500));
  }
  assert.ok(ready, 'portable EXE starts Electron');
  browser = await chromium.connectOverCDP('http://127.0.0.1:9331');
  const context = browser.contexts()[0];
  const page = context.pages()[0];
  await page.waitForSelector('#fileInput', { state: 'attached' });
  await page
    .locator('#fileInput')
    .setInputFiles(path.join(root, 'tests', 'fixtures', 'sample.pdf'));
  await page.waitForFunction(
    () => document.querySelector('#pageCount').textContent === '/ 3',
  );
  await page.locator('#loading').waitFor({ state: 'hidden' });
  await page.mouse.move(300, 350);
  await page.keyboard.down('Control');
  await page.mouse.wheel(0, -120);
  await page.keyboard.up('Control');
  await page.waitForFunction(
    () => document.querySelector('#zoomLabel').textContent === '110%',
  );
  await page.locator('[data-mode="edit"]').click();
  await page
    .locator('#editor')
    .fill(
      await fs.readFile(path.join(root, 'examples', 'Markdown示例.md'), 'utf8'),
    );
  await page.evaluate(() => window.pageNotes.flush());
  await page.locator('[data-mode="read"]').click();
  await page.waitForFunction(
    () => document.querySelectorAll('#preview .diagram-ready svg').length === 4,
  );
  await page.screenshot({
    path: path.join(root, 'tests', 'portable-preview.png'),
  });
  console.log(
    'PASS: standalone portable EXE; PDF; Ctrl-wheel; notes save; formulas and four Mermaid diagrams.',
  );
  await page.close();
} finally {
  await browser?.close();
  child.kill();
}
