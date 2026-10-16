import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
const directory = path.resolve(process.argv[2] || 'release');
const files = (await fs.readdir(directory)).filter((name) =>
  /^pagenote-.*\.(exe|zip|dmg|blockmap)$/.test(name),
);
if (!files.length) throw Error('No release artifacts found.');
const lines = [];
for (const name of files) {
  const hash = createHash('sha256')
    .update(await fs.readFile(path.join(directory, name)))
    .digest('hex');
  lines.push(`${hash}  ${name}`);
}
await fs.writeFile(
  path.join(directory, 'SHA256SUMS.txt'),
  lines.join('\n') + '\n',
);
console.log(`Wrote checksums for ${files.length} artifacts.`);
