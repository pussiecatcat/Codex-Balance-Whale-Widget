import path from 'node:path';
import { readResourceJson, writeResourceJson, validResourceId, resourcePath, checkMediaBudget } from '../resource-store.mjs';
import { MEDIA_POLICY } from '../media-validation.mjs';

export const BODY_LIMITS = Object.freeze({
  roleImage: 30 * 1024 * 1024,
  rolePin: 8192,
  bubbleConfig: 512 * 1024,
  audioUpload: Math.ceil(MEDIA_POLICY.audioBytes / 3) * 4 + 4096,
  bubbleImageUpload: Math.ceil(MEDIA_POLICY.bubbleBytes / 3) * 4 + 4096,
});

export function createResourceDeps({ dataRoot, fs }) {
  const storageWarnings = new Map();
  function readLibrary(file, fallback, validate, strict = false, maxBytes) {
    try {
      const result = readResourceJson(file, fallback, validate, { fs, ...(maxBytes ? { maxBytes } : {}) });
      storageWarnings.delete(file);
      return result;
    } catch (error) {
      storageWarnings.set(file, error.message);
      if (strict) throw error;
      return structuredClone(fallback);
    }
  }
  function libraryWarning(file) {
    const warning = storageWarnings.get(file);
    return warning ? { warning, editable: false } : { editable: true };
  }
  function validEntries(entries) {
    return Array.isArray(entries) && entries.every(entry => entry && typeof entry === 'object' && validResourceId(entry.id)) && new Set(entries.map(entry => entry.id)).size === entries.length;
  }
  function mediaPath(dir, id, ext) { return resourcePath(dataRoot, dir, id, ext, { fs }); }
  function mediaBudget(bytes, count) { return checkMediaBudget(dataRoot, bytes, count, { fs }); }
  function readMediaBytes(file, maxBytes) {
    const stat = fs.lstatSync(file);
    if (!stat.isFile() || stat.isSymbolicLink() || stat.size > maxBytes) throw new Error('素材文件过大或不是普通文件');
    return fs.readFileSync(file);
  }
  function readBodyMax(req, maxBytes) {
    const body = (req && req.body) || Buffer.alloc(0);
    if (body.length > maxBytes) return Promise.reject(new Error('body too large'));
    return Promise.resolve(body.toString('utf8'));
  }
  return { dataRoot, fs, readLibrary, libraryWarning, validEntries, mediaPath, mediaBudget, readMediaBytes, readBodyMax, writeResourceJson };
}

export function idFromUrl(url) {
  try {
    const q = String(url || '').split('?')[1] || '';
    const m = /(?:^|&)id=([^&]+)/.exec(q);
    return m ? decodeURIComponent(m[1]) : '';
  } catch { return ''; }
}

export function resourceDir(dataRoot, name) {
  return path.join(dataRoot, name);
}
