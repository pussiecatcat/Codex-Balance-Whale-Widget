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

export function migrateData(dataDir) {
  const marker = path.join(dataDir, 'migration-follow-v1.json');
  if (readJson(marker, {}).complete) return;
  const names = ['api-settings.json', '.dshw-size.json', '.dshw-bubble.json', 'ui-state.json'];
  const backupDir = path.join(dataDir, 'migration-backup-v1');
  const changed = [];
  for (const name of names) {
    const file = path.join(dataDir, name);
    if (!fs.existsSync(file)) continue;
    const original = JSON.parse(fs.readFileSync(file, 'utf8'));
    const clean = stripRetiredModules(original);
    if (JSON.stringify(clean) === JSON.stringify(original)) continue;
    fs.mkdirSync(backupDir, { recursive: true });
    const saved = path.join(backupDir, name);
    if (!fs.existsSync(saved)) fs.copyFileSync(file, saved, fs.constants.COPYFILE_EXCL);
    writeJson(file, clean); changed.push(name);
  }
  writeJson(marker, { complete: true, changed, at: new Date().toISOString() });
}
