# Project workflow

Every push must include an accompanying `CHANGELOG.md` update describing the user-visible changes or fixes in that push. Keep unreleased work under the current Unreleased section and distinguish local builds from public releases. Do not push code or documentation changes without a matching log entry.

A source push is not a binary release. Before publishing a version, pass `npm run check:release`, build and test the matching artifacts, and publish installer/ZIP/source/checksums under the same tag. Update public README download links only with that release. Never reuse a published version for different binary contents.

After a release, advance package.json and package-lock.json to the next development version when changing runtime behavior. Keep README downloads pinned to the last published release until the next complete release is available.

Release decisions follow docs/RELEASE-POLICY.md. The founder-approved early-stage gates supersede historical exhaustive acceptance checklists. Windows v1.0 is approved based on the founder-reported physical-machine test; macOS stays experimental. Record non-blocking defects/unverified environments in KNOWN_ISSUES.md; do not add indefinite all-environment gates or claim unperformed tests.
