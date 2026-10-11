import path from 'node:path';
import nodeFs from 'node:fs';
import nodeFsPromises from 'node:fs/promises';
import { randomBytes } from 'node:crypto';

// Antivirus and search indexers briefly deny replacing a file another process
// holds open on Windows. Only those sharing and access failures are retried, so
// a real error still surfaces on its first occurrence, and the live file is
// never deleted to make room for the replacement.
export const RENAME_RETRY_CODES = Object.freeze(['EPERM', 'EBUSY', 'EACCES']);

// The sibling file a write is staged in. It carries the pid and a random suffix
// because two writers of the same target inside one process must not share a
// temporary; the rename that publishes it is atomic within a directory.
export function atomicTempPath(file) {
  return file + '.' + process.pid + '.' + randomBytes(6).toString('hex') + '.tmp';
}

function replaceSync(file, temp, { fs, retries }) {
  for (let attempt = 0; ; attempt++) {
    try { fs.renameSync(temp, file); return; }
    catch (error) {
      if (attempt >= retries || !RENAME_RETRY_CODES.includes(error.code)) throw error;
    }
  }
}

// The staged file is created exclusively and removed on every failure path, so
// a failed write neither truncates the live file nor leaves debris beside it.
// It is written through fs.writeFileSync rather than a descriptor of ours, so
// there is no handle to leak; when flush is set the staged bytes reach the disk
// before the rename, which is what a resource file needs.
export function writeFileAtomicSync(file, data, { fs = nodeFs, mode = 0o600, flush = false, retries = 2 } = {}) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const temp = atomicTempPath(file);
  try {
    fs.writeFileSync(temp, data, { flag: 'wx', mode, flush });
    replaceSync(file, temp, { fs, retries });
  } catch (error) {
    try { fs.unlinkSync(temp); } catch {}
    throw error;
  }
}

// The same contract for callers on a promise chain. abandon lets a caller that
// is shutting down drop the write instead of publishing it: the staged file is
// still removed and nothing is renamed over the target.
export async function writeFileAtomic(file, data, {
  fs = nodeFsPromises, mode = 0o600, flush = false, retries = 3, retryDelay = attempt => 10 * (attempt + 1), abandon = null,
} = {}) {
  if (abandon && abandon()) return;
  await fs.mkdir(path.dirname(file), { recursive: true });
  const temp = atomicTempPath(file);
  try {
    if (abandon && abandon()) return;
    await fs.writeFile(temp, data, { flag: 'wx', mode, flush });
    for (let attempt = 0; ; attempt++) {
      if (abandon && abandon()) return;
      try { await fs.rename(temp, file); return; }
      catch (error) {
        if (attempt >= retries || !RENAME_RETRY_CODES.includes(error.code)) throw error;
        await new Promise(resolve => setTimeout(resolve, retryDelay(attempt)));
      }
    }
  } finally {
    await fs.unlink(temp).catch(() => {});
  }
}
