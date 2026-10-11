import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { writeFileAtomicSync } from '../lib/atomic-write.mjs';

export const VERSION = '0.3.0';
export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const CODEX_HOME = path.resolve(process.env.CODEX_HOME || path.join(os.homedir(), '.codex'));
export const DATA_HOME = path.resolve(process.env.WHALE_HOME || path.join(CODEX_HOME, 'whale-widget'));

export function readJson(file, fallback) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, '')); }
  catch (error) {
    if (error.code === 'ENOENT') return structuredClone(fallback);
    throw new Error('本地数据文件损坏或不可读：' + path.basename(file));
  }
}

export function writeJson(file, data, { fs: fileSystem = fs } = {}) {
  writeFileAtomicSync(file, JSON.stringify(data, null, 2), { fs: fileSystem });
}

export function dayKey(ts = Date.now()) {
  return new Date(Number(ts) + 8 * 3600000).toISOString().slice(0, 10);
}

export const rounded = n => Math.round((Number(n) + Number.EPSILON) * 1e8) / 1e8;
