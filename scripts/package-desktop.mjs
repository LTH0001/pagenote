import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const cache =
  process.env.ELECTRON_BUILDER_CACHE || path.join(root, '.builder-cache');
await fs.mkdir(cache, { recursive: true });
const args = process.argv.includes('--dir') ? ['dir'] : ['nsis', 'zip'];
const child = spawn(
  process.execPath,
  [
    path.join(root, 'node_modules/electron-builder/cli.js'),
    '--win',
    ...args,
    '--x64',
    '--publish',
    'never',
  ],
  {
    cwd: root,
    stdio: 'inherit',
    windowsHide: true,
    env: { ...process.env, ELECTRON_BUILDER_CACHE: cache },
  },
);
child.on('error', (error) => {
  console.error(error.message);
  process.exitCode = 1;
});
child.on('exit', (code) => {
  process.exitCode = code ?? 1;
});
