import nodeFs from 'node:fs';
import path from 'node:path';
import { createHash, randomBytes } from 'node:crypto';
import { atomicResourceWrite, readResourceJson, validResourceId } from '../lib/resource-store.mjs';
import { SizeSettingsStore } from './size-settings.mjs';

const SCHEMA_VERSION = 1;
const JOURNAL_VERSION = 1;
const plainObject = value => value && typeof value === 'object' && !Array.isArray(value);
const validSoundReference = value => {
  if (typeof value !== 'string') return false;
  const parts = value.split(':');
  if (parts.length === 2 && (parts[0] === 'grp' || parts[0] === 'frag')) return validResourceId(parts[1]);
  return parts.length === 3 && parts[0] === 'preset' && validResourceId(parts[1]) && ['press', 'release'].includes(parts[2]);
};

export class SoundSettingsError extends Error {
  constructor(code, message, status = 400, cause) {
    super(message, cause ? { cause } : undefined);
    this.name = 'SoundSettingsError';
    this.code = code;
    this.status = status;
  }
}

// Exported only so fault-injection tests can model an abrupt process exit. A
// normal exception triggers rollback; an abrupt exit deliberately leaves the
// durable journal for the next service instance to recover.
export class SoundSettingsCrash extends Error {
  constructor(stage) { super('simulated crash at ' + stage); this.stage = stage; this.simulatedCrash = true; }
}

function cleanSnapshot(value) {
  if (!plainObject(value) || typeof value.exists !== 'boolean') return null;
  if (value.exists && !plainObject(value.document)) return null;
  return { exists: value.exists, document: value.exists ? structuredClone(value.document) : null };
}

export class SoundSettingsService {
  constructor({ dataDir, whale, sizeStore = null, fs = nodeFs, failpoint = null } = {}) {
    if (!dataDir) throw new Error('sound settings dataDir is required');
    this.dataDir = path.resolve(dataDir);
    this.whale = whale;
    this.fs = fs;
    this.sizeStore = sizeStore || new SizeSettingsStore(this.dataDir, { fs });
    this.usageFile = path.join(this.dataDir, 'usage-settings.json');
    this.journalFile = path.join(this.dataDir, 'sound-settings-transaction.json');
    this.failpoint = failpoint;
    this.queue = Promise.resolve();
    // Recovery is attempted during application assembly and again before each
    // operation. A transient file lock therefore does not make the process
    // unusable, while a damaged journal keeps this feature read-only.
    try { this.recoverSync(); } catch (error) { this.startupRecoveryError = error; }
  }

  run(operation) {
    const job = this.queue.then(operation, operation);
    this.queue = job.catch(() => {});
    return job;
  }

  load() { return this.run(() => { this.recoverSync(); return this.snapshotPayload(); }); }
  save(command) { return this.run(() => this.saveSync(command)); }

  usageSnapshot() {
    const document = readResourceJson(this.usageFile, null, plainObject, { fs: this.fs });
    return { exists: document !== null, document: document === null ? null : structuredClone(document) };
  }

  snapshots() { return { size: this.sizeStore.snapshot(), usage: this.usageSnapshot() }; }

  revisionOf(snapshots) {
    const value = {
      size: { exists: snapshots.size.exists, document: snapshots.size.document },
      usage: { exists: snapshots.usage.exists, document: snapshots.usage.document },
    };
    return createHash('sha256').update(JSON.stringify(value)).digest('hex');
  }

  snapshotPayload() {
    let snapshots;
    try { snapshots = this.snapshots(); }
    catch (error) { throw new SoundSettingsError('SETTINGS_STORAGE_INVALID', '音效设置文件损坏或不可读', 503, error); }
    if (typeof this.whale?.resolveUsageSettings !== 'function') throw new SoundSettingsError('SETTINGS_SERVICE_UNAVAILABLE', '音效设置服务尚未准备好', 503);
    return {
      ok: true,
      schemaVersion: SCHEMA_VERSION,
      revision: this.revisionOf(snapshots),
      size: this.sizeStore.normalize(snapshots.size.document || {}),
      usage: this.whale.resolveUsageSettings(snapshots.usage.document || {}),
    };
  }

