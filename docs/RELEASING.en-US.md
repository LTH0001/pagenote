# GitHub release guide

## Upload source

Source repository: [laihong06/pagenote](https://github.com/laihong06/pagenote). End-user downloads are under [Releases](https://github.com/laihong06/pagenote/releases).

For an initial fork setup, use the following commands and substitute your account as needed:

```powershell
git init
git add .
git commit -m "Prepare pagenote beta release"
git branch -M main
git remote add origin https://github.com/laihong06/pagenote.git
git push -u origin main
```

Review `.gitignore`. Exclude generated builds, dependencies, private projects, test profiles, MCP credentials and signing keys. **Code → Download ZIP** is source code; end-user downloads belong in **Releases**.

## Build

On Windows x64 with Node.js 22+:

```powershell
npm ci
npm run build
npm run test:release
npm run package:desktop
node scripts/release-artifacts.mjs
```

Verify the setup EXE, Windows ZIP and `SHA256SUMS.txt` under `release/`. Test installation, upgrades, removal and project round trips using an independent Windows account or a clean VM.

## Publish

1. Update the version and lockfile.
2. Review tests and the readiness report.
3. Create a version tag such as `v2.0.0-beta.3`.
4. Run **Actions → Release artifacts**, or push the tag.
5. The workflow builds artifacts only; it does not publish a public Release automatically.
6. Download and inspect the artifacts. Create a draft Release with Chinese and English release notes, attach the EXE, ZIP and checksums, and mark beta versions as **pre-release**.
7. Clearly label prereleases and their validation limits while signing, security review and independent acceptance remain pending. Complete those checks before a stable release.

## Signing and detections

The local build is unsigned. Configure a valid signing identity following the [official signing guide](https://www.electron.build/docs/features/code-signing/code-signing-win/). Store secrets securely; never commit certificates or passwords.

A previous portable self-extracting build was blocked by Huorong. No vendor false-positive confirmation has been obtained. Changing packaging does not establish safety. Ask the relevant vendor to review the sample and report; never ask users to disable protection.

Document the distinction between source ZIP and distribution ZIP, local Office requirements, external MCP/AI requirements, complete-project portability, and retained user data on uninstall.

The beta configuration explicitly sets `build.win.signExecutable: false`. Before a signed release, change it to `true`, configure signing credentials, rebuild and verify the resulting signature.
