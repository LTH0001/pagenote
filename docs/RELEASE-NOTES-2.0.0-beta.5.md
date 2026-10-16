# pagenote 2.0.0-beta.5

这是 beta.4 之后的累计测试版。安装包、完整 Windows ZIP、源码和 SHA256 校验值统一使用 beta.5 版本号。

- 修复多种复制公式与紧邻正文的多行公式显示为反斜杠文本的问题，公式字体随软件提供。
- AI 逐页保存笔记后静默更新，保留正在阅读的页码和滚动位置；修复连续空白笔记导致的页码错配。
- 内置离线中英文 OCR 与按页材料准备，为 AI 提供文字、坐标、置信度、原页/区域图片和缓存。识别结果仍需结合原图，不承诺无损识别。
- 新增统一提示词索引，区分初始讲解、AI Tag 修改和普通编辑；AI 设置可分别修改模块，按版本按需读取。
- 逐页精讲改用相邻源页上下文，支持上层客户端按资源和配额并行调度，不再强制等待上一页讲解交接。软件不自行调用模型。
- 增加保存前 Markdown、公式、Mermaid、代码围栏与本地图片预检，精简 MCP 读取与返回。
- 优化选择工具菜单收起、侧栏宽度与对齐；保留项目、标注和用户修改。

## 下载与升级

普通用户下载 `pagenote-2.0.0-beta.5-windows-x64-setup.exe`。ZIP 用户应全部解压到新目录后运行其中的 `pagenote.exe`，不要只复制 EXE。升级前建议备份整个学习项目文件夹，关闭旧版后安装或启动新版。

默认用户数据目录和学习项目不会因为更换程序目录自动删除。此版本没有承诺自动升级；下载了旧包的用户需要手动安装新版。

## 验证范围与限制

- 已进行本机源码及打包版本的自动化检查，验证范围以发布记录为准；尚未完成独立电脑和完整安装/升级/卸载验收。
- 当前 Windows 安装包未代码签名，旧构建曾遭火绒拦截；尚未取得厂商误报确认。本版本继续标记为测试版，不要求用户关闭防护。
- Word/PPT 转换依赖本机 Office，缺少 Office 时可先导出 PDF。离线 OCR 的 Windows 原生组件依赖微软 Visual C++ 运行环境；包内不包含该系统运行库安装程序。
- AI 功能需要外部客户端、模型权限与额度；不包含免费模型服务。提示词和预检不能保证所有生成内容正确或所有电脑一次渲染成功。

---

## English

This cumulative prerelease updates the installer, complete Windows ZIP and source archive together from beta.4 to beta.5.

Highlights include formula compatibility fixes; silent page-note publication; empty-page alignment fixes; offline Chinese/English OCR and cached local page preparation; a versioned prompt index with editable modules and AI Tag editing routes; parallel page-task guidance using adjacent source pages; local Markdown/math/Mermaid/image preflight; and selective MCP reads.

Close the old app before upgrading. Extract the entire ZIP into a new folder or use the installer. Back up your complete study project first. Existing user data and portable projects are not automatically deleted. Automatic updating is not promised.

This is an unsigned beta. Independent-machine and complete install/upgrade/uninstall acceptance remain outstanding. An older build was flagged by antivirus, with no vendor false-positive confirmation yet. Office conversion requires local Microsoft Office; offline OCR native components require the Microsoft Visual C++ runtime, whose installer is not bundled. AI capabilities require an external client and model access. OCR and syntax preflight do not guarantee semantic correctness or universal rendering compatibility.
