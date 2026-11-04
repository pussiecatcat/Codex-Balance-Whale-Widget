import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { domainError } from '../lib/errors.mjs';
import { writeFileAtomicSync } from '../lib/atomic-write.mjs';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// The release manifest owns the version. `.codex-plugin/plugin.json` carries the
// install identity the launchers compare — base version plus an optional
// `+codex.<build>` suffix — so the base is derived from it rather than repeated
// here, where a second literal could drift from it unnoticed. package.json keeps
// its own copy for npm metadata; tests/release-version.test.mjs asserts the two
// agree so a bump in one place cannot land half-applied.
function baseVersion() {
  try {
    const raw = fs.readFileSync(path.join(ROOT, '.codex-plugin', 'plugin.json'), 'utf8').replace(/^\uFEFF/, '');
    const base = String(JSON.parse(raw).version || '').split('+')[0].trim();
    if (/^\d+\.\d+\.\d+/.test(base)) return base;
  } catch {}
  return '0.0.0';
}
export const VERSION = baseVersion();
export const CODEX_HOME = path.resolve(process.env.CODEX_HOME || path.join(os.homedir(), '.codex'));
export const DATA_HOME = path.resolve(process.env.WHALE_HOME || path.join(CODEX_HOME, 'whale-widget'));

export function readJson(file, fallback, { backup = false, onRecover = null } = {}) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, '')); }
  catch (error) {
    if (error.code === 'ENOENT') return structuredClone(fallback);
    if (backup) {
      try {
        const value = JSON.parse(fs.readFileSync(file + '.bak', 'utf8'));
        onRecover?.();
        return value;
      } catch {}
    }
    throw domainError('本地数据文件损坏或不可读：' + path.basename(file));
  }
}

export function writeJson(file, data, { fs: fileSystem = fs, flush = false, backup = false } = {}) {
  if (backup) {
    try {
      // Stage and flush the backup before replacing the live file: a crash can
      // then leave at worst an older duplicate, never a half-written backup.
      const previous = fileSystem.readFileSync(file, 'utf8');
      writeFileAtomicSync(file + '.bak', previous, { fs: fileSystem, flush: true });
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }
  }
  writeFileAtomicSync(file, JSON.stringify(data, null, 2), { fs: fileSystem, flush });
}

// Accounting days are anchored to UTC+8 rather than the host timezone. That
// boundary is already baked into every ledger written so far, so re-deriving it
// under a different one would silently re-bucket history; the offset is named
// and exported so callers can do day arithmetic in the same frame instead of
// mixing it with local-time Date methods.
export const DAY_OFFSET_MS = 8 * 3600000;
export const DAY_MS = 86400000;
export function dayKey(ts = Date.now()) {
  return new Date(Number(ts) + DAY_OFFSET_MS).toISOString().slice(0, 10);
}

export const rounded = n => Math.round((Number(n) + Number.EPSILON) * 1e8) / 1e8;
