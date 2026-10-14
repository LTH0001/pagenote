import { _electron as electron } from '@playwright/test';
import assert from 'node:assert/strict';
import path from 'node:path';
import fs from 'node:fs/promises';
const root = path.resolve(import.meta.dirname, '..');
const userData = path.join(root, 'tests', 'desktop-data');
await fs.mkdir(userData, { recursive: true });
const executable =
  process.env.DESKTOP_EXE ||
  path.join(root, 'release', 'win-unpacked', '页伴.exe');
const app = await electron.launch({
  executablePath: executable,
  env: { ...process.env, PAGE_NOTES_USER_DATA: userData },
  timeout: 40000,
});
try {
  const page = await app.firstWindow();
  await page.waitForSelector('#fileInput', { state: 'attached' });
  await page
    .locator('#fileInput')
    .setInputFiles(path.join(root, 'tests', 'fixtures', 'sample.pdf'));
  await page.waitForFunction(
    () => document.querySelector('#pageCount').textContent === '/ 3',
  );
  await page.locator('#loading').waitFor({ state: 'hidden' });
  const oldWidth = await page
    .locator('#pdfCanvas')
    .evaluate((e) => e.getBoundingClientRect().width);
  const oldPage = await page.locator('#pageNumber').inputValue();
  await page.mouse.move(300, 350);
  await page.keyboard.down('Control');
  await page.mouse.wheel(0, -120);
  await page.keyboard.up('Control');
  await page.waitForFunction(
    (w) =>
      document.querySelector('#pdfCanvas').getBoundingClientRect().width > w,
    oldWidth,
  );
  assert.equal(
    await page.locator('#pageNumber').inputValue(),
    oldPage,
    'Ctrl wheel must not turn pages',
  );
  assert.equal(await page.locator('#zoomLabel').textContent(), '110%');
  const enlarged = await page
    .locator('#pdfCanvas')
    .evaluate((e) => e.getBoundingClientRect().width);
  await page.keyboard.down('Control');
  await page.mouse.wheel(0, 120);
  await page.keyboard.up('Control');
  await page.waitForFunction(
    (w) =>
      document.querySelector('#pdfCanvas').getBoundingClientRect().width < w,
    enlarged,
  );
  await page.locator('[data-mode="edit"]').click();
  await page
    .locator('#editor')
    .fill(
      '# 桌面版验证\n\nCtrl + 鼠标滚轮可以放大课件，也可以放大右侧的笔记和公式。\n\n$$\\hat\\mu=\\frac1N\\sum_i x_i$$',
    );
  await page.locator('[data-mode="read"]').click();
  const font = await page
    .locator('#preview')
    .evaluate((e) => parseFloat(getComputedStyle(e).fontSize));
  await page.mouse.move(1100, 350);
  await page.keyboard.down('Control');
  await page.mouse.wheel(0, -120);
  await page.keyboard.up('Control');
  assert.ok(
    (await page
      .locator('#preview')
      .evaluate((e) => parseFloat(getComputedStyle(e).fontSize))) > font,
    'note font grows',
  );
  assert.equal(await page.locator('#preview .katex').count(), 1);
  assert.equal(
    await app.evaluate(({ BrowserWindow }) =>
      BrowserWindow.getAllWindows()[0].webContents.getZoomFactor(),
    ),
    1,
    'toolbar is not browser-zoomed',
  );
  await page.locator('#next').click();
  await page.waitForFunction(
    () => document.querySelector('#pageNumber').value === '2',
  );
  await page.locator('#prev').click();
  await page.waitForFunction(
    () => document.querySelector('#pageNumber').value === '1',
  );
  assert.ok(
    (await page.locator('#editor').inputValue()).includes('桌面版验证'),
  );
  await page.screenshot({
    path: path.join(root, 'tests', 'desktop-preview.png'),
  });
  // Exercise Word and PowerPoint conversion from inside the packaged application.
  for (const [file, count] of [
    ['sample.docx', 2],
    ['sample.pptx', 3],
  ]) {
    await page
      .locator('#fileInput')
      .setInputFiles(path.join(root, 'tests', 'fixtures', file));
    await page.waitForFunction(
      (ext) =>
        document.querySelector('#documentType').textContent.startsWith(ext),
      path.extname(file).slice(1).toUpperCase(),
      { timeout: 130000 },
    );
    await page
      .locator('#loading')
      .waitFor({ state: 'hidden', timeout: 130000 });
    assert.equal(await page.locator('#pageCount').textContent(), '/ ' + count);
  }
  console.log(
    'PASS desktop: native executable, PDF/DOCX/PPTX, Ctrl-wheel document and note zoom, no page turn, fixed toolbar, notes persistence.',
  );
} finally {
  await app.close();
}
