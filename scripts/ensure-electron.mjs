import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';

// Packaged-app tests already have a runtime. Electron 44 downloads its binary
// lazily, so source tests must prepare it before launching the binary directly.
if (!process.env.DESKTOP_EXE) {
  const require = createRequire(import.meta.url);
  const result = spawnSync(
    process.execPath,
    [require.resolve('electron/install.js')],
    {
      stdio: 'inherit',
      windowsHide: true,
    },
  );
  if (result.error) throw result.error;
  process.exitCode = result.status ?? 1;
}
