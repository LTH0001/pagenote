# pagenote

<img src="build/icon.png" alt="pagenote 双页图标" width="88">

[English](README.en.md) · 简体中文

pagenote 把课件和讲解放在一起：左边读原文，右边看对应页的笔记。

## 做这个工具的初衷

面对当前的 AI 浪潮，用 AI 辅助学习已是常事。我也常把课件和论文交给 AI，希望把不懂的地方讲清楚。

但学起来，还是免不了在两个窗口间来回切换。原文在一边，讲解在另一边，翻着翻着就对不上了。AI 有时还会调整行文顺序，让人更难跟着课件往下读。

一次讲完整份材料，也容易受上下文和回答长度限制。整章概括有了，具体的推导、符号和例子却常常被省略。看似读完了，遇到题目还是不会用。

我想做一个工具，把原文和讲解按页对应起来。每一页都像单独请教一次，从已有的知识讲起，把中间步骤展开，再接着上一页往下讲。

没听懂的地方，就选中一段文字、框出一张图，留一句“这里换个例子”，让 AI 对着修改。笔记可以边学边改，不用每次复制粘贴、重新交代背景。

我也希望用好 AI 的其他能力。抽象的概念配一张图，算法配一段能运行的代码，推导写出公式，过程画成流程图。让每一页的讲解更具体，也更容易理解。这就是我做 pagenote 的初衷。

目前，pagenote 提供双栏阅读、逐页笔记和 AI 标注，通过 MCP 接口让 AI 读取和修改内容。软件不内置模型；逐页精讲和图片生成等工作，需要配合支持相应能力的 AI 客户端完成。

**当前公开版本：2.0.0-beta.4。** 还在测试和改进中，欢迎拿真实的学习材料试用，也欢迎告诉我哪里用起来不顺。

## 下载与安装

[下载 Windows x64 安装包](https://github.com/laihong06/pagenote/releases/download/v2.0.0-beta.4/pagenote-2.0.0-beta.4-windows-x64-setup.exe) · [完整 ZIP 分发包](https://github.com/laihong06/pagenote/releases/download/v2.0.0-beta.4/pagenote-2.0.0-beta.4-windows-x64.zip) · [发布说明与校验值](https://github.com/laihong06/pagenote/releases/tag/v2.0.0-beta.4)

1. 在本仓库的 **Releases** 中下载 `pagenote-版本-windows-x64-setup.exe`。浏览源码时的 **Code → Download ZIP** 是源码包，不能直接安装。
2. 双击安装包，按向导选择安装位置。安装仅针对当前用户，通常不需要管理员权限。
3. 从桌面或开始菜单启动 **pagenote**。
4. 从 **设置 → 语言 / Language** 选择简体中文或 English。

也可下载 Windows ZIP 分发包，解压整个文件夹，再运行其中的 `pagenote.exe`。不要单独移动 EXE，它依赖同目录的资源。

正式上传 Release 前，应公布 `SHA256SUMS.txt` 并完成安全扫描。当前构建没有发行者签名；如果杀毒软件拦截，请停止运行并向维护者提供日志，**不要关闭防护或添加排除项**。

## 功能与操作

- PDF、Markdown 阅读；Word 与 PowerPoint 可经本机 Microsoft Office 转换阅读。
- Word/PDF/PPT 使用系统默认应用编辑，保存后回到 pagenote 更新预览。PDF 的修改能力由默认应用提供。
- 页间分界越过视图中线时，切换对应笔记；可关闭切换动画。
- Markdown 支持代码实时高亮、LaTeX 公式、图片粘贴、表格及 Mermaid 图表。
- **选择工具**选择文字或区域，随后添加 **AI 标注**；**手形工具**平移页面；**画笔**提供书写、荧光笔和橡皮擦。
- 标注编号双击打开对应画布，右键删除。画布默认收起，可通过 **AI 标注**菜单打开。
- **编辑 → 选择编辑区域**后，点击左侧或右侧进入编辑。
- Ctrl + 鼠标滚轮缩放当前区域；笔记缩放以字号变化实现。
- 自动保留笔记历史，支持恢复；项目、笔迹和标注保存在本机。
- MCP 提供文档读取、笔记修改、布局调整、截图和多页拼图。pagenote 不内置 AI 模型；需另行配置支持 MCP 的 AI 客户端。客户端收到的项目数据由其自身隐私政策决定。

## 项目格式

从 **文件 → 新建项目**创建，指定名称和保存目录。项目可以整体移动：

```text
我的项目/
  project.pagenote          # JSON 项目入口，使用相对链接
  src/
    left.md                # 左侧源文件；导入后可能为 left.pdf / left.docx 等
    right.md               # 右侧笔记，以 <!-- pagebreak --> 分页
    assets/                # 图片及附件
    annotations.json       # 笔迹（产生笔迹后保存）
    ai-reviews.json         # AI 标注（产生标注后保存）
```

安装版可以双击 `project.pagenote` 打开；也可以在软件里用 **文件 → 打开项目**。ZIP 解压版若没有关联文件类型，在新版分发目录运行一次 `register-project-files.cmd`，之后再双击项目；移动软件后需要重新注册。Windows 若已有其他默认应用，请在“打开方式”里选择 pagenote。

旧版 `project.page-notes.json` 也可从软件里打开。入口中的 `left` 与 `right` 链接是文件来源，打开时按链接重新读取 `src`；不要只移动入口文件。

新版将品牌改为 pagenote。检测到旧版默认文档数据且新版尚无文档数据时，会复制文档数据，保留旧目录。已有项目文件夹无需改名或重建。

beta.3 修复了部分 Windows 加密或重定向数据目录中的迁移、临时文件替换和跨盘复制错误。复制中断时保留恢复文件；这些兼容路径不能提供与原子重命名完全相同的断电保证。

## 系统要求

- Windows 10 / 11，x64；其他系统与 ARM64 暂未验证。
- PDF 与 Markdown 不要求安装 Office；Word/PPT 转换依赖 Microsoft Office。
- 安装版包含 MCP 所需 Node.js 运行时，普通用户不需要安装 Node.js。

## 从源码运行

安装 Node.js 22.13 或更高版本，然后在项目根目录执行：

```powershell
npm ci
npm run build
npm run desktop
```

开发网页模式：`npm run dev`。生成 Windows 安装包和 ZIP：`npm run package:desktop`。生成文件夹版：`npm run package:dir`。发布流程见 [中文发布教程](docs/RELEASING.zh-CN.md) 与 [English release guide](docs/RELEASING.en-US.md)。

## 工程与发布状态

术语和翻译集中在 `locales/catalog.json`，语言设置持久化保存；用户文档内容不参与界面翻译。详细术语依据见 [术语规范](docs/TERMINOLOGY.md)。

验收范围及仍需完成的工作见 [发布准备报告](docs/RELEASE-READINESS.md)。提交问题时请注明版本、系统、复现步骤和脱敏日志；不要上传个人项目或 MCP 连接密钥。

## 许可

本项目采用 [MIT License](LICENSE)，允许商业使用。依赖组件有各自的许可；分发时须保留生成的 `THIRD-PARTY-NOTICES.txt`、Node.js 许可及 Electron/Chromium 许可。Microsoft Office 的授权由使用者负责。

MCP 接入文档：[中文](MCP接口说明.md) · [English](docs/MCP.en-US.md)

编辑方式和图标说明：[本轮调整](docs/EDITOR-REFERENCE.md)。
单独导入的文件编辑的是 pagenote 的本地副本；项目编辑打开 `src` 中链接的文件。保存后切回 pagenote。
