import fs from 'node:fs/promises';
import path from 'node:path';
const seen = new Set(),
  notices = [],
  bundled = [
    'express',
    'multer',
    'pngjs',
    'pdfjs-dist',
    '@modelcontextprotocol/sdk',
    'zod',
    'dompurify',
    'highlight.js',
    'katex',
    'marked',
    'marked-katex-extension',
    'mermaid',
    'turndown',
    'turndown-plugin-gfm',
  ];
async function visit(name, parent = '.') {
  let directory = path.join(parent, 'node_modules', name);
  try {
    await fs.access(path.join(directory, 'package.json'));
  } catch {
    directory = path.join('node_modules', name);
  }
  let pkg;
  try {
    pkg = JSON.parse(
      await fs.readFile(path.join(directory, 'package.json'), 'utf8'),
    );
  } catch {
    return;
  }
  const key = pkg.name + '@' + pkg.version;
  if (seen.has(key)) return;
  seen.add(key);
  let license = '';
  for (const file of await fs.readdir(directory)) {
    if (/^licen[cs]e(?:\.|$)/i.test(file)) {
      try {
        license +=
          '\n' + (await fs.readFile(path.join(directory, file), 'utf8'));
      } catch {}
    }
  }
  notices.push(
    `${key}\nDeclared license: ${typeof pkg.license === 'string' ? pkg.license : JSON.stringify(pkg.license || 'NOT DECLARED')}\n${license || 'License text not found at package root; review required.'}\n`,
  );
  for (const dependency of Object.keys(pkg.dependencies || {}))
    await visit(dependency, directory);
}
for (const name of bundled) await visit(name);
await fs.writeFile(
  'THIRD-PARTY-NOTICES.txt',
  'pagenote third-party notices\nGenerated package inventory; review additional font, binary and asset notices before distribution.\n\n' +
    notices.sort().join('\n------------------------------\n'),
);
console.log(`Collected ${seen.size} package notices.`);
