import { _electron as electron } from '@playwright/test';
import assert from 'node:assert/strict';
import path from 'node:path';
import fs from 'node:fs/promises';
import net from 'node:net';
const root = path.resolve(import.meta.dirname, '..');
const userData = path.join(root, 'tests', 'markdown-data');
await fs.mkdir(userData, { recursive: true });
const executable =
  process.env.DESKTOP_EXE ||
  path.join(
    root,
    process.platform === 'darwin'
      ? 'node_modules/electron/dist/Electron.app/Contents/MacOS/Electron'
      : 'node_modules/electron/dist/electron.exe',
  );
const args = [root];
const occupier = net.createServer();
await new Promise((resolve, reject) => {
  occupier.once('error', (e) =>
    e.code === 'EADDRINUSE' ? resolve() : reject(e),
  );
  occupier.listen(4174, '127.0.0.1', resolve);
});
const app = await electron.launch({
  executablePath: executable,
  args,
  env: { ...process.env, PAGE_NOTES_USER_DATA: userData },
  timeout: 40000,
});
try {
  const page = await app.firstWindow();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.waitForSelector('#fileInput', { state: 'attached' });
  assert.notEqual(
    new URL(page.url()).port,
    '4174',
    'desktop starts on a free port when 4174 is occupied',
  );
  await page
    .locator('#fileInput')
    .setInputFiles(path.join(root, 'tests', 'fixtures', 'sample.pdf'));
  await page.waitForFunction(
    () => document.querySelector('#pageCount').textContent === '/ 3',
  );
  await page.locator('#loading').waitFor({ state: 'hidden' });
  await page.locator('#pageNumber').fill('1');
  await page.locator('#pageNumber').dispatchEvent('change');
  const text = await fs.readFile(
    path.join(root, 'examples', 'Markdown示例.md'),
    'utf8',
  );
  await page.locator('[data-mode="edit"]').click();
  await page.locator('#editor').fill(text);
  await page.locator('[data-mode="read"]').click();
  await page.waitForFunction(
    () => document.querySelectorAll('#preview .diagram-ready svg').length === 4,
    null,
    { timeout: 45000 },
  );
  assert.equal(await page.locator('#preview .diagram-error').count(), 0);
  assert.equal(
    await page.locator('#preview .katex').count(),
    4,
    'inline, block and chat formulas',
  );
  assert.equal(await page.locator('#preview table').count(), 1);
  assert.equal(
    await page.locator('#preview input[type="checkbox"]').count(),
    2,
  );
  assert.ok(
    (await page.locator('#preview .hljs .hljs-number').count()) > 0,
    'code highlighted',
  );
  assert.equal(await page.locator('#preview del').count(), 1);
  await page.screenshot({
    path: path.join(root, 'tests', 'markdown-check.png'),
  });
  assert.ok(
    (
      await page.locator('#preview .mermaid-diagram').first().textContent()
    ).includes('收集训练样本'),
  );
  const png = await page.locator('#pdfCanvas').screenshot();
  await app.evaluate(async ({ clipboard, ClipboardItem }, base64) => {
    globalThis.markdownTestClipboard = await clipboard.read();
    await clipboard.write([
      new ClipboardItem({
        'image/png': new Blob([Buffer.from(base64, 'base64')], {
          type: 'image/png',
        }),
      }),
    ]);
  }, png.toString('base64'));
  await page.locator('[data-mode="edit"]').click();
  await page.locator('#editor').focus();
  await page.locator('#editor').press('Control+End');
  await page.locator('#editor').press('Control+V');
  await page.waitForFunction(() => {
    const im = document.querySelector('#preview img');
    return im && im.complete && im.naturalWidth > 0;
  });
  assert.match(
    await page.locator('#editor').inputValue(),
    /!\[.*\]\(\/attachments\/.*\.png\)/,
    'clipboard image saved as a local attachment',
  );
  await page.evaluate(() => window.pageNotes.flush());
  await page.locator('#next').click();
  await page.waitForFunction(
    () => document.querySelector('#pageNumber').value === '2',
  );
  await page.locator('#prev').click();
  await page.waitForFunction(
    () => document.querySelector('#pageNumber').value === '1',
  );
  await page.waitForFunction(
    () => document.querySelectorAll('#preview .diagram-ready svg').length === 4,
  );
  await page.reload();
  await page.waitForFunction(
    () => document.querySelector('#pageCount').textContent === '/ 3',
  );
  await page.waitForFunction(() => {
    const im = document.querySelector('#preview img');
    return im && im.complete && im.naturalWidth > 0;
  });
  await page.waitForFunction(
    () => document.querySelectorAll('#preview .diagram-ready svg').length === 4,
  );
  await page.locator('[data-mode="read"]').click();
  await page.screenshot({
    path: path.join(root, 'tests', 'markdown-preview.png'),
  });
  // An invalid diagram should show a local error without breaking valid diagrams.
  await page.locator('[data-mode="edit"]').click();
  await page
    .locator('#editor')
    .fill(
      '```mermaid\nflowchart TD\n A -->\n```\n\n```mermaid\nflowchart LR\n X[仍可渲染] --> Y[完成]\n```',
    );
  await page.waitForSelector('#preview .diagram-error', { state: 'attached' });
  await page.waitForSelector('#preview .diagram-ready svg', {
    state: 'attached',
  });
  assert.equal(await page.locator('#preview .diagram-error').count(), 1);
  // A stale render must not overwrite newly edited content.
  await page
    .locator('#editor')
    .fill('```mermaid\nflowchart LR\n A[旧版本] --> B\n```');
  await page
    .locator('#editor')
    .fill('```mermaid\nflowchart LR\n X[最新版] --> Y[已保存]\n```');
  await page.waitForFunction(() =>
    document
      .querySelector('#preview .diagram-ready')
      ?.textContent.includes('最新版'),
  );
  assert.equal(await page.locator('#preview .diagram-ready').count(), 1);
  // Source Markdown and embedded Markdown use the same renderer.
  await page
    .locator('#fileInput')
    .setInputFiles(path.join(root, 'examples', 'Markdown示例.md'));
  await page.waitForFunction(() =>
    document.querySelector('#documentType').textContent.startsWith('MD'),
  );
  await page.locator('#loading').waitFor({ state: 'hidden' });
  await page.waitForFunction(
    () =>
      document.querySelectorAll('#markdownDocument .diagram-ready svg')
        .length === 4,
  );
  await page.locator('[data-mode="edit"]').click();
  await page.locator('#editor').fill('# 附件验证');
  await page
    .locator('#attachmentInput')
    .setInputFiles(path.join(root, 'examples', 'Markdown示例.md'));
  await page.waitForFunction(
    () =>
      document.querySelectorAll('#preview .markdown-embed .diagram-ready svg')
        .length === 4,
  );
  assert.deepEqual(errors, [], 'No uncaught renderer errors');
  await fs.writeFile(
    path.join(root, 'tests', 'markdown-results.json'),
    JSON.stringify(
      {
        ok: true,
        checks: [
          'LaTeX formulas',
          'native clipboard image',
          'image persists across navigation and reload',
          'Mermaid flowchart',
          'sequence diagram',
          'pie chart',
          'bar and line chart',
          'code highlighting',
          'tables and task lists',
          'diagram syntax error isolation',
          'stale render cancellation',
          'source and embedded Markdown',
        ],
      },
      null,
      2,
    ),
  );
  console.log(
    'PASS Markdown desktop: formulas, native clipboard image, Mermaid charts, basic syntax, highlighting, persistence, source and attachments.',
  );
} catch (error) {
  const page = await app.firstWindow();
  console.log(await page.locator('body').innerText());
  await page
    .screenshot({
      path: path.join(root, 'tests', 'markdown-failure.png'),
      timeout: 3000,
    })
    .catch(() => {});
  throw error;
} finally {
  await app
    .evaluate(async ({ clipboard }) => {
      if (globalThis.markdownTestClipboard) {
        await clipboard.write(globalThis.markdownTestClipboard);
        delete globalThis.markdownTestClipboard;
      }
    })
    .catch(() => {});
  await app.close();
  if (occupier.listening)
    await new Promise((resolve) => occupier.close(resolve));
}
