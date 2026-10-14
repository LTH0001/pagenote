import { build } from 'esbuild';
import fs from 'node:fs/promises';
await build({
  entryPoints: ['mcp/server.mjs'],
  bundle: true,
  platform: 'node',
  target: 'node20',
  format: 'cjs',
  outfile: 'mcp-dist/page-notes-mcp.cjs',
  logLevel: 'warning',
});
await fs.copyFile(process.execPath, 'mcp-dist/node.exe');
await fs.writeFile(
  'mcp-dist/node-runtime.json',
  JSON.stringify({ version: process.version }),
);
try {
  await fs.access('mcp-dist/NODE-LICENSE.txt');
} catch {
  const response = await fetch(
    `https://raw.githubusercontent.com/nodejs/node/${process.version}/LICENSE`,
  );
  if (!response.ok) throw Error('无法读取 Node.js 运行时许可');
  await fs.writeFile('mcp-dist/NODE-LICENSE.txt', await response.text());
}
