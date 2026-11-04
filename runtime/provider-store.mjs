import fs from 'node:fs';
import path from 'node:path';
import { readJson, writeJson } from './paths.mjs';
import { domainError } from '../lib/errors.mjs';

// The Codex API settings and the DIY model registry used to live in two files
// (`api-settings.json` and `api-models.json`) with no shared transaction. They
// are one concept — "which provider answers which question" — so both now read
// and write a single `providers.json`. The legacy files are still read until
// the first write, which keeps upgrades from losing an existing configuration;
// that first write also leaves `providers.legacy-backup.json` behind.
export const PROVIDER_STORE_FILE = 'providers.json';
export const PROVIDER_LEGACY_CONFIG = 'api-settings.json';
export const PROVIDER_LEGACY_MODELS = 'api-models.json';

function fileStamp(file) {
  try { return fs.statSync(file).mtimeMs; } catch { return 0; }
}

function isRecord(value) {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function emptyData() {
  return { version: 2, codexApi: {}, diyModels: [] };
}

export class ProviderStore {
  constructor({ dataDir } = {}) {
    this.dataDir = dataDir;
    this.file = path.join(dataDir, PROVIDER_STORE_FILE);
    this.configFile = path.join(dataDir, PROVIDER_LEGACY_CONFIG);
    this.modelsFile = path.join(dataDir, PROVIDER_LEGACY_MODELS);
    this.cache = null;
    // A corrupt main file may be recovered from `.bak`. Keep the fact visible
    // to /api/status, and never let the next save copy the corrupt file over
    // the good backup.
    this.recoveryWarning = '';
    this.recoveredFromBackup = false;
  }

  // Include both legacy stamps so an external edit is noticed until the merged
  // file exists, exactly as it was before the merge.
  stamp() {
    return [fileStamp(this.file), fileStamp(this.configFile), fileStamp(this.modelsFile)].join('|');
  }

  read() {
    const stamp = this.stamp();
    if (this.cache && this.cache.stamp === stamp) return this.cache.value;
    const value = fs.existsSync(this.file) ? this.readMerged() : this.readLegacy();
    this.cache = { stamp, value };
    return value;
  }

  readMerged() {
    const raw = readJson(this.file, null, {
      backup: true,
      onRecover: () => this.markRecovered('服务商配置损坏，已从上一份备份恢复。'),
    });
    if (!isRecord(raw)) throw domainError('服务商配置损坏，请从备份恢复');
    return this.normalize(raw);
  }

  readLegacy() {
    const config = readJson(this.configFile, {}, {
      backup: true,
      onRecover: () => this.markRecovered('API 设置损坏，已从上一份备份恢复。'),
    });
    if (!isRecord(config)) throw domainError('API 设置损坏，请从备份恢复');
    const models = readJson(this.modelsFile, { version: 1, models: [] }, {
      backup: true,
      onRecover: () => this.markRecovered('API 模型配置损坏，已从上一份备份恢复。'),
    });
    if (!isRecord(models) || !Array.isArray(models.models)) throw domainError('API 模型配置损坏，请从备份恢复');
    return { version: 2, codexApi: config, diyModels: models.models };
  }

  markRecovered(message) {
    this.recoveredFromBackup = true;
    this.recoveryWarning = message;
  }

  normalize(raw) {
    const data = emptyData();
    if (isRecord(raw.codexApi)) data.codexApi = raw.codexApi;
    if (Array.isArray(raw.diyModels)) data.diyModels = raw.diyModels;
    return data;
  }

  write(data, { flush = false, backup = true } = {}) {
    if (!fs.existsSync(this.file) && (fs.existsSync(this.configFile) || fs.existsSync(this.modelsFile))) {
      const legacy = this.readLegacy();
      writeJson(path.join(this.dataDir, 'providers.legacy-backup.json'), legacy, { flush: true });
    }
    // After a recovery the live file is still corrupt; backing it up would
    // destroy the only good copy. The existing `.bak` stays as the previous
    // good snapshot, and the next save can rotate normally again.
    const keepBackup = backup && !this.recoveredFromBackup;
    writeJson(this.file, { version: 2, codexApi: data.codexApi, diyModels: data.diyModels }, { flush, backup: keepBackup });
    this.recoveredFromBackup = false;
    this.cache = { stamp: this.stamp(), value: structuredClone(data) };
  }

  update(mutator, options) {
    const data = structuredClone(this.read());
    mutator(data);
    this.write(data, options);
    return data;
  }

  writeCodex(codexApi) {
    this.update(data => { data.codexApi = codexApi; }, { flush: true, backup: true });
  }

  writeModels(diyModels, { flush = true } = {}) {
    this.update(data => { data.diyModels = diyModels; }, { flush, backup: true });
  }

  // Restore the whole provider document, not only the DIY half. The live file
  // may be corrupt, so no backup rotation here: the file we are reading is the
  // good snapshot and must stay intact.
  restoreBackup() {
    const candidates = [this.file + '.bak', path.join(this.dataDir, 'providers.legacy-backup.json')];
    for (const candidate of candidates) {
      let raw;
      try { raw = readJson(candidate, null); } catch { continue; }
      if (!isRecord(raw)) continue;
      const data = this.normalize(raw);
      if (!isRecord(raw.codexApi) && !Array.isArray(raw.diyModels)) continue;
      writeJson(this.file, { version: 2, codexApi: data.codexApi, diyModels: data.diyModels }, { flush: true, backup: false });
      this.cache = null;
      this.recoveredFromBackup = false;
      return true;
    }
    return false;
  }

  invalidate() { this.cache = null; }
}
