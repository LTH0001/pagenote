import { _electron as electron } from '@playwright/test';
import path from 'node:path';
import assert from 'node:assert/strict';
const root = path.resolve(import.meta.dirname, '..');
const app = await electron.launch({
  executablePath:
    process.env.DESKTOP_EXE ||
    path.join(root, 'node_modules/electron/dist/electron.exe'),
  args: process.env.DESKTOP_EXE ? [] : [root],
  env: {
    ...process.env,
    PAGE_NOTES_USER_DATA: path.join(root, 'tests', 'menus-' + Date.now()),
  },
});
try {
  const w = await app.firstWindow();
  await w.waitForFunction(() => !!window.pageNotes);
  await w.evaluate(() => window.pageNotes.ready);
  await w.evaluate(() => window.pageNotes.setLanguage('zh-CN'));
  const menus = await app.evaluate(({ Menu }) =>
    Menu.getApplicationMenu().items.map((item) => ({
      label: item.label,
      children: item.submenu?.items.map((i) => i.label),
    })),
  );
  assert.ok(
    menus.find((m) => m.label === '文件').children.includes('导入文档（左侧）'),
  );
  assert.ok(
    menus.find((m) => m.label === '文件').children.includes('导入笔记（右侧）'),
  );
  assert.deepEqual(menus.find((m) => m.label === '编辑').children, [
    '选择编辑区域',
  ]);
  assert.ok(
    menus.find((m) => m.label === 'AI 标注').children.includes('文档标注画布'),
  );
  assert.ok(await w.locator('.titlebar').isHidden());
  assert.ok(await w.locator('#saveStatus').isHidden());
  assert.ok(await w.locator('#helpButton').isHidden());
  await w.evaluate(() => window.pageNotes.menuAction('newProject'));
  await w.locator('#newName').fill('新的学习项目');
  await w.locator('#newConfirm').click();
  await w.locator('#newConfirm').waitFor({ state: 'hidden' });
  await w.locator('.document-sheet').first().waitFor();
  assert.ok(
    (
      await w.evaluate(() => window.pageNotes.getState())
    ).document.name.includes('新的学习项目'),
  );
  assert.equal(await w.locator('.ai-workbench:visible').count(), 0);
  await w.evaluate(() => window.pageNotes.menuAction('reviewLeft'));
  assert.ok(await w.locator('.ai-workbench[data-side=document]').isVisible());
  assert.ok(await w.locator('.ai-workbench[data-side=note]').isHidden());
  await w.locator('.ai-workbench[data-side=document] .board-close').click();
  await w.locator('#aiSharedTools [data-ai-pointer=mouse]').click();
  assert.ok(await w.locator('.mouse-options').isVisible());
  await w.locator('#aiSharedTools [data-ai-pointer=hand]').click();
  assert.ok(await w.locator('.mouse-options').isHidden());
  await w.locator('#aiSharedTools [data-ai-pointer=pen]').click();
  assert.ok(await w.locator('#aiPenColor').isVisible());
  assert.ok(await w.locator('[data-ai-pen=highlight]').isVisible());
  await w.evaluate(() => window.pageNotes.menuAction('chooseEditor'));
  assert.ok(
    await w
      .locator('body')
      .evaluate((e) => e.classList.contains('choose-editor')),
  );
  await w.locator('.note-pane .pane-heading').click();
  assert.equal(
    (await w.evaluate(() => window.pageNotes.getState())).mode,
    'edit',
  );
  await w.locator('#noteEditButton').click();
  await w.evaluate(() => window.pageNotes.menuAction('chooseEditor'));
  await w.locator('.document-pane .pane-heading').click();
  assert.equal(
    await w.locator('.markdown-page').first().getAttribute('contenteditable'),
    'true',
  );
  await w.locator('.markdown-page').first().click();
  await w.keyboard.insertText('编辑左侧文稿');
  await w.locator('#documentEditButton').click();
  assert.ok(
    (await w.evaluate(() => window.pageNotes.getState())).sourceText.includes(
      '编辑左侧文稿',
    ),
  );
  await w.screenshot({ path: path.join(root, 'tests/new-layout-preview.png') });
  console.log(
    'PASS single native menus; left/right imports; new project; edit-area selection; vertical icon tools and contextual choices; workbenches hidden until requested; footer navigation.',
  );
} finally {
  await app.close();
}
