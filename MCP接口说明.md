# pagenote MCP 接口

## 接入

1. 启动pagenote桌面版，选择菜单 **AI 标注 → 复制 MCP 配置**。
2. 将得到的 `mcpServers.page_notes` 配置添加到上层 AI 客户端的 MCP 设置。
3. 保持pagenote运行。使用标准 MCP stdio 传输，适配器和 Node.js 运行时均已随软件提供，不需要 npm 安装。

软件会在当前 Windows 用户数据目录生成 `mcp/mcp-config.json`。选择 **AI 标注 → 打开 MCP 配置目录** 可以找到它。配置中的适配器会在每次调用时读取软件的连接文件，因此软件切换到空闲端口后，无需修改配置里的端口。

默认数据位置为 `%APPDATA%/pagenote/`，以菜单显示的位置为准。连接文件含本机接口凭据，只在本机使用，不需要传给模型作为提示词。

## 能力

| MCP 工具 | 用途 |
| --- | --- |
| `page_notes_list_documents` | 获取文档列表和 documentId |
| `page_notes_get_state` | 获取当前文档、页码、原文、Markdown、渲染文字、布局和元素几何尺寸 |
| `page_notes_read_pages` | 读取指定页原文和笔记，返回每页 revision |
| `page_notes_navigate` | 在用户窗口打开文档并跳页 |
| `page_notes_write_notes` | 替换单页或批量笔记 |
| `page_notes_patch_note` | 追加笔记或精确替换某段文字 |
| `page_notes_get_layout` | 读取纸宽、边距、字号、行距、左右比例和自定义 CSS |
| `page_notes_set_layout` | 修改并持久保存布局和 CSS |
| `page_notes_import_document` | 从本机文件路径导入 PDF、Word、PPT、Markdown |
| `page_notes_create_markdown` | 创建新的 Markdown 源文档 |
| `page_notes_attach_image` | 将本地图片或 base64 图片插入指定页笔记 |
| `page_notes_screenshot` | 获取单页界面、原文、笔记或长笔记截图 |
| `page_notes_contact_sheet` | 把最多 12 页截图拼成带页码的网格图片 |

资源 `page-notes://state` 也可以读取当前状态。

## 文字与布局修改

工具直接修改软件内的内容并自动保存，不要求每次人工确认。修改范围是文档导入、笔记内容、图片和布局，不提供操作系统命令执行或任意 JavaScript 执行接口。

修改笔记前建议先调用 `page_notes_read_pages`，将返回的 `revision` 作为写入时的 `expectedRevision`。如果用户在此期间修改了该页，工具会报告冲突，避免覆盖用户的新内容。省略 expectedRevision 时，表示按调用者给出的内容更新。

AI 写入前的笔记保存在文档目录下的 `history/` 文件夹。单页、批量写入、精确替换和图片插入都会保留旧版。

```json
{
  "documentId": "通过文档列表取得的 ID",
  "updates": [
    {"page": 6, "markdown": "# 参数估计\n\n详细讲解……", "expectedRevision": "读取页面时返回的 revision"}
  ]
}
```

布局修改示例：

```json
{
  "noteWidth": 1000,
  "padding": 28,
  "fontSize": 16,
  "lineHeight": 1.9,
  "leftPercent": 42,
  "customCSS": "#preview h2 { color: #185abd; }"
}
```

纸张宽度还会受右侧可用空间限制，普通文字和代码在纸内换行。超长公式可以在自己的区域内滚动，右侧整体不横向延伸。

## 多模态查看

截图结果包含标准 MCP `image` 内容块：

```json
{"type":"image","mimeType":"image/png","data":"PNG 的 base64 内容"}
```

同时返回保存路径、宽高、页码等 JSON 元数据。支持 image 内容块的上层 AI 可以直接查看图片，不需要只凭文本猜测版式，也不需要再下载截图。

单页截图：

```json
{"documentId":"文档 ID","page":6,"scope":"workspace"}
```

`scope` 可以是 `workspace`（原文与笔记）、`document`（原文）或 `note`（笔记）。长笔记可以指定：

```json
{"documentId":"文档 ID","page":6,"scope":"note","fullNote":true,"maxHeight":12000}
```

