const fs = require('node:fs/promises');
const path = require('node:path');
async function exists(file) {
  try {
    await fs.access(file);
    return true;
  } catch (error) {
    if (error.code === 'ENOENT') return false;
    throw error;
  }
}

// Electron may create the new profile directory before ready; check the actual
// document store so that an otherwise empty profile still receives legacy data.
async function migrateLegacyData(target, legacy) {
  const destination = path.join(target, 'documents-data');
  const source = path.join(legacy, 'documents-data');
  const staging = destination + '.migration';
  const pending = path.join(target, '.legacy-migration-copy-pending');
  // Resume an interrupted cross-device copy without replacing any user files.
  if (await exists(pending)) {
    await fs.cp(staging, destination, { recursive: true, force: false });
    await fs.unlink(pending);
    return true;
  }
  try {
    await fs.access(destination);
    return false;
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
  try {
    await fs.access(source);
  } catch (error) {
    if (error.code === 'ENOENT') return false;
    throw error;
  }
  await fs.mkdir(target, { recursive: true });
  await fs.cp(source, staging, { recursive: true, force: true });
  try {
    await fs.rename(staging, destination);
  } catch (error) {
    if (error.code !== 'EXDEV') throw error;
    await fs.writeFile(
      pending,
      'Copy staged legacy data without overwriting.\n',
    );
    await fs.cp(staging, destination, { recursive: true, force: false });
    await fs.unlink(pending);
    // Retain staging as a recovery copy; the legacy source is also unchanged.
  }
  return true;
}
module.exports = { migrateLegacyData };
