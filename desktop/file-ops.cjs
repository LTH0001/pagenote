const fs = require('node:fs/promises');
const { randomUUID } = require('node:crypto');
const { createReadStream, createWriteStream, constants } = require('node:fs');
const { pipeline } = require('node:stream/promises');

async function copyFileSafe(source, destination, flags = 0) {
  try {
    await fs.copyFile(source, destination, flags);
  } catch (error) {
    if (!['UNKNOWN', 'EXDEV', 'ENOTSUP', 'EPERM'].includes(error.code))
      throw error;
    // EFS files can be readable yet reject native cross-volume CopyFile.
    // Streaming transfers readable bytes without carrying encryption metadata.
    await pipeline(
      createReadStream(source),
      createWriteStream(destination, {
        flags: flags & constants.COPYFILE_EXCL ? 'wx' : 'w',
      }),
    );
  }
}

// Prefer atomic replacement. Windows can reject rename with EXDEV in redirected
// or encrypted profiles; keep a recovery copy before using copy-and-delete.
async function moveFile(source, destination) {
  try {
    await fs.rename(source, destination);
    return;
  } catch (error) {
    if (error.code !== 'EXDEV') throw error;
  }
  const backup = destination + '.replace-backup-' + randomUUID();
  let backedUp = false;
  try {
    await copyFileSafe(destination, backup);
    backedUp = true;
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
  try {
    await copyFileSafe(source, destination);
  } catch (error) {
    // Leave both the staged write and old-file backup available for recovery.
    if (backedUp) {
      await copyFileSafe(backup, destination).catch(() => {});
      error.message += ' (Recovery copy: ' + backup + ')';
    }
    throw error;
  }
  await fs.unlink(source);
  if (backedUp) await fs.unlink(backup).catch(() => {});
}

module.exports = { moveFile, copyFileSafe };
