import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

export async function checkReleaseVersion(root, { release = false, tag } = {}) {
  const pkg = JSON.parse(
    await fs.readFile(path.join(root, 'package.json'), 'utf8'),
  );
  const lock = JSON.parse(
    await fs.readFile(path.join(root, 'package-lock.json'), 'utf8'),
  );
  const version = pkg.version;
  if (lock.version !== version || lock.packages?.['']?.version !== version)
    throw Error('package.json and package-lock.json versions differ');
  if (tag && tag !== 'v' + version)
    throw Error('Git tag does not match package version');
  if (release) {
    for (const file of ['README.md', 'README.en.md']) {
      const text = await fs.readFile(path.join(root, file), 'utf8');
      const tags = [
        ...text.matchAll(/releases\/(?:download|tag)\/v([^/\s)]+)/g),
      ].map((m) => m[1]);
      if (!tags.length || tags.some((v) => v !== version))
        throw Error(file + ' download/release links do not match ' + version);
      const declared = text
        .match(
          /(?:当前公开版本：|Current public version:\s*)([0-9][0-9A-Za-z.+-]*)/,
        )?.[1]
        ?.replace(/\.$/, '');
      if (declared && declared !== version)
        throw Error(file + ' public version text differs from ' + version);
    }
    const log = await fs.readFile(path.join(root, 'CHANGELOG.md'), 'utf8');
    const heading = log
      .split(/\r?\n/)
      .find((line) => line.startsWith('## ' + version + ' '));
    if (!heading || /unreleased|尚未发布/i.test(heading))
      throw Error('Release needs a dated changelog entry for ' + version);
  }
  return { version, tag: 'v' + version };
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  const tag =
    process.env.GITHUB_REF_TYPE === 'tag'
      ? process.env.GITHUB_REF_NAME
      : undefined;
  const result = await checkReleaseVersion(process.cwd(), {
    release: process.argv.includes('--release') || !!tag,
    tag,
  });
  console.log('PASS release version consistency: ' + result.version);
}
