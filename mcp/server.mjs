import fs from 'node:fs/promises';
import path from 'node:path';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import packageInfo from '../package.json' with { type: 'json' };
import { teachingPolicy } from './teaching-policy.mjs';

const i = process.argv.indexOf('--connection-file');
const connectionFile =
  i >= 0
    ? process.argv[i + 1]
    : process.env.PAGE_NOTES_CONNECTION_FILE ||
      path.join(
        process.env.APPDATA || process.env.HOME || '.',
        'pagenote',
        'ai-connection.json',
      );
const server = new McpServer(
  { name: 'pagenote', version: packageInfo.version },
  {
    instructions:
      '控制本机pagenote桌面软件。先读取状态或文档列表；修改前读取页面并保留 revision，用 expectedRevision 避免覆盖用户的新修改。截图和拼图返回 image/png 图片内容，多模态模型可直接查看。操作只影响软件的文档、笔记和布局。截图在隐藏窗口生成，不切换用户的阅读页。\n\n' +
      teachingPolicy,
  },
);
const documentId = z
  .string()
  .regex(/^[a-f0-9]{64}$/)
  .optional();
const page = z.number().int().min(1).max(10000);
const pages = z.array(page).min(1).max(40);
async function call(action, args) {
  try {
    const descriptor = JSON.parse(await fs.readFile(connectionFile, 'utf8'));
    const response = await fetch(descriptor.url + '/api/ai/call', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer ' + descriptor.token,
      },
      body: JSON.stringify({ action, args }),
      signal: AbortSignal.timeout(120000),
    });
    const result = await response.json();
    if (!response.ok) throw Error(result.error || 'pagenote请求失败');
    if (result.imageBase64) {
      const { imageBase64, ...meta } = result;
      return {
        content: [
          { type: 'text', text: JSON.stringify(meta, null, 2) },
          { type: 'image', data: imageBase64, mimeType: 'image/png' },
        ],
      };
    }
    return {
      content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
    };
  } catch (error) {
    return {
      isError: true,
      content: [
        {
          type: 'text',
          text:
            'pagenote操作失败：' +
            error.message +
            '。如果软件未打开，请先启动桌面版。',
        },
      ],
    };
  }
}
function tool(name, description, inputSchema, action, readOnly = false) {
  server.registerTool(
    name,
    {
      description,
      inputSchema,
      annotations: {
        readOnlyHint: readOnly,
        destructiveHint: false,
        openWorldHint: false,
      },
    },
    (args) => call(action, args),
  );
}
tool(
  'page_notes_list_documents',
  '列出本机已导入的课件和 Markdown 文档。',
  {},
  'list_documents',
  true,
);
tool(
  'page_notes_get_state',
  '读取当前文档、页码、原文文字、Markdown、渲染文字、布局设置和元素尺寸。',
  {},
  'get_state',
  true,
);
tool(
  'page_notes_read_ai_reviews',
  '读取用户编号的 AI 批注、整体要求、框选坐标、选中文字、上下文和创建时 revision。根据要求修改后，再标为 applied。',
  { documentId, status: z.enum(['open', 'applied', 'dismissed']).optional() },
  'read_ai_reviews',
  true,
);
tool(
  'page_notes_update_ai_review',
  '更新批注要求或处理状态。只有实际完成对应修改后才标记 applied。',
  {
    documentId,
    recordId: z.string().uuid(),
    status: z.enum(['open', 'applied', 'dismissed']).optional(),
    instruction: z.string().max(20000).optional(),
  },
  'update_ai_review',
);
tool(
  'page_notes_read_word',
  '打开本机 Word 编辑器并读取真实 Word 全文及 revision。此操作会进入用户可见的 Word 编辑模式。',
  { documentId },
  'read_word',
);
tool(
  'page_notes_patch_word',
  '通过 Word 修改原文。必须提供当前 expectedRevision；重复文字可用批注 anchor.wordStart 作为 start 精确定位，否则原文须唯一。保存前备份文档并更新阅读 PDF。复杂格式可用 Word 原生工具。',
  {
    documentId,
    search: z.string().min(1),
    replacement: z.string(),
    start: z.number().int().min(0).optional(),
    expectedRevision: z.string(),
  },
  'patch_word',
);
tool(
  'page_notes_read_pages',
  '读取指定页面的原文和笔记，每页返回 revision。扫描件请另外调用截图。',
  { documentId, pages },
  'read_pages',
  true,
);
tool(
  'page_notes_navigate',
  '在用户可见窗口打开指定文档和页面。',
  { documentId, page },
  'navigate',
);
tool(
  'page_notes_write_notes',
  '替换单页或批量笔记；可用 expectedRevision 检测冲突。修改前自动保存旧笔记到历史目录。',
  {
    documentId,
    updates: z
      .array(
        z.object({
          page,
          markdown: z.string().max(10000000),
          expectedRevision: z.string().optional(),
        }),
      )
      .min(1)
      .max(40),
  },
  'write_notes',
);
tool(
  'page_notes_patch_note',
  '追加或替换指定页笔记。传 search/replacement；可用批注 anchor.start 精确定位重复文字。追加时传 append。',
  {
    documentId,
    page,
    append: z.string().optional(),
    search: z.string().optional(),
    replacement: z.string().optional(),
    start: z.number().int().min(0).optional(),
    replaceAll: z.boolean().optional(),
    expectedRevision: z.string().optional(),
  },
  'patch_note',
);
tool(
  'page_notes_get_layout',
  '读取纸宽、边距、字号、行距、左右比例和自定义 CSS。',
  {},
  'get_layout',
  true,
);
tool(
  'page_notes_set_layout',
  '修改并保存界面布局。customCSS 可调整笔记、图表等视觉样式；不执行 JavaScript。',
  {
    noteWidth: z.number().min(320).max(1400).optional(),
    padding: z.number().min(12).max(100).optional(),
    fontSize: z.number().min(10).max(32).optional(),
    lineHeight: z.number().min(1.2).max(3).optional(),
    leftPercent: z.number().min(25).max(75).optional(),
    customCSS: z.string().max(100000).optional(),
    noteAnimation: z.boolean().optional(),
    expandEditor: z.boolean().optional(),
  },
  'set_layout',
);
tool(
  'page_notes_import_document',
  '从本机绝对路径导入 PDF、Word、PPT 或 Markdown，可选择是否在当前窗口打开。',
  {
    filePath: z.string(),
    activate: z.boolean().optional(),
    page: page.optional(),
  },
  'import_document',
);
tool(
  'page_notes_create_markdown',
  '创建新的 Markdown 源文档，使用独立一行 --- 划分页面单位。',
  {
    name: z.string(),
    markdown: z.string().max(10000000),
    activate: z.boolean().optional(),
  },
  'create_markdown',
);
tool(
  'page_notes_attach_image',
  '向指定页追加本地图片，传 filePath 或 base64；name 必须有 png/jpg 等图片扩展名。',
  {
    documentId,
    page,
    name: z.string().optional(),
    filePath: z.string().optional(),
    base64: z.string().max(30000000).optional(),
  },
  'attach_image',
);
tool(
  'page_notes_screenshot',
  '返回 PNG 图片和保存路径。scope 可选 workspace/document/note；word 截取当前 Word 原生编辑器（需先 read_word，不指定页码）。fullNote 截取长笔记，超长时用 nextOffset 继续。',
  {
    documentId,
    page: page.optional(),
    scope: z.enum(['workspace', 'document', 'note', 'word']).optional(),
    fullNote: z.boolean().optional(),
    maxHeight: z.number().int().min(400).max(16000).optional(),
    startOffset: z.number().int().min(0).optional(),
  },
  'screenshot',
  true,
);
tool(
  'page_notes_contact_sheet',
  '将指定页截图合并为带页码的 PNG 拼图，直接返回图像供多模态模型查看。',
  {
    documentId,
    pages: z.array(page).min(1).max(12),
    columns: z.number().int().min(1).max(4).optional(),
    scope: z.enum(['workspace', 'document', 'note']).optional(),
  },
  'contact_sheet',
  true,
);
server.registerResource(
  'current-state',
  'page-notes://state',
  {},
  async (uri) => {
    const result = await call('get_state', {});
    return {
      contents: [
        {
          uri: uri.href,
          mimeType: 'application/json',
          text: result.content[0].text,
        },
      ],
    };
  },
);
server.connect(new StdioServerTransport()).catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
