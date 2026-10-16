# macOS Office Parity Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans and test-driven development for each task. Independent Office/native tasks may run through superpowers:dispatching-parallel-agents.

**Goal:** Restore macOS Office and desktop functionality, then adapt to remote updates.

**Architecture:** A native Office bridge supplies conversion and document operations. A Mac Word host supplies working-copy, revision, recovery and commit policy using the existing desktop interface. Native lifecycle changes remain independent.

**Tech Stack:** Electron, Node.js 22+, AppleScript, installed Microsoft Office, Playwright.

**Spec:** `docs/superpowers/specs/2026-10-16-mac-office-parity-design.md`

## Global Constraints

- Preserve existing Windows behavior, project formats and local edits.
- Never force-quit Office or change its security preferences.
- Test with synthetic temporary files and isolated application profiles.
- Current checkout is retained because it contains the user's existing Mac port. Baseline is recoverable at `refs/codex-backups/mac-office-before-20261016` and `tmp/mac-parity-baseline-20261016/`. Work occurs on `codex/mac-office-parity`.

## Review Focus

- Conversion failure must not replace an original or discard its working copy.
- User edits after a Word revision was read must reject stale replacements/commits.
- Opening, saving or capturing a project must retain its latest linked source and notes.
- Window close, Finder open and explicit quit must not race or strand background processes.
- Packaged scripts, missing Office and automation denial must produce the same controlled behavior as development.

### Task 1: Native Office bridge

**Files:** `desktop/mac-office.cjs`, `desktop/mac-office.applescript`, `desktop/mac-powerpoint.applescript`, `tests/mac-office.mjs`.

**Interface:** `createMacOffice({data,scriptPath?,timeoutMs?})` produces `convert(input,output)`, `readWord(file)`, `selectionWord(file)`, `replaceWord(file,args)`, `saveWord(file)`, `closeWord(file,{save})`, `statusWord(file)`, `exportWord(file,output)`.

- [ ] Write and run failing behavior tests.
- [ ] Implement sandbox-aware paths, exact document targeting and serialized bounded automation.
- [ ] Verify real Word/PPT conversions and Word read/edit/save on temporary fixtures.

### Task 2: Word host and application integration

**Files:** `desktop/mac-word.cjs`, `desktop/word.cjs`, `server.mjs`, `src/main.js`, `desktop/ai.cjs`, `tests/mac-word-host.mjs`, `tests/mac-office-app.mjs`, packaging and documentation.

- [ ] Test working-copy commit, conflict/revision rejection and export-failure recovery before implementing the host.
- [ ] Share the converter across imports, projects and external refresh; dispatch Word host by platform.
- [ ] Render Mac Word screenshots through the exported PDF; preserve project changes before reopening.
- [ ] Package scripts and automation metadata; verify the app's real Office/MCP round trip.

### Task 3: Native desktop parity

**Files:** `desktop/main.cjs`, project launcher/helper, `src/annotations.js`, native/menus/project tests.

- [ ] Add failing Finder, lifecycle, menu and deletion tests.
- [ ] Implement early file events, Dock activation, save-and-hide close, explicit quit and standard Mac menus.
- [ ] Verify isolated native tests and common release tests.

### Task 4: Integration, remote changes and final verification

- [ ] Run build, release suite, MCP suite, Mac Office and packaged smoke checks.
- [ ] Inspect all changes and create a local checkpoint excluding unrelated files.
- [ ] Fetch origin, inspect new commits, integrate compatible upstream changes and resolve conflicts.
- [ ] Repeat affected checks and perform a fresh review; report exact validation and any remaining platform limits.
