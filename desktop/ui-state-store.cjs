const fs = require('node:fs');
const { writeFileAtomic } = require('../lib/atomic-write.mjs');

class UiStateStore {
  constructor(file) {
    this.file = file;
    try { this.value = JSON.parse(fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, '')); } catch { this.value = {}; }
    this.encoded = JSON.stringify(this.value);
    this.dirty = false;
    this.timer = null;
    this.writes = Promise.resolve();
  }
  get() { return this.value; }
  // Compare each submitted key against the renderer's acknowledged baseline.
  // An in-flight snapshot can never undo a newer settings-window change.
  applyPatch(input) {
    if (!input?.changes || !input.base || typeof input.changes !== 'object' ||
        typeof input.base !== 'object' || Array.isArray(input.changes) || Array.isArray(input.base)) return { ok: false };
    const accepted = {}, conflicts = [];
    for (const [key, value] of Object.entries(input.changes)) {
      if (!/^dshw[-v]/.test(key) || !(value === null || typeof value === 'string' && value.length < 1024 * 1024)) continue;
      const current = this.value[key] ?? null;
      if (current !== (input.base[key] ?? null) && current !== value) { conflicts.push(key); continue; }
      accepted[key] = value;
    }
    this.setKeys(accepted);
    return { ok: true, values: { ...this.value }, conflicts };
  }
  set(input) {
    if (!input || typeof input !== 'object' || Array.isArray(input)) return;
    const accepted = {};
    for (const [key, value] of Object.entries(input)) if (/^dshw[-v]/.test(key) && typeof value === 'string' && value.length < 1024 * 1024) accepted[key] = value;
    const encoded = JSON.stringify(accepted);
    if (encoded === this.encoded) return;
    this.value = accepted; this.encoded = encoded; this.dirty = true;
    clearTimeout(this.timer);
    this.timer = setTimeout(() => { this.flush().catch(() => {}); }, 150);
  }
  flush() {
    clearTimeout(this.timer); this.timer = null;
    if (!this.dirty) return this.writes;
    const encoded = this.encoded; this.dirty = false;
    this.writes = this.writes.catch(() => {}).then(async () => {
      try { await writeFileAtomic(this.file, encoded, { fs: fs.promises }); }
      catch (error) { this.dirty = true; throw error; }
    });
    return this.writes;
  }
  // Keyed update. set() replaces the whole document, so two renderers each
  // holding a stale snapshot would drop each other's keys; windows other than
  // the widget's own renderer write through this instead. null removes a key.
  setKeys(input) {
    if (!input || typeof input !== 'object' || Array.isArray(input)) return {};
    const accepted = {};
    for (const [key, value] of Object.entries(input)) {
      if (!/^dshw[-v]/.test(key)) continue;
      if (value === null) { accepted[key] = null; continue; }
      if (typeof value === 'string' && value.length < 1024 * 1024) accepted[key] = value;
    }
    const next = { ...this.value };
    let changed = false;
    for (const [key, value] of Object.entries(accepted)) {
      if (value === null) { if (Object.hasOwn(next, key)) { delete next[key]; changed = true; } continue; }
      if (next[key] !== value) { next[key] = value; changed = true; }
    }
    if (!changed) return {};
    this.value = next; this.encoded = JSON.stringify(next); this.dirty = true;
    clearTimeout(this.timer);
    this.timer = setTimeout(() => { this.flush().catch(() => {}); }, 150);
    return accepted;
  }
}
module.exports = { UiStateStore };
