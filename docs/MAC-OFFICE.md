# Mac Office 接入 / Mac Office integration

macOS 版通过本机 Microsoft Word 和 PowerPoint 转换文档。PDF、Markdown 不需要 Office。请先正常启动并激活对应 Office 应用；WPS、Pages 和 Keynote 不作为这个自动化接口的替代。

The macOS build converts documents with locally installed Microsoft Word and PowerPoint. Open and activate the corresponding Office application first. PDF and Markdown work without Office; WPS, Pages and Keynote do not supply this automation interface.

首次操作时允许系统弹出的自动化请求。如果曾拒绝，在 **系统设置 → 隐私与安全性 → 自动化** 中为 pagenote 开启 Word / PowerPoint。开发版的请求者可能显示为 Electron。文件访问提示也需允许访问正在处理的文件。应用不会修改 Office 的安全设置或强制退出 Office。

Allow the automation request on first use. If previously denied, enable Word / PowerPoint for pagenote under **System Settings → Privacy & Security → Automation**. Development builds may appear as Electron. Allow access to the document if Office requests it. pagenote does not change Office security settings or force-quit Office.

Word / PPT 的导入、链接项目预览，以及在默认应用保存后回到 pagenote 的刷新，共用同一个转换接口。人工编辑仍然使用系统默认应用。MCP 的 Word 编辑使用独立的 Word 窗口和临时编辑副本；保存成功后更新原文、预览及项目源文件。转换失败或源文件发生冲突时保留编辑副本，并报告错误。

Imports, linked-project previews and refresh after external edits share the same converter. Manual source editing uses the default application. MCP Word editing uses a separate Word window and a working copy. Successful saves update the managed source, preview and linked project. Conversion failures or source conflicts retain the working copy and report an error.

Word 截图显示导出 PDF 中的文档内容，返回 `renderedFrom: "pdf"`。不需要屏幕录制权限。Word 窗口的工具栏、光标和原生撤销由 Word 管理。替换操作需要当前 `revision`；跨表格结构的替换会被拒绝，避免破坏表格。

Word screenshots show exported PDF content and return `renderedFrom: "pdf"`, without screen-recording permission. Word manages its toolbar, caret and native undo. Replacements require the current `revision`; replacements crossing table structure are rejected.

自动化超时后先检查 Office 是否有待处理的权限、激活或文件对话框，再重试。若 Word / PowerPoint 自身卡住，可先保存自己的文档，再手动重启该应用。

After an automation timeout, check Office for a pending permission, activation or file dialog before retrying. If Office itself is unresponsive, save your documents before manually restarting it.

开发验证 / Development checks:

```sh
npm run build
npm run test:release
npm run test:mcp
npm run test:mac-office
npm run package:mac:local
```

Office 测试使用合成文档和隔离的数据目录，会启动本机 Word / PowerPoint。打包测试可设置 `DESKTOP_EXE` 为 `.app/Contents/MacOS/pagenote` 后运行 `npm run test:mac-office`。测试覆盖范围与当前机器环境应随发布结果记录；不能由本机通过推断所有 Office 版本或 Intel 真机已经通过。

Office checks use synthetic documents and isolated profiles, and launch local Word / PowerPoint. Set `DESKTOP_EXE` to `.app/Contents/MacOS/pagenote` to test a packaged application. Record the tested environment with release results; local results do not establish compatibility with every Office version or an Intel machine.
