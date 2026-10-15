import { _electron as electron } from '@playwright/test';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { PNG } from 'pngjs';
import path from 'node:path';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
const root = path.resolve(import.meta.dirname, '..');
const userData = path.join(root, 'tests', 'mcp-data');
await fs.mkdir(userData, { recursive: true });
const executable =
  process.env.DESKTOP_EXE ||
  path.join(root, 'node_modules', 'electron', 'dist', 'electron.exe');
const launch = () =>
  electron.launch({
    executablePath: executable,
    args: process.env.DESKTOP_EXE ? [] : [root],
    env: { ...process.env, PAGE_NOTES_USER_DATA: userData },
    timeout: 40000,
  });
let app = await launch();
let client;
function json(result) {
  assert.ok(!result.isError, result.content[0]?.text);
  return JSON.parse(result.content[0].text);
}
try {
  const window = await app.firstWindow();
  await window.waitForSelector('#noteScroll');
  await window.waitForFunction(() => !!window.pageNotes);
  await window.evaluate(() => window.pageNotes.ready);
  const descriptor = JSON.parse(
    await fs.readFile(path.join(userData, 'ai-connection.json'), 'utf8'),
  );
  const denied = await fetch(descriptor.url + '/api/ai/call', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'get_state' }),
  });
  assert.equal(denied.status, 401);
  client = new Client({ name: 'page-notes-test', version: '1.0' });
  const config = JSON.parse(
    await fs.readFile(path.join(userData, 'mcp', 'mcp-config.json'), 'utf8'),
  ).mcpServers.page_notes;
  await client.connect(new StdioClientTransport({ ...config, stderr: 'pipe' }));
  assert.ok(client.getInstructions().includes('先识别用户当前任务'));
  assert.ok(client.getInstructions().includes('其他任务按用户要求执行'));
  const tools = await client.listTools();
  assert.equal(tools.tools.length, 17);
  const resources = await client.listResources();
  assert.ok(
    resources.resources.some((r) => r.uri === 'page-notes://skills/page-tutor'),
  );
  const skill = await client.readResource({
    uri: 'page-notes://skills/page-tutor',
  });
  const canonicalSkill = await fs.readFile(
    path.join(root, 'skills/pagenote-page-tutor/SKILL.md'),
    'utf8',
  );
  assert.equal(skill.contents[0].text, canonicalSkill);
  assert.ok(canonicalSkill.includes('上一页交接'));
  assert.ok(canonicalSkill.includes('每页作为独立的模型讲解请求'));
  const prompts = await client.listPrompts();
  assert.ok(prompts.prompts.some((p) => p.name === 'pagenote-page-tutor'));
  const prompt = await client.getPrompt({
    name: 'pagenote-page-tutor',
    arguments: {
      learner: '大三，学过一点计算机网络',
      pages: '6-7',
      goal: '陈述式逐层解释',
    },
  });
  assert.ok(prompt.messages[0].content.text.includes(canonicalSkill));
  assert.ok(
    prompt.messages[0].content.text.includes('大三，学过一点计算机网络'),
  );
  assert.ok(prompt.messages[0].content.text.includes('6-7'));
  const imported = json(
    await client.callTool({
      name: 'page_notes_import_document',
      arguments: {
        filePath: path.join(root, 'tests', 'fixtures', 'sample.pdf'),
      },
    }),
  );
  const state = json(
    await client.callTool({ name: 'page_notes_get_state', arguments: {} }),
  );
  assert.equal(state.document.id, imported.id);
  assert.equal(state.total, 3);
  assert.ok(state.sourceText.includes('Pattern Recognition'));
  const first = json(
    await client.callTool({
      name: 'page_notes_read_pages',
      arguments: { documentId: imported.id, pages: [1, 2] },
    }),
  );
  const text =
    '# 无限长笔记纸张\n\n' +
    '这是一段较长的解释，纸张宽度固定，正文自动换行。\n\n'.repeat(90) +
    '\n```python\n' +
    'long_word_'.repeat(150) +
    '\n```\n\n```mermaid\nflowchart LR\n A[原文] --> B[理解] --> C[笔记]\n```';
  json(
    await client.callTool({
      name: 'page_notes_write_notes',
      arguments: {
        documentId: imported.id,
        updates: [
          {
            page: 1,
            markdown: text,
            expectedRevision: first.pages[0].revision,
          },
          { page: 2, markdown: '# 第二页\n\n$$\\mu=18$$' },
        ],
      },
    }),
  );

  const layout = json(
    await client.callTool({
      name: 'page_notes_set_layout',
      arguments: {
        noteWidth: 420,
        padding: 28,
        fontSize: 16,
        leftPercent: 45,
        customCSS: '#preview h1 { color: #185abd; }',
      },
    }),
  );
  assert.equal(layout.noteWidth, 420);
  const paper = await window.locator('#noteBody').evaluate((e) => ({
    width: e.getBoundingClientRect().width,
    scroll: e.scrollWidth,
    height: e.scrollHeight,
  }));
  assert.ok(paper.width <= 421);
  assert.ok(
    paper.scroll <= paper.width + 2,
    'paper has no horizontal overflow',
  );
  assert.ok(paper.height > 2000, 'paper grows vertically');
  assert.equal(
    await window
      .locator('#preview h1')
      .evaluate((e) => getComputedStyle(e).color),
    'rgb(24, 90, 189)',
  );
  const updated = json(
    await client.callTool({
      name: 'page_notes_read_pages',
      arguments: { documentId: imported.id, pages: [1] },
    }),
  );
  assert.equal(
    updated.pages[0].markdown,
    text,
    'AI reader refreshes after mutation',
  );
  await window.evaluate(() => window.pageNotes.lockEditing());
  await window.locator('#next').click();
  await window.waitForFunction(
    () => document.querySelector('#pageNumber').value === '2',
  );
  assert.ok(
    await window.locator('#editor').isDisabled(),
    'AI edit lock survives navigation',
  );
  await window.evaluate(() => window.pageNotes.unlockEditing());
  await window.locator('#prev').click();
  await window.waitForFunction(
    () => document.querySelector('#pageNumber').value === '1',
  );
  const conflict = await client.callTool({
    name: 'page_notes_write_notes',
    arguments: {
      documentId: imported.id,
      updates: [
        {
          page: 1,
          markdown: 'should not overwrite',
          expectedRevision: 'wrong',
        },
      ],
    },
  });
  assert.ok(conflict.isError);
  json(
    await client.callTool({
      name: 'page_notes_patch_note',
      arguments: { documentId: imported.id, page: 2, append: '追加解释' },
    }),
  );
  await client.callTool({
    name: 'page_notes_navigate',
    arguments: { documentId: imported.id, page: 2 },
  });
  const activeBefore = await window.locator('#pageNumber').inputValue();
  const screenshot = await client.callTool({
    name: 'page_notes_screenshot',
    arguments: {
      documentId: imported.id,
      page: 1,
      scope: 'note',
      fullNote: true,
      maxHeight: 2400,
    },
  });
  const meta = json(screenshot);
  const image = screenshot.content.find((c) => c.type === 'image');
  assert.ok(image);
  const png = PNG.sync.read(Buffer.from(image.data, 'base64'));
  assert.ok(png.height >= 2300);
  assert.ok(meta.truncated);
  await fs.copyFile(meta.path, path.join(root, 'tests', 'mcp-long-note.png'));
  assert.equal(
    await window.locator('#pageNumber').inputValue(),
    activeBefore,
    'hidden screenshots do not navigate visible window',
  );
  const sheet = await client.callTool({
    name: 'page_notes_contact_sheet',
    arguments: {
      documentId: imported.id,
      pages: [1, 2, 3],
      columns: 2,
      scope: 'workspace',
    },
  });
  const sheetMeta = json(sheet);
  assert.deepEqual(sheetMeta.pages, [1, 2, 3]);
  assert.ok(sheet.content.some((c) => c.type === 'image'));
  await fs.copyFile(
    sheetMeta.path,
    path.join(root, 'tests', 'mcp-contact-sheet.png'),
  );
  const created = json(
    await client.callTool({
      name: 'page_notes_create_markdown',
      arguments: {
        name: 'AI 创建的文档',
        markdown: '# 第一页\n\n说明\n\n---\n\n# 第二页',
        activate: false,
      },
    }),
  );
  assert.equal(created.kind, 'markdown');
  const resource = await client.readResource({ uri: 'page-notes://state' });
  assert.equal(JSON.parse(resource.contents[0].text).page, 2);
  json(
    await client.callTool({
      name: 'page_notes_set_layout',
      arguments: {
        noteWidth: 1000,
        padding: 28,
        fontSize: 15,
        leftPercent: 42,
        customCSS: '#preview h1 { color: #185abd; }',
      },
    }),
  );
  const wide = await window.locator('#noteBody').evaluate((paper) => {
    const viewport = document.getElementById('noteScroll');
    const style = getComputedStyle(viewport);
    return {
      width: paper.getBoundingClientRect().width,
      available:
        viewport.clientWidth -
        parseFloat(style.paddingLeft) -
        parseFloat(style.paddingRight),
    };
  });
  assert.ok(
    Math.abs(wide.width - Math.min(1000, wide.available)) <= 3,
    'configured paper fills available writing space while staying bounded',
  );
  const screenshotMain = await app.evaluate(async ({ BrowserWindow }) => {
    const main = BrowserWindow.getAllWindows().find((w) => w.isVisible());
    return (await main.webContents.capturePage(undefined, { stayAwake: true }))
      .toPNG()
      .toString('base64');
  });
  await fs.writeFile(
    path.join(root, 'tests', 'paper-preview.png'),
    Buffer.from(screenshotMain, 'base64'),
  );
  await app.close();
  app = await launch();
  const restarted = await app.firstWindow();
  await restarted.waitForSelector('#noteScroll');
  await restarted.waitForFunction(() => !!window.pageNotes);
  await restarted.evaluate(() => window.pageNotes.ready);
  const afterRestart = json(
    await client.callTool({
      name: 'page_notes_read_pages',
      arguments: { documentId: imported.id, pages: [2] },
    }),
  );
  assert.ok(
    afterRestart.pages[0].markdown.includes('追加解释'),
    'same MCP client reconnects after desktop restart',
  );
  await fs.writeFile(
    path.join(root, 'tests', 'mcp-results.json'),
    JSON.stringify(
      {
        ok: true,
        tools: 17,
        checks: [
          'stdio MCP handshake',
          'tool discovery',
          'authenticated desktop bridge',
          'source and layout inspection',
          'batch writes',
          'revision conflicts',
          'append',
          'layout persistence and custom CSS',
          'fixed-width long paper',
          'single long-note image',
          'three-page collage',
          'screenshot does not disturb reading',
          'Markdown creation',
          'MCP resource',
        ],
      },
      null,
      2,
    ),
  );
  console.log(
    'PASS MCP: 17 tools; read/write/layout/import; bounded paper; revisions; hidden screenshots and collage; PNG image content; restart with live MCP client.',
  );
} finally {
  await client?.close();
  await app.close();
}
