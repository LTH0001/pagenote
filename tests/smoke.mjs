import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import path from 'node:path';
import fs from 'node:fs/promises';
const root = path.resolve(import.meta.dirname, '..');
const browser = await chromium.launch({
  executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  headless: true,
});
const context = await browser.newContext({
  viewport: { width: 1440, height: 960 },
  acceptDownloads: true,
});
const page = await context.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
try {
  const prior = await (
    await fetch('http://127.0.0.1:4173/api/documents')
  ).json();
  const fixture = prior.find((d) => d.name === 'sample.pdf');
  if (fixture)
    await fetch(`http://127.0.0.1:4173/api/documents/${fixture.id}/notes/2`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ markdown: '' }),
    });
  await page.goto('http://127.0.0.1:4173');
  await page
    .locator('#fileInput')
    .setInputFiles(path.join(root, 'tests/fixtures/sample.pdf'));
  await page.waitForFunction(
    () => document.querySelector('#pageCount').textContent === '/ 3',
  );
  await page.waitForFunction(
    () => document.querySelector('#pdfCanvas').width > 0,
  );
  await page.locator('#loading').waitFor({ state: 'hidden' });
  await page.locator('[data-mode="edit"]').click();
  const first =
    '# Page one\n\nInline $\\mu=18$.\n\n\\[\\hat\\mu=\\frac1N\\sum_{i=1}^N x_i\\]\n\n|Method|Result|\n|---|---|\n|MLE|18|\n\n<script>window.bad=true</script>';
  await page.locator('#editor').fill(first);
  await page.locator('[data-mode="read"]').click();
  assert.equal(
    await page.locator('#preview .katex').count(),
    2,
    'LaTeX rendered',
  );
  assert.equal(await page.locator('#preview table').count(), 1);
  assert.equal(
    await page.evaluate(() => window.bad),
    undefined,
    'Markdown HTML sanitized',
  );
  await page.locator('#next').click();
  await page.waitForFunction(
    () => document.querySelector('#pageNumber').value === '2',
  );
  assert.equal(
    await page.locator('#editor').inputValue(),
    '',
    'page 2 independent',
  );
  await page.locator('[data-mode="edit"]').click();
  await page
    .locator('#editor')
    .fill('# Page two\n\n' + 'Long explanation.\n\n'.repeat(150));
  await page.locator('#prev').click();
  await page.waitForFunction(
    () => document.querySelector('#pageNumber').value === '1',
  );
  assert.equal(
    await page.locator('#editor').inputValue(),
    first,
    'rapid navigation saves previous page',
  );
  await page.reload();
  await page.waitForFunction(
    () => document.querySelector('#pageCount').textContent === '/ 3',
  );
  assert.equal(
    await page.locator('#editor').inputValue(),
    first,
    'notes survive reload',
  );
  await page.locator('[data-mode="split"]').click();
  await page.screenshot({
    path: path.join(root, 'tests/preview-pdf.png'),
    fullPage: true,
  });
  await page
    .locator('#attachmentInput')
    .setInputFiles(path.join(root, 'tests/fixtures/sample.pdf'));
  await page.waitForSelector('#preview iframe.embed-pdf');
  await page
    .locator('#attachmentInput')
    .setInputFiles(path.join(root, 'tests/fixtures/sample.md'));
  await page.waitForSelector('#preview .markdown-embed .katex');
  await page
    .locator('#fileInput')
    .setInputFiles(path.join(root, 'tests/fixtures/sample.md'));
  await page.waitForFunction(() =>
    document.querySelector('#documentType').textContent.startsWith('MD'),
  );
  assert.equal(
    await page.locator('#pageCount').textContent(),
    '/ 2',
    'Markdown page splitting',
  );
  assert.equal(await page.locator('#markdownDocument .katex').count(), 2);
  await page.locator('#next').click();
  await page.waitForFunction(
    () => document.querySelector('#pageNumber').value === '2',
  );
  assert.equal(await page.locator('#markdownDocument table').count(), 1);
  for (const [file, count] of [
    ['sample.docx', 2],
    ['sample.pptx', 3],
  ]) {
    await page
      .locator('#fileInput')
      .setInputFiles(path.join(root, 'tests/fixtures', file));
    await page.waitForFunction(
      (ext) =>
        document.querySelector('#documentType').textContent.startsWith(ext),
      path.extname(file).slice(1).toUpperCase(),
      { timeout: 130000 },
    );
    assert.equal(
      await page.locator('#pageCount').textContent(),
      '/ ' + count,
      `${file} original pagination`,
    );
    await page.waitForFunction(
      () => document.querySelector('#pdfCanvas').width > 0,
    );
    await page
      .locator('#loading')
      .waitFor({ state: 'hidden', timeout: 130000 });
    await page.screenshot({
      path: path.join(root, 'tests/preview-' + file + '.png'),
      fullPage: true,
    });
  }
  assert.deepEqual(errors, [], 'No browser errors');
  const docs = await (
    await fetch('http://127.0.0.1:4173/api/documents')
  ).json();
  const sample = docs.find((d) => d.name === 'sample.pdf');
  await page.locator('#library').selectOption(sample.id);
  await page.waitForFunction(
    () => document.querySelector('#docName').textContent === 'sample.pdf',
  );
  await page.locator('#loading').waitFor({ state: 'hidden' });
  await page.locator('[data-mode="edit"]').click();
  await page
    .locator('#editor')
    .fill(
      '# 概率密度函数的估计\n\n每一页课件，都有一份独立的完整讲解。左侧翻页时，这份笔记会自动切换。\n\n## 从数据中估计分布\n\n假设样本服从正态分布 $x \\sim \\mathcal N(\\mu,\\sigma^2)$，参数估计把未知密度的估计转化为均值和方差的估计。\n\n$$\\hat\\mu=\\frac{1}{N}\\sum_{i=1}^{N}x_i$$\n\n$$\\hat\\sigma^2=\\frac{1}{N}\\sum_{i=1}^{N}(x_i-\\hat\\mu)^2$$\n\n> 样本均值决定曲线的中心，方差决定曲线的宽窄。\n\n| 方法 | 核心思想 |\n| --- | --- |\n| 最大似然估计 | 寻找最能解释观测样本的参数 |\n| 贝叶斯估计 | 用数据更新对参数的先验认识 |\n\n## 不止一页的讲解\n\n右侧是一份可以持续向下书写的 Markdown 文档。长推导、例题、图片和补充资料，都可以放在同一页笔记里。',
    );
  await page.locator('[data-mode="read"]').click();
  assert.equal(
    await page.locator('#preview h1').textContent(),
    '概率密度函数的估计',
  );
  await page.waitForTimeout(700);
  await page.screenshot({
    path: path.join(root, 'tests/preview-ready.png'),
    fullPage: true,
  });
  await fs.writeFile(
    path.join(root, 'tests/results.json'),
    JSON.stringify(
      {
        ok: true,
        checks: [
          'PDF rendering',
          'isolated per-page notes',
          'save on navigation',
          'reload persistence',
          'Markdown tables',
          'KaTeX formulas',
          'HTML sanitization',
          'PDF embed',
          'Markdown embed',
          'Markdown pagination',
          'Word pagination',
          'PowerPoint pagination',
        ],
      },
      null,
      2,
    ),
  );
  console.log(
    'PASS: PDF, DOCX, PPTX, Markdown; formulas; attachments; independent notes; navigation; reload.',
  );
} finally {
  await browser.close();
}