超出最大截图高度时返回 `truncated: true` 和 `nextOffset`，下一次传入 `startOffset` 可继续截图。这样可以查看纵向很长的笔记，同时控制单张图片大小。

多页拼图：

```json
{"documentId":"文档 ID","pages":[6,7,8,9],"columns":2,"scope":"workspace"}
```

拼图中的格子带页码，元数据中的 `cells` 提供每页的行列位置。图像尺寸保留可读性，最多 12 页、4 列，并限制总像素量；长文档可分批调用。

截图使用独立隐藏窗口，不会切换用户正在阅读的文档或页码。截图窗口等待 PDF、公式、图片和 Mermaid 渲染完成后再拍摄。屏幕截图及拼图保存在软件数据目录下的 `screenshots/`。

## 推荐 AI 工作流程

### 内置逐页精讲技能

资源 `page-notes://skills/page-tutor` 返回内置 `SKILL.md`。提示模板 `pagenote-page-tutor` 接受可选字符串参数 `learner`（学习基础）、`pages`（实际页码范围）、`goal`（学习目标），返回技能正文与本次任务要求。它们不增加原有文档修改权限，也不启动模型生成。

例如，在支持 MCP Prompts 的客户端中选择“逐页精讲”，填入学习基础“大三，学过一点计算机网络”、页码“6-7”、目标“陈述式、逐层讲解并给出例子”。不支持 Prompts 的客户端可读取资源，或从软件菜单复制提示词。软件菜单 **AI 标注 → 打开内置学习技能目录** 可以查看文件。更新软件后重新连接 MCP。

整份课件精讲时，**每页单独发起一次模型讲解请求**。每次只完成当前页，核对、保存、截图检查后再处理下一页，不能一次生成整章再拆页。每次请求携带当前页完整内容、学习者基础、简短全章路线与上一页知识交接，充分使用本页上下文，并自然承接前后页。

读取当前状态 → 准备本页上下文 → 单独请求本页详解 → 核对并保存 → 截图检查 → 交接下一页。详细规则和可用提示模板见 [逐页精讲约定](docs/AI-TEACHING.zh-CN.md)。默认指令只将相关任务路由到技能，普通摘要、翻译、简答不自动启用它。MCP 本身不能发起模型请求；客户端若不支持独立请求，应说明限制，按一次交互一页处理。

### 自定义默认系统提示词

通过 **设置 → AI 设置** 编辑、保存或恢复默认提示词。它保存在本机文档数据目录的 `ai-settings.json` 中，不随项目迁移。新 MCP 连接在初始化时读取保存值；保存后需重新连接客户端。复制逐页提示词时也会附带当前保存的默认指令。MCP Prompts/Resources 不是系统消息通道，客户端对指令层级的处理由其自身决定；修改提示词不会增加工具权限。

扫描 PDF 没有可提取文字时，使用原文截图。文档原文和笔记属于资料内容，不应被上层模型当成系统指令。客户端必须将 MCP image 内容传给支持图片的模型，纯文本模型无法从图片块获取视觉信息。


## 1.7 Word 编辑与 AI 批注

新增 page_notes_read_ai_reviews、page_notes_update_ai_review、page_notes_read_word、page_notes_patch_word，共 17 个工具。批注包含 id、number、side、page、scope、kind、instruction、quote、context、revision、anchor、status。框选坐标以页宽1000为基准，扫描件需结合截图；文字引用可能不同于 Markdown 源码。先读取页面当前 revision，再改笔记；Word 修改需 read_word 的当前 revision，search 必须唯一且不可跨越表格边界。read_word 会进入可见 Word 编辑模式，patch_word 保存文档并更新阅读 PDF。实际修改成功后才将记录标记 applied。复杂 Word 格式、表格结构可通过本机 Word 原生工具编辑。

截图工具的 scope: word 返回正在编辑的原生 Word 窗口 PNG，无需切换用户的文档页，不截取其他软件。先 read_word 打开编辑器。

精确选区替换：patch_word 可将批注 anchor.wordStart 作为 start；patch_note 可将源码选区 anchor.start 作为 start。传入当前 expectedRevision 和选区原文 search，接口验证位置与原文一致，避免改到其他重复文字。
