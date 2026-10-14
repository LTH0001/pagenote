# Typora 参照与本轮调整 / Editor reference

2026-10-14 实际打开本机 Typora 的「文件、编辑、段落、格式」菜单，并用 Windows UI Automation 读取展开项；未改动 Typora 文档。 / Inspected the installed Typora menus through Windows UI Automation without changing its document.

| 常用任务 / Task | pagenote |
| --- | --- |
| 新建、打开、保存 / New, open, save | 使用统一项目，关联源文件和页面笔记 / Unified projects |
| 撤销、重做、剪切、复制、全选 / Basic editing | 笔记编辑栏的「编辑」菜单 / Notes Edit menu |
| 标题、列表、任务列表、引用 / Paragraph structure | 段落菜单与 Markdown / Paragraph menu and Markdown |
| 加粗、斜体、下划线、删除线 / Inline formatting | 格式菜单 / Format menu |
| 代码块、语言高亮、LaTeX、Mermaid / Technical notes | 实时渲染，Mermaid 使用代码块语言 / Live rendering |
| 表格、链接、图片、格式粘贴 / Rich content | 插入菜单 / Insert menu |
| 搜索替换、脚注、打印及高级导出 / Advanced workflows | 尚未作为新增功能实现；需先确认范围 / Not added in this round |

不使用“达到 Typora 60%”作为未经定义的数字指标。本轮覆盖常用 Markdown 编辑任务，并采用点击展开的菜单，不复制 Typora 的全部功能。 / Coverage is described by tasks rather than an undefined percentage.

人工编辑 Word/PDF/PPT 改为系统默认应用。项目编辑打开 `src` 中链接的源文件；单独导入编辑的是 pagenote 的本地副本，不覆盖最初导入位置。保存后回到 pagenote 自动检查并刷新；页笔记继续按页码对应，外部删除或重排页面后应检查对应关系。 / External editing uses the system default app. Projects edit linked source files; standalone imports edit the local managed copy. Return after saving to refresh. Notes remain linked by page number; check correspondence after deleting or reordering pages.

本机默认 Word 已验证实体 Delete、Ctrl+Z、Ctrl+S，以及更新预览后表格和笔记保留。PDF 内容编辑能力由默认 PDF 应用提供；Office 转换仍需本机 Microsoft Office。 / Physical Delete, Undo and Save were verified in the local default Word app. PDF editing depends on the default app; Office preview conversion still requires Microsoft Office.

图标使用双页：左边代表原文，右边代表拆解后的知识步骤，中间箭头表达解读过程。生成 SVG、PNG 与 16–256px 多尺寸 ICO，无字体依赖。 / The icon depicts source-to-structured-notes with facing pages, and ships as SVG, PNG and a multi-resolution ICO.

官方参照 / Official reference: [Typora shortcuts](https://support.typora.io/Shortcut-Keys/), [Typora copy/paste](https://support.typora.io/Copy-and-Paste/), [Microsoft SetParent](https://learn.microsoft.com/en-us/windows/win32/api/winuser/nf-winuser-setparent).
