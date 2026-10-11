// CommonJS compatibility facade; both sync and async implementations live in
// atomic-write.mjs. Node 24 and the pinned Electron runtime support require(ESM).
const { writeFileAtomicSync, atomicTempPath, RENAME_RETRY_CODES } = require('./atomic-write.mjs');
const RENAME_ATTEMPTS = 3;
function atomicWriteSync(file, bytes, { fs, mode = 0o600 } = {}) {
  return writeFileAtomicSync(file, bytes, { fs, mode, flush: true, retries: RENAME_ATTEMPTS - 1 });
}
function writeJsonSync(file, data, options) { return atomicWriteSync(file, JSON.stringify(data, null, 2), options); }
module.exports = { atomicWriteSync, writeJsonSync, temporaryPathFor: atomicTempPath, RENAME_RETRY_CODES, RENAME_ATTEMPTS };
