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

## Page-by-page teaching

The development build exposes the bundled `SKILL.md` at `page-notes://skills/page-tutor` and as the MCP prompt `pagenote-page-tutor`. Optional string arguments are `learner` (background), `pages` (page range) and `goal`. Clients without prompt support can read the resource, or paste the skill from **AI Annotations → Copy page-by-page teaching prompt**. The original 17 document tools remain unchanged. The skill does not initiate model calls.

Use a separate model generation request for each source page. Complete, verify, save and inspect that page before requesting the next one. Do not generate the entire chapter in one answer and split it afterward. Batch MCP reads or writes do not count as separate model requests.

Each request needs the complete current page, relevant screenshots, the learner's background, a short chapter map and a concise handoff from the previous page. Preserve notation, examples and dependencies in the handoff, leaving enough context for detailed explanations of the current page. Begin from prior knowledge and end with a brief transition to the next page. Use formulas, runnable code, Mermaid or illustrations where they help.

Read revisions before writing and use expectedRevision. Check the saved page with a screenshot before continuing. Report actual completed pages and validations, without claiming tests or independent requests that were not performed.

The MCP initialization instructions include this policy; reconnect the client to receive updates. MCP cannot start model generations or manage a client's context window. If the client cannot issue independent requests, state that limitation and handle one page per user turn. See the [detailed Chinese workflow and request template](AI-TEACHING.zh-CN.md).

The local API listens on loopback. The MCP bridge checks a per-user token. This interface does not expose arbitrary JavaScript or shell-command execution, but grants the document-reading and editing capabilities listed by the tools. Data sent onward by your AI client follows that client's policies.

[中文 MCP 文档](../MCP接口说明.md)
