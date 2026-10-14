import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const { migrateLegacyData } = createRequire(import.meta.url)(
  '../desktop/migration.cjs',
);
const profile = path.join(import.meta.dirname, 'migration-data-' + Date.now());
const target = path.join(profile, 'pagenote'),
  legacy = path.join(profile, 'legacy');
await fs.mkdir(target, { recursive: true });
await fs.mkdir(path.join(legacy, 'documents-data'), { recursive: true });
await fs.writeFile(
  path.join(legacy, 'documents-data', 'note.json'),
  'original',
);
assert.equal(await migrateLegacyData(target, legacy), true);
assert.equal(
  await fs.readFile(path.join(target, 'documents-data', 'note.json'), 'utf8'),
  'original',
);
await fs.writeFile(path.join(target, 'documents-data', 'note.json'), 'edited');
assert.equal(await migrateLegacyData(target, legacy), false);
assert.equal(
  await fs.readFile(path.join(target, 'documents-data', 'note.json'), 'utf8'),
  'edited',
);
assert.equal(
  await fs.readFile(path.join(legacy, 'documents-data', 'note.json'), 'utf8'),
  'original',
);
console.log(
  'PASS legacy data migration into an empty existing profile; existing data and legacy store preserved.',
);

// Windows may reject the final directory rename with EXDEV, even when both
// visible paths appear on the same volume. Exercise the copy fallback directly.
const sharedFs = createRequire(import.meta.url)('node:fs/promises');
const originalRename = sharedFs.rename;
const copyTarget = path.join(profile, 'cross-device');
try {
  sharedFs.rename = async () => {
    const error = new Error('Simulated cross-device rename');
    error.code = 'EXDEV';
    throw error;
  };
  assert.equal(await migrateLegacyData(copyTarget, legacy), true);
} finally {
  sharedFs.rename = originalRename;
}
assert.equal(
  await fs.readFile(path.join(copyTarget, 'documents-data/note.json'), 'utf8'),
  'original',
);
assert.equal(await migrateLegacyData(copyTarget, legacy), false);

// A partial fallback must resume without replacing already-edited destination
// files, and must not skip the still-missing files just because the folder exists.
await fs.writeFile(
  path.join(copyTarget, 'documents-data/note.json'),
  'user edit',
);
await fs.writeFile(
  path.join(copyTarget, 'documents-data.migration/remaining.json'),
  'remaining',
);
await fs.writeFile(
  path.join(copyTarget, '.legacy-migration-copy-pending'),
  'pending',
);
assert.equal(await migrateLegacyData(copyTarget, legacy), true);
assert.equal(
  await fs.readFile(path.join(copyTarget, 'documents-data/note.json'), 'utf8'),
  'user edit',
);
assert.equal(
  await fs.readFile(
    path.join(copyTarget, 'documents-data/remaining.json'),
    'utf8',
  ),
  'remaining',
);
assert.equal(
  await fs.readFile(path.join(legacy, 'documents-data/note.json'), 'utf8'),
  'original',
);
console.log(
  'PASS EXDEV copy fallback and partial-copy resume preserve existing edits and the legacy source.',
);
