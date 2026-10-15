# pagenote

<img src="build/icon.png" alt="pagenote paired-page icon" width="88">

English · [简体中文](README.md)

pagenote started as a small tool I wanted for my own learning. The source material goes on the left, and an explanation of that page goes on the right, so I can read them together.

## Why I am making it

Asking AI to explain a paper or a slide deck is ordinary now. Actually learning from that explanation still involves a surprising amount of friction.

I keep ending up with two windows: the document in one, a long AI conversation in the other. I scroll back to check a formula, lose my place in the explanation, and sometimes have to work out which page the answer refers to. AI may also rearrange the material to suit its answer, which makes following the original lesson harder.

Asking for the whole document at once does not always help. Context limits, answer length and the way the task is framed can turn a detailed lesson into a chapter summary. The main points are there, but the small steps that make them understandable are missing.

What I want is for each page to get proper attention—as if I had asked about that page on its own. Start with what I already know, explain the next step carefully, then carry that understanding into the following page.

Revision matters too. Sometimes there are too many formulas, an example does not click, or a paragraph moves too quickly. I want to select the passage or draw a box around a figure, write “I did not understand this; try another example,” and let AI see exactly what needs work.

**pagenote brings that process into one workspace: read beside the source, learn page by page, leave feedback where it belongs, and keep improving the notes.**

## The learning experience I want

An explanation should not have to be a wall of text. Use an illustration when it helps, runnable code when something can be tested, formulas for a derivation, and a flowchart for a process. The point is to make the idea clearer, rather than fill the page with every available format.

The intended workflow is simple:

1. Open the material on the left and work through it page by page.
2. Ask AI for a careful explanation of the current page, with examples and a connection to the surrounding pages.
3. Select text or an area and leave an AI annotation wherever something needs another pass.
4. Let AI read that feedback and revise the relevant explanation. Keep the result as a local learning project.

That is why the app uses two panes and page-linked notes. I want the learner to set the pace, with AI helping make each step understandable.

pagenote currently provides the workspace and an MCP interface. **It does not bundle an AI model or automatically generate a complete lesson on import.** A connected AI client handles the page-by-page work, context planning and any image generation. The app keeps the source, explanations and feedback together so that work can continue.

**Current public version: 2.0.0-beta.4.** It is still a beta. Try it with something you are actually learning, and let me know where it gets in your way.

## Download and install

[Windows x64 installer](https://github.com/laihong06/pagenote/releases/download/v2.0.0-beta.4/pagenote-2.0.0-beta.4-windows-x64-setup.exe) · [Complete Windows ZIP](https://github.com/laihong06/pagenote/releases/download/v2.0.0-beta.4/pagenote-2.0.0-beta.4-windows-x64.zip) · [Release notes and checksums](https://github.com/laihong06/pagenote/releases/tag/v2.0.0-beta.4)

1. Download `pagenote-VERSION-windows-x64-setup.exe` from this repository's **Releases**. **Code → Download ZIP** contains source code, not an installer.
2. Run the installer and choose a location. Installation is per user and normally does not require administrator privileges.
3. Launch **pagenote** from the desktop or Start menu.
4. Choose Simplified Chinese or English under **Settings → Language / 语言**.

Alternatively, extract the complete Windows ZIP distribution and run `pagenote.exe`. Keep its accompanying resources together.

Releases should include `SHA256SUMS.txt` and pass security review. The current local build has no publisher signature. If security software blocks it, stop and report the detection; **do not disable protection or add an exclusion**.

## Features

- Read PDFs and Markdown; convert Word/PowerPoint documents through locally installed Microsoft Office.
- Source editing opens Word/PDF/PPT in your system default app. Save and return to pagenote to refresh the preview; PDF editing depends on that app.
- Notes follow the active source page as page boundaries cross the viewport midpoint.
- Rendered Markdown editing with live syntax highlighting, LaTeX, pasted images, tables and Mermaid.
- **Select** text or an area and add an **AI annotation**. **Hand** pans the page. **Pen** provides ink, highlighting and erasing.
- Double-click an annotation number to open its canvas; right-click to delete. Canvases stay hidden until opened from **AI Annotations**.
- Use **Edit → Choose editing pane**, then click the source or notes pane.
- Ctrl + mouse wheel zooms the current pane. Notes zoom changes the displayed font size.
- Automatic note history and restore. Projects, ink and annotations stay on the local machine.
- MCP integration for reading documents, editing notes, adjusting layout, screenshots and contact sheets. No AI model or AI subscription is bundled. Configure a compatible external client; data shared with it is governed by that client's privacy policy.

## Portable projects

Create a project using **File → New project** and choose its name and folder:

```text
My project/
  project.pagenote          # JSON manifest with relative links
  src/
    left.md                # Source: may become left.pdf, left.docx, etc.
    right.md               # Page notes separated by <!-- pagebreak -->
    assets/                # Images and attachments
    annotations.json       # Ink, created when used
    ai-reviews.json         # AI annotations, created when used
```

With the installed app, double-click `project.pagenote`, or choose it under **File → Open project**. For a ZIP distribution without an association, run `register-project-files.cmd` in the newer distribution folder once. Register again after moving the app. If Windows already has another default, choose pagenote under **Open with**.

Legacy `project.page-notes.json` files remain supported through the app. The `left` and `right` links are read on opening. Move the complete folder, not just its manifest.

The brand is now pagenote. When the legacy document store exists and the new document store does not, data is copied while preserving the legacy folder. Existing projects do not need to be renamed or rebuilt.

Beta.3 fixes migration, staged file replacement and cross-volume copy failures in some encrypted or redirected Windows data folders. Interrupted copies retain recovery files; these fallback paths cannot offer the same power-loss guarantees as atomic renames.

## Requirements

- Windows 10/11 x64. Other platforms and ARM64 are not yet validated.
- Office is optional for PDF/Markdown; Word/PPT conversion requires Microsoft Office.
- The distribution includes the Node.js runtime used by MCP. End users do not need a Node.js installation.

## Build from source

Install Node.js 22.13 or newer, then run:

```powershell
npm ci
npm run build
npm run desktop
```

Use `npm run dev` for browser development, `npm run package:desktop` for the Windows installer and ZIP, or `npm run package:dir` for a folder build.

See the [release guide](docs/RELEASING.en-US.md), [terminology specification](docs/TERMINOLOGY.md) and [release-readiness report](docs/RELEASE-READINESS.md). Bug reports should include the version, Windows version, reproduction steps and redacted logs. Do not upload private projects or MCP connection keys.

## License

[MIT License](LICENSE), including commercial use. Dependencies have separate licenses; retain `THIRD-PARTY-NOTICES.txt`, the Node.js license and Electron/Chromium license files when distributing. Microsoft Office licensing is the user's responsibility.

MCP integration: [English](docs/MCP.en-US.md) · [中文](MCP接口说明.md)

Editor and icon changes: [reference](docs/EDITOR-REFERENCE.md).
Standalone imports edit the managed local copy; projects edit the linked file in `src`. Save, then return to pagenote.
