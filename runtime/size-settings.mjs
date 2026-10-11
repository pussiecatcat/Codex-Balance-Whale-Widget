import nodeFs from 'node:fs';
import path from 'node:path';
import { atomicResourceWrite, readResourceJson } from '../lib/resource-store.mjs';

export const SIZE_SETTINGS_DEFAULTS = Object.freeze({
  scale: 1,
  sound: true,
  vol: 0.9,
  soundSet: 'duck',
  usageMode: 'ledger',
  bubbleOn: true,
  turnCostOn: true,
  turnCostCloseMs: 5000,
  scrollGapOn: false,
  scrollGapPx: 17,
  menuBtnHide: false,
});

const plainObject = value => value && typeof value === 'object' && !Array.isArray(value);
const finite = value => typeof value === 'number' && Number.isFinite(value);

export class SizeSettingsStore {
  constructor(dataDir, { fs = nodeFs } = {}) {
    this.dataDir = path.resolve(dataDir);
    this.fs = fs;
    this.candidates = [
      path.join(this.dataDir, '.dshw-size.json'),
      path.join(this.dataDir, 'profiles', 'web', '.dshw-size.json'),
    ];
  }

  owns(file) { return this.candidates.includes(path.resolve(file)); }

  file() {
    return this.candidates.find(candidate => this.fs.existsSync(candidate))
      || this.candidates.find(candidate => this.fs.existsSync(path.dirname(candidate)))
      || this.candidates[0];
  }

  snapshot() {
    const file = this.file();
    const document = readResourceJson(file, null, value => plainObject(value) && (!('scale' in value) || finite(value.scale)), { fs: this.fs });
    return { file, exists: document !== null, document: document === null ? null : structuredClone(document) };
  }

  normalize(document = {}) {
    const value = plainObject(document) ? document : {};
    return {
      scale: finite(value.scale) ? value.scale : SIZE_SETTINGS_DEFAULTS.scale,
      sound: value.sound !== false,
      vol: finite(value.vol) ? value.vol : SIZE_SETTINGS_DEFAULTS.vol,
      soundSet: typeof value.soundSet === 'string' && value.soundSet ? value.soundSet : SIZE_SETTINGS_DEFAULTS.soundSet,
      usageMode: 'ledger',
      bubbleOn: value.bubbleOn !== false,
      turnCostOn: value.turnCostOn !== false,
      turnCostCloseMs: finite(value.turnCostCloseMs) ? (value.turnCostCloseMs > 0 ? value.turnCostCloseMs : 0) : SIZE_SETTINGS_DEFAULTS.turnCostCloseMs,
      scrollGapOn: value.scrollGapOn === true,
      scrollGapPx: finite(value.scrollGapPx) ? Math.max(0, Math.round(value.scrollGapPx)) : SIZE_SETTINGS_DEFAULTS.scrollGapPx,
      menuBtnHide: value.menuBtnHide === true,
    };
  }

  read({ defaults = false } = {}) {
    const snapshot = this.snapshot();
    return snapshot.exists ? this.normalize(snapshot.document) : defaults ? this.normalize() : null;
  }

  prepare(input, { baseDocument } = {}) {
    if (!plainObject(input)) throw new Error('挂件设置格式无效');
    const base = baseDocument === undefined ? (this.snapshot().document || {}) : (baseDocument || {});
    if (!plainObject(base)) throw new Error('挂件设置基础数据无效');
    const merged = { ...base, ...input };
    if (!finite(merged.scale)) throw new Error('missing scale');
    const canonical = this.normalize(merged);
    return {
      document: { ...merged, ...canonical, updatedAt: new Date().toISOString() },
      settings: canonical,
    };
  }

  commit(prepared, { file = this.file(), backup = true } = {}) {
    if (!this.owns(file)) throw new Error('挂件设置路径无效');
    const document = prepared;
    if (!plainObject(document)) throw new Error('挂件设置格式无效');
    atomicResourceWrite(file, JSON.stringify(document, null, 2), { fs: this.fs, backup });
    return this.normalize(document);
  }

  restore(snapshot) {
    if (!snapshot || !this.owns(snapshot.file)) throw new Error('挂件设置恢复路径无效');
    if (snapshot.exists) this.commit(snapshot.document, { file: snapshot.file, backup: false });
    else {
      try { this.fs.unlinkSync(snapshot.file); }
      catch (error) { if (error.code !== 'ENOENT') throw error; }
    }
  }
}
