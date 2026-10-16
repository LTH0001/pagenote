# macOS Office and desktop parity

The user approved the locally proven AppleScript approach and requested implementation, restoration of the identified Windows/macOS differences, and then adaptation to new remote commits.

## Behavior

- Word and PowerPoint imports convert through the installed macOS Office applications. The same converter handles project previews and refresh after editing in the default application.
- Word MCP reads, selections and revision-checked replacements operate on a dedicated working copy. Commit retains source history and updates the preview. Failed conversion or conflicting source changes preserve the working copy and original data.
- macOS edits use a separate Word window. Word screenshots use an exported PDF rendered by the existing hidden inspector, avoiding screen-recording permission and Windows window embedding.
- Finder cold/warm file opens feed the existing project queue. Standard macOS menus, Command shortcuts, Backspace annotation deletion and Dock/window lifecycle are supported. Explicit quit saves and exits; normal window close saves and hides on macOS.
- Existing Windows Office behavior and project/MCP formats remain compatible. Missing Office, denied automation and timeouts produce actionable errors. Automation never force-quits an application or changes Office security preferences.

## Integration

Keep native scripting in a small macOS Office bridge and Word session policy in a separate host. Share the converter between all server entry points. Package the AppleScript resources and automation usage description. Only use application-owned export locations; do not require Node access to Office's private user data.

## Validation and remote adaptation

Use isolated synthetic samples for Office and Electron integration tests, including failed export recovery, stale revisions, source conflicts, project persistence, Finder events, explicit quit and Word PDF screenshots. Run release/MCP tests and a packaged Mac smoke test. Then fetch the configured remote, merge relevant upstream changes on the feature branch, and repeat affected checks. Preserve pre-existing local changes; do not push or publish without a separate request.
