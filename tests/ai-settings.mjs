import { _electron as electron } from '@playwright/test';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
const root = path.resolve(import.meta.dirname, '..'),
  profile = path.join(root, 'tests/ai-settings-data-' + Date.now());
const launch = () =>
  electron.launch({
    executablePath:
      process.env.DESKTOP_EXE ||
      path.join(root, 'node_modules/electron/dist/electron.exe'),
    args: process.env.DESKTOP_EXE ? [] : [root],
    env: { ...process.env, PAGE_NOTES_USER_DATA: profile },
  });
let app = await launch(),
  client;
try {
  let w = await app.firstWindow();
  await w.waitForFunction(() => !!window.pageNotes);
  await w.evaluate(() => window.pageNotes.ready);
  await w.evaluate(() => window.pageNotes.openAISettings());
  const defaults = await w.locator('#aiSystemPrompt').inputValue();
  if (process.env.AI_SETTINGS_SCREENSHOT)
    await w.screenshot({ path: process.env.AI_SETTINGS_SCREENSHOT });
  assert.ok(defaults.includes('不把所有任务都变成逐页讲课'));
  const custom =
    '先遵守本次任务范围。用简洁中文解释；遇到论文先区分结论与证据。';
  await w.locator('#aiSystemPrompt').fill(custom);
  await w.locator('#aiSettingsSave').click();
  await w.waitForFunction(() =>
    document.querySelector('#aiSettingsStatus').textContent.includes('已保存'),
  );
  assert.equal(
    JSON.parse(
      await fs.readFile(
        path.join(profile, 'documents-data/ai-settings.json'),
        'utf8',
      ),
    ).systemPrompt,
    custom,
  );
  const config = JSON.parse(
    await fs.readFile(path.join(profile, 'mcp/mcp-config.json'), 'utf8'),
  ).mcpServers.page_notes;
  client = new Client({ name: 'ai-settings-test', version: '1' });
  await client.connect(new StdioClientTransport({ ...config, stderr: 'pipe' }));
  assert.ok(client.getInstructions().includes(custom));
  assert.ok(!client.getInstructions().includes(defaults));
  const skill = await client.readResource({
    uri: 'page-notes://skills/page-tutor',
  });
  assert.ok(skill.contents[0].text.includes('人文材料'));
  await client.close();
  client = null;
  await w.locator('#aiPromptReset').click();
  assert.equal(await w.locator('#aiSystemPrompt').inputValue(), defaults);
  await w.locator('#aiSettingsCancel').click();
  await w.evaluate(() => window.pageNotes.openAISettings());
  assert.equal(
    await w.locator('#aiSystemPrompt').inputValue(),
    custom,
    'unsaved reset must not overwrite saved preferences',
  );
  const invalid = await w.evaluate(async () => {
    const r = await fetch('/api/ai-settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ systemPrompt: 42 }),
    });
    return r.status;
  });
  assert.equal(invalid, 400);
  await app.close();
  app = await launch();
  w = await app.firstWindow();
  await w.waitForFunction(() => !!window.pageNotes);
  await w.evaluate(() => window.pageNotes.ready);
  await w.evaluate(() => window.pageNotes.openAISettings());
  assert.equal(await w.locator('#aiSystemPrompt').inputValue(), custom);
  await w.locator('#aiPromptReset').click();
  await w.locator('#aiSettingsSave').click();
  await w.waitForFunction(() =>
    document.querySelector('#aiSettingsStatus').textContent.includes('已保存'),
  );
  assert.equal(
    JSON.parse(
      await fs.readFile(
        path.join(profile, 'documents-data/ai-settings.json'),
        'utf8',
      ),
    ).systemPrompt,
    defaults,
  );
  await w.locator('#aiSettingsCancel').click();
  await w.evaluate(() => window.pageNotes.setLanguage('en-US'));
  await w.evaluate(() => window.pageNotes.openAISettings());
  assert.ok(
    (await w.locator('#aiSettings').innerText()).includes(
      'Default system prompt',
    ),
  );
  console.log(
    'PASS AI prompt edit/save/restart, MCP instructions, general skill routing, unsaved reset/cancel, reset/save, validation and English UI',
  );
} finally {
  await client?.close();
  await app.close();
}