  validateCommand(command) {
    if (!plainObject(command) || command.schemaVersion !== SCHEMA_VERSION || typeof command.revision !== 'string'
      || !plainObject(command.size) || !plainObject(command.usage)) {
      throw new SoundSettingsError('INVALID_SOUND_SETTINGS', '音效设置格式无效', 400);
    }
    if (!Number.isFinite(command.size.vol) || command.size.vol < 0 || command.size.vol > 1) {
      throw new SoundSettingsError('INVALID_SOUND_VOLUME', '按压音量须在 0% 到 100% 之间', 400);
    }
    if (!Number.isFinite(command.size.turnCostCloseMs) || command.size.turnCostCloseMs < 0 || command.size.turnCostCloseMs > 3600000) {
      throw new SoundSettingsError('INVALID_SOUND_TIMEOUT', '每轮消耗提示关闭时间无效', 400);
    }
    if (!validResourceId(command.size.soundSet)) throw new SoundSettingsError('INVALID_SOUND_REFERENCE', '按压音效组无效', 400);
    const references = [command.usage.taskEnd?.sel, command.usage.events?.question?.sel, command.usage.events?.approval?.sel];
    if (references.some(value => !validSoundReference(value))) {
      throw new SoundSettingsError('INVALID_SOUND_REFERENCE', '提示音效引用无效', 400);
    }
  }

  saveSync(command) {
    this.recoverSync();
    this.validateCommand(command);
    const before = this.snapshots();
    const currentRevision = this.revisionOf(before);
    if (command.revision !== currentRevision) {
      throw new SoundSettingsError('SETTINGS_CONFLICT', '音效设置已在其他位置更改，请重新载入后再保存', 409);
    }
    if (typeof this.whale?.prepareUsageSettings !== 'function' || typeof this.whale?.commitUsageSettings !== 'function') {
      throw new SoundSettingsError('SETTINGS_SERVICE_UNAVAILABLE', '音效设置服务尚未准备好', 503);
    }
    let preparedSize, preparedUsage;
    try {
      preparedSize = this.sizeStore.prepare(command.size, { baseDocument: before.size.document || {} });
      preparedUsage = this.whale.prepareUsageSettings(command.usage, { base: before.usage.document || {} });
    } catch (error) {
      throw error instanceof SoundSettingsError ? error : new SoundSettingsError('INVALID_SOUND_SETTINGS', error.message || '音效设置格式无效', 400, error);
    }
    const transaction = {
      version: JOURNAL_VERSION,
      id: randomBytes(12).toString('hex'),
      phase: 'prepared',
      sizeFile: path.relative(this.dataDir, before.size.file),
      before: {
        size: { exists: before.size.exists, document: before.size.document },
        usage: { exists: before.usage.exists, document: before.usage.document },
      },
      after: {
        size: { exists: true, document: preparedSize.document },
        usage: { exists: true, document: preparedUsage },
      },
    };
    let journalWritten = false, committed = false;
    try {
      this.writeJournal(transaction); journalWritten = true; this.hit('after-journal');
      this.writeSize(transaction.sizeFile, transaction.after.size); this.hit('after-size');
      this.whale.commitUsageSettings(transaction.after.usage.document, { fs: this.fs }); this.hit('after-usage');
      transaction.phase = 'committed'; this.writeJournal(transaction); committed = true; this.hit('after-commit');
    } catch (error) {
      if (error?.simulatedCrash) throw error;
      if (committed) return this.snapshotPayload();
      if (journalWritten) {
        try { this.restoreBefore(transaction); this.removeJournal(); }
        catch (restoreError) {
          throw new SoundSettingsError('RECOVERY_REQUIRED', '音效设置保存未完成，将在下次启动时恢复', 503, restoreError);
        }
      }
      throw error instanceof SoundSettingsError ? error : new SoundSettingsError('SETTINGS_SAVE_FAILED', '音效设置保存失败，原设置已保留', 500, error);
    }
    try { this.removeJournal(); } catch {}
    return this.snapshotPayload();
  }

