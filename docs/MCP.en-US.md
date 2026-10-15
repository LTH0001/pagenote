# MCP integration

Start pagenote, then choose **AI Annotations → Copy MCP configuration**. Add that JSON configuration to your external AI client's MCP settings. Keep pagenote running. The desktop distribution includes the adapter and Node.js runtime; end users do not need npm.

**AI Annotations → Open MCP configuration folder** opens the local configuration directory. Connection credentials remain on the machine. Do not upload `ai-connection.json`, `ai-key.txt`, or your user-data folder to GitHub.

The existing `page_notes_*` tool names and `page-notes://state` resource remain available. The development build changes default response scope: request `detail=full` for the previous full state and `include=both` for source plus notes. Public beta.4 does not yet include these options. The MCP server identifies itself as **pagenote** with the application version.

| Tool | Purpose |
| --- | --- |
| `page_notes_list_documents` | List document IDs |
| `page_notes_get_state` | Compact document/page/mode by default; `detail=full` includes content and geometry |
| `page_notes_read_pages` | Source by default; selective notes, metadata, ranges and revision caching |
| `page_notes_prepare_page` | Local OCR, positioned text, page/region images and native Markdown table/Mermaid assets |
| `page_notes_read_handoff` / `page_notes_write_handoff` | Persistent page handoffs with staleness checks |
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

The development build exposes the bundled `SKILL.md` at `page-notes://skills/page-tutor` and as the MCP prompt `pagenote-page-tutor`. Optional string arguments are `learner` (background), `pages` (page range) and `goal`. Clients without prompt support can read the resource, or paste the skill from **AI Annotations → Copy page-by-page teaching prompt**. There are now 22 tools, including page preparation and two handoff tools. The skill does not initiate model calls.

## Token-efficient reads

Use `page_notes_prepare_page` for offline OCR and reusable text, coordinates, images and native Markdown table/Mermaid assets. Models ship locally; sources and visuals are preserved with confidence and warnings. See [local preparation](LOCAL-PREPARATION.md). This does not guarantee lossless semantic extraction.

Omit `pages` to read the active page (page 1 for an explicitly selected inactive document). `include` accepts `source` (default), `note`, `both` or `metadata` (note revision/length only). Source has `sourceRevision`; notes have `revision` and `noteLength`. `noteRange: {start: 120, maxChars: 800}` returns only that UTF-16 slice with its actual `range`, while revision always refers to the complete note. Cache content by document ID, page and kind, then pass `knownRevisions: {"6": {source: "hash", note: "hash"}}`; matching content is omitted and marked `sourceUnchanged` / `noteUnchanged`.

After saving each note, call `page_notes_write_handoff` with `page`, `summary`, the latest note `expectedRevision` and optionally `sourceRevision`. Keep handoffs concise (usually under about 1,000 characters, maximum 4,000 UTF-16 units). `page_notes_read_handoff` returns the saved summary and `stale` if source or notes changed; a missing handoff is `null`. Handoffs persist in `src/ai-handoffs.json` inside portable projects and survive restarts. Recheck stale handoffs before using them. Write results omit the submitted content; all tool JSON is compact. Clients must still manage their own chat history and model-request boundaries.

Use a separate model generation request for each source page. Complete, verify, save and inspect that page before requesting the next one. Do not generate the entire chapter in one answer and split it afterward. Batch MCP reads or writes do not count as separate model requests.

Each request needs the complete current page, relevant screenshots, the learner's background, a short chapter map and a concise handoff from the previous page. Preserve notation, examples and dependencies in the handoff, leaving enough context for detailed explanations of the current page. Begin from prior knowledge and end with a brief transition to the next page. Use formulas, runnable code, Mermaid or illustrations where they help.

Read revisions before writing and use expectedRevision. Check the saved page with a screenshot before continuing. Report actual completed pages and validations, without claiming tests or independent requests that were not performed.

Default instructions route relevant learning tasks to the skill without forcing summaries or translations into a teaching workflow. **Settings → AI settings** lets users edit, save or restore the default system prompt; reconnect the client to apply it. The setting stays in the local document-data directory as `ai-settings.json`, outside portable projects. MCP initialization supplies these instructions, while the client controls their instruction level. Tool permissions remain unchanged.

MCP cannot start model generations or manage a client's context window. If the client cannot issue independent requests, state that limitation and handle one page per user turn. See the [detailed Chinese workflow and request template](AI-TEACHING.zh-CN.md).

The local API listens on loopback. The MCP bridge checks a per-user token. This interface does not expose arbitrary JavaScript or shell-command execution, but grants the document-reading and editing capabilities listed by the tools. Data sent onward by your AI client follows that client's policies.

[中文 MCP 文档](../MCP接口说明.md)

## Prompt routing and preflight

Start with `page-notes://prompts/index`, a small task map and module revision list. Initial teaching uses learning/page-tutor/output; AI Tag edits use tag-edit/output, with learning only when reteaching. Read a module with `page_notes_read_prompt({id, knownRevision?})`. Matching revisions omit text; omit knownRevision if its body is no longer in context. The index and modules are read live, so module overrides from AI settings apply without reconnecting. The system prompt still requires reconnection.

Page requests use current, previous and next **source** pages. They do not wait for previous generated notes or mandatory handoffs. Recommend `max(1, floor(total pages / 10))` workers, capped by remaining work, client/service limits and resources. Handoffs remain optional for cross-session continuity.

Before saving generated Markdown, call `page_notes_validate_note({markdown})`. It returns `valid`, `normalizedMarkdown`, errors, warnings and counts without saving or navigating. It detects malformed math, unclosed fences, invalid Mermaid and broken local image attachments. External image URLs are not fetched and are reported as unverified warnings. Use revision-protected writes after preflight. This checks syntax and assets, not semantic correctness or universal device compatibility.
