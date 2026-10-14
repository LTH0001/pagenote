# MCP integration

Start pagenote, then choose **AI Annotations → Copy MCP configuration**. Add that JSON configuration to your external AI client's MCP settings. Keep pagenote running. The desktop distribution includes the adapter and Node.js runtime; end users do not need npm.

**AI Annotations → Open MCP configuration folder** opens the local configuration directory. Connection credentials remain on the machine. Do not upload `ai-connection.json`, `ai-key.txt`, or your user-data folder to GitHub.

The existing `page_notes_*` tool names and `page-notes://state` resource remain compatible with older clients. The MCP server identifies itself as **pagenote** with the application version.

| Tool | Purpose |
| --- | --- |
| `page_notes_list_documents` | List document IDs |
| `page_notes_get_state` | Inspect the active document, notes, layout and geometry |
| `page_notes_read_pages` | Read page source/notes and revisions |
| `page_notes_navigate` | Navigate the visible workspace |
| `page_notes_write_notes` | Replace one or multiple page notes |
| `page_notes_patch_note` | Append or replace exact note text |
| `page_notes_get_layout` / `page_notes_set_layout` | Read/change paper width, typography and layout |
| `page_notes_import_document` | Import a local supported source file |
| `page_notes_create_markdown` | Create a Markdown source |
| `page_notes_attach_image` | Insert a local/base64 image into notes |
| `page_notes_screenshot` | Capture source, notes or a long-note image |
| `page_notes_contact_sheet` | Merge up to 12 page screenshots into a labelled grid |

Discover the complete current tool list through MCP; additional tools cover AI annotations and native Word integration. Use the returned `revision` as `expectedRevision` when changing notes to avoid overwriting concurrent user edits. An authenticated client can modify content directly; connect only a client you trust.

Screenshots return PNG image content suitable for multimodal models. Screenshot rendering uses a hidden workspace and should preserve the user's visible reading position. No model, subscription, cloud account or automatic AI service is included.

The local API listens on loopback. The MCP bridge checks a per-user token. This interface does not expose arbitrary JavaScript or shell-command execution, but grants the document-reading and editing capabilities listed by the tools. Data sent onward by your AI client follows that client's policies.

[中文 MCP 文档](../MCP接口说明.md)
