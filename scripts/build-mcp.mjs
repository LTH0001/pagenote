import { build } from 'esbuild';
import fs from 'node:fs/promises';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
function download(url) {
  const result = spawnSync(
    'curl',
    ['-fsSL', '--max-time', '60', '--retry', '1', url],
    { maxBuffer: 64 * 1024 * 1024 },
  );
  if (result.error || result.status !== 0 || !result.stdout)
    throw Error(`无法下载 Node.js 运行时：${result.stderr || result.error}`);
  return result.stdout;
}
await build({
  entryPoints: ['mcp/server.mjs'],
  bundle: true,
  platform: 'node',
  target: 'node20',
  format: 'cjs',
  outfile: 'mcp-dist/page-notes-mcp.cjs',
  logLevel: 'warning',
});
await fs.mkdir('mcp-dist', { recursive: true });
const runtime =
  process.platform === 'win32'
    ? { name: 'mcp-node.exe', label: 'mcp-node.exe' }
    : { name: 'mcp-node', label: 'mcp-node' };
// Stale artifacts from the other platform would be shipped alongside the
// current one, so drop both names before writing.
for (const stale of ['node.exe', 'mcp-node.exe', 'mcp-node'])
  await fs.rm(path.join('mcp-dist', stale), { force: true });
await fs.copyFile(process.execPath, path.join('mcp-dist', runtime.name));
let architectures = [process.arch];
if (process.platform === 'darwin') {
  const bundled = path.join('mcp-dist', runtime.name);
  const inspect = spawnSync('/usr/bin/lipo', ['-archs', bundled], {
    encoding: 'utf8',
  });
  if (inspect.status !== 0) throw Error('无法检查 MCP Node.js 运行时架构');
  if (!['arm64', 'x86_64'].every((arch) => inspect.stdout.includes(arch))) {
    // setup-node and most Node tarballs contain one architecture. Every Mac
    // distribution shares this resource, so build a universal runtime first.
    if (!/^v\d+\.\d+\.\d+$/.test(process.version))
      throw Error('打包需要正式 Node.js 版本');
    const cache = path.resolve(
      '.builder-cache',
      'node-universal',
      process.version,
    );
    await fs.mkdir(cache, { recursive: true });
    const base = `https://nodejs.org/dist/${process.version}`;
    const checks = download(`${base}/SHASUMS256.txt`).toString();
    const inputs = [];
    for (const arch of ['arm64', 'x64']) {
      const name = `node-${process.version}-darwin-${arch}`;
      const archive = name + '.tar.gz';
      const expected = checks
        .split('\n')
        .map((line) => line.trim().split(/\s+/))
        .find((parts) => parts[1] === archive)?.[0];
      if (!expected) throw Error('未找到 Node.js 运行时校验值：' + archive);
      const binary = path.join(cache, name, 'bin/node');
      let bytes;
      try {
        bytes = await fs.readFile(path.join(cache, archive));
      } catch {
        bytes = download(`${base}/${archive}`);
        await fs.writeFile(path.join(cache, archive), bytes);
      }
      if (createHash('sha256').update(bytes).digest('hex') !== expected)
        throw Error('Node.js 运行时校验失败：' + archive);
      const tar = path.join(cache, archive);
      const unpack = spawnSync(
        '/usr/bin/tar',
        ['-xzf', tar, '-C', cache, `${name}/bin/node`],
        { encoding: 'utf8', timeout: 60000 },
      );
      if (unpack.status !== 0)
        throw Error('无法解压 Node.js 运行时：' + unpack.stderr);
      inputs.push(binary);
    }
    const combined = spawnSync(
      '/usr/bin/lipo',
      ['-create', ...inputs, '-output', bundled],
      { encoding: 'utf8', timeout: 60000 },
    );
    if (combined.status !== 0)
      throw Error('无法合并双架构 MCP 运行时：' + combined.stderr);
  }
  const verified = spawnSync('/usr/bin/lipo', [
    bundled,
    '-verify_arch',
    'arm64',
    'x86_64',
  ]);
  if (verified.status !== 0) throw Error('MCP 运行时缺少 Mac 架构');
  await fs.chmod(bundled, 0o755);
  architectures = ['arm64', 'x64'];
}
await fs.writeFile(
  'mcp-dist/node-runtime.json',
  JSON.stringify({
    version: process.version,
    executable: runtime.label,
    architectures,
  }),
);
const license = path.join('mcp-dist', 'NODE-LICENSE.txt');
try {
  await fs.access(license);
} catch {
  let text;
  try {
    const response = await fetch(
      `https://raw.githubusercontent.com/nodejs/node/${process.version}/LICENSE`,
    );
    if (!response.ok) throw Error(`HTTP ${response.status}`);
    text = await response.text();
  } catch (error) {
    // Offline builds must still ship a license; fall back to the fetch client.
    const result = spawnSync(
      'curl',
      [
        '-fsSL',
        '--max-time',
        '60',
        `https://raw.githubusercontent.com/nodejs/node/${process.version}/LICENSE`,
      ],
      { encoding: 'utf8', maxBuffer: 1024 * 1024 },
    );
    if (result.error || result.status !== 0 || !result.stdout)
      throw Error(
        `无法读取 Node.js 运行时许可：${result.stderr || error.message}`,
      );
    text = result.stdout;
  }
  await fs.writeFile(license, text);
}
