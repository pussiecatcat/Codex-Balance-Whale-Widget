import fs from 'node:fs';
import path from 'node:path';
import { readJson, writeJson } from './paths.mjs';

// Keep every report-supported bubble module. Only obsolete top-level schedule
// caches are discarded; live peak modules now read the verified service route.
export function stripRetiredModules(value) {
  if (Array.isArray(value)) return value.map(stripRetiredModules);
  if (value && typeof value === 'object') {
    const result = {};
    for (const [key, v] of Object.entries(value)) if (!['pricingSchedule', 'peakMode'].includes(key)) result[key] = stripRetiredModules(v);
    return result;
  }
  return value;
}

// A state file can carry a UTF-8 BOM (Notepad, PowerShell `>`) or be truncated
// by a power loss. Neither may stop the widget from booting, so parse defensively.
function readStateFile(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, ''));
}

export function migrateData(dataDir) {
  const marker = path.join(dataDir, 'migration-follow-v1.json');
  if (readJson(marker, {}).complete) return;
  const names = ['api-settings.json', '.dshw-size.json', '.dshw-bubble.json', 'ui-state.json'];
  const backupDir = path.join(dataDir, 'migration-backup-v1');
  const changed = [], failed = [];
  for (const name of names) {
    const file = path.join(dataDir, name);
    if (!fs.existsSync(file)) continue;
    // One unreadable file is skipped and recorded, never fatal. Before this
    // guard a single corrupt file threw out of createDispatcher and the widget
    // could not start at all — and because the marker is written only at the
    // end, every later boot failed the same way.
    try {
      const original = readStateFile(file);
      const clean = stripRetiredModules(original);
      if (JSON.stringify(clean) === JSON.stringify(original)) continue;
      fs.mkdirSync(backupDir, { recursive: true });
      const saved = path.join(backupDir, name);
      if (!fs.existsSync(saved)) fs.copyFileSync(file, saved, fs.constants.COPYFILE_EXCL);
      writeJson(file, clean); changed.push(name);
    } catch (error) {
      failed.push({ name, message: String(error && error.message).slice(0, 200) });
    }
  }
  // A parse or filesystem failure is non-fatal for this boot, but it must remain
  // retryable. Marking a partial pass complete would permanently skip a file
  // after a transient sharing violation, permission failure, or full disk.
  writeJson(marker, { complete: failed.length === 0, changed, ...(failed.length ? { failed } : {}), at: new Date().toISOString() });
}