  hit(stage) { if (this.failpoint) this.failpoint(stage); }

  writeJournal(transaction) {
    atomicResourceWrite(this.journalFile, JSON.stringify(transaction, null, 2), { fs: this.fs });
  }

  removeJournal() {
    try { this.fs.unlinkSync(this.journalFile); }
    catch (error) { if (error.code !== 'ENOENT') throw error; }
  }

  parseJournal() {
    const journal = readResourceJson(this.journalFile, null, value => plainObject(value), { fs: this.fs, maxBytes: 8 * 1024 * 1024 });
    if (journal === null) return null;
    const sizeFile = path.resolve(this.dataDir, String(journal.sizeFile || ''));
    const beforeSize = cleanSnapshot(journal.before?.size), beforeUsage = cleanSnapshot(journal.before?.usage);
    const afterSize = cleanSnapshot(journal.after?.size), afterUsage = cleanSnapshot(journal.after?.usage);
    if (journal.version !== JOURNAL_VERSION || !['prepared', 'committed'].includes(journal.phase)
      || !this.sizeStore.owns(sizeFile) || !beforeSize || !beforeUsage || !afterSize || !afterUsage
      || !afterSize.exists || !afterUsage.exists) {
      throw new SoundSettingsError('SETTINGS_JOURNAL_INVALID', '音效设置恢复记录已损坏，已保留原文件', 503);
    }
    return { ...journal, sizeFile: path.relative(this.dataDir, sizeFile), before: { size: beforeSize, usage: beforeUsage }, after: { size: afterSize, usage: afterUsage } };
  }

  recoverSync() {
    let transaction;
    try { transaction = this.parseJournal(); }
    catch (error) {
      throw error instanceof SoundSettingsError ? error : new SoundSettingsError('SETTINGS_JOURNAL_INVALID', '音效设置恢复记录已损坏或不可读', 503, error);
    }
    if (!transaction) return false;
    try {
      if (transaction.phase === 'committed') this.restoreAfter(transaction);
      else this.restoreBefore(transaction);
      this.removeJournal();
      return true;
    } catch (error) {
      throw new SoundSettingsError('RECOVERY_REQUIRED', '音效设置恢复未完成，请检查磁盘空间和文件权限', 503, error);
    }
  }

  writeSize(relativeFile, snapshot) {
    const file = path.resolve(this.dataDir, relativeFile);
    if (!this.sizeStore.owns(file) || !snapshot.exists) throw new Error('挂件设置事务路径无效');
    this.sizeStore.commit(snapshot.document, { file, backup: true });
  }

  restoreSnapshot(file, snapshot) {
    if (snapshot.exists) atomicResourceWrite(file, JSON.stringify(snapshot.document, null, 2), { fs: this.fs });
    else {
      try { this.fs.unlinkSync(file); }
      catch (error) { if (error.code !== 'ENOENT') throw error; }
    }
  }

  restoreBefore(transaction) {
    const sizeFile = path.resolve(this.dataDir, transaction.sizeFile);
    if (!this.sizeStore.owns(sizeFile)) throw new Error('挂件设置事务路径无效');
    this.restoreSnapshot(sizeFile, transaction.before.size);
    this.restoreSnapshot(this.usageFile, transaction.before.usage);
  }

  restoreAfter(transaction) {
    const sizeFile = path.resolve(this.dataDir, transaction.sizeFile);
    if (!this.sizeStore.owns(sizeFile)) throw new Error('挂件设置事务路径无效');
    this.restoreSnapshot(sizeFile, transaction.after.size);
    this.restoreSnapshot(this.usageFile, transaction.after.usage);
  }
}
