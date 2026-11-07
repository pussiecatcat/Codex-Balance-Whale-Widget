const UI_KEY = /^dshw[-v]/;

// One local key/value store for the widget. Every write goes to localStorage
// immediately and is pushed to the main process after a short debounce, using
// the acknowledged-baseline diff the old 800 ms poller computed. Remote changes
// arrive through the settings change bus instead of a reconcile event.
export function createUiState({
  storage,
  bridge = null,
  settings = null,
  scope = null,
  debounceMs = 150,
  setTimeout: setTimer = globalThis.setTimeout,
  clearTimeout: clearTimer = globalThis.clearTimeout,
} = {}) {
  let acknowledged = { ...(bridge?.storage || {}) };
  let timer = 0;
  let saving = null;
  const listeners = new Map();

  const readRaw = key => { try { return storage.getItem(key); } catch { return null; } };
  const writeRaw = (key, value) => {
    try {
      if (value === null || value === undefined) storage.removeItem(key);
      else storage.setItem(key, String(value));
    } catch { /* storage may be unavailable */ }
  };
  function readAll() {
    const out = {};
    let keys = [];
    try { keys = Object.keys(storage); } catch { keys = []; }
    for (const key of keys) if (UI_KEY.test(key)) out[key] = storage.getItem(key);
    return out;
  }
  function notify(key, value) {
    for (const fn of listeners.get(key) || []) {
      try { fn(value); } catch (error) { console.error('[ui-state] subscriber failed', error); }
    }
  }
  function get(key) { return readRaw(key); }
  function getJSON(key, fallback = null) {
    const raw = readRaw(key);
    if (raw === null || raw === undefined) return fallback;
    try { return JSON.parse(raw); } catch { return fallback; }
  }
  function set(key, value) {
    writeRaw(key, value);
    notify(key, value === null || value === undefined ? null : String(value));
    schedule();
  }
  function remove(key) { set(key, null); }
  function subscribe(key, fn) {
    if (!listeners.has(key)) listeners.set(key, new Set());
    listeners.get(key).add(fn);
    return () => listeners.get(key)?.delete(fn);
  }
  function pending() {
    const current = readAll(), changes = {}, base = {};
    for (const key of new Set([...Object.keys(current), ...Object.keys(acknowledged)])) {
      const next = current[key] ?? null, previous = acknowledged[key] ?? null;
      if (next !== previous) { changes[key] = next; base[key] = previous; }
    }
    return { changes, base };
  }
  function push() {
    if (saving) return saving;
    const patch = pending();
    if (!Object.keys(patch.changes).length) return Promise.resolve();
    saving = Promise.resolve().then(() => bridge?.save ? bridge.save(patch) : null).then(result => {
      if (!result?.ok || !result.values) return;
      acknowledged = { ...result.values };
      // Never overwrite a key the user changed again while this push was in
      // flight; it stays pending and the next push carries the newer value.
      for (const key of Object.keys(patch.changes)) {
        const sent = patch.changes[key] ?? null;
        if ((readRaw(key) ?? null) !== sent) continue;
        const server = acknowledged[key] ?? null;
        if (server !== sent) { writeRaw(key, server); notify(key, server); }
      }
    }).catch(() => {}).finally(() => {
      saving = null;
      if (Object.keys(pending().changes).length) schedule();
    });
    return saving;
  }
  function schedule() {
    if (saving) return;
    if (timer) clearTimer(timer);
    timer = setTimer(() => { timer = 0; push(); }, debounceMs);
  }
  function flush() {
    if (timer) { clearTimer(timer); timer = 0; }
    return push();
  }
  // Remote writes come from the settings bus. A value for a key with an
  // unacknowledged local edit is ignored; the local edit wins and is pushed.
  function applyRemote(change) {
    if (!change || !Array.isArray(change.keys)) return;
    const local = pending().changes;
    for (const key of change.keys) {
      if (Object.hasOwn(local, key)) continue;
      const value = change.values ? change.values[key] : undefined;
      const next = value === undefined || value === null ? null : typeof value === 'string' ? value : JSON.stringify(value);
      if ((readRaw(key) ?? null) === next) continue;
      writeRaw(key, next);
      notify(key, next);
    }
  }
  if (settings?.subscribe) scope?.add?.(settings.subscribe('ui', applyRemote));
  if (scope) scope.add(() => { if (timer) { clearTimer(timer); timer = 0; } });
  return { get, getJSON, set, remove, subscribe, pending, flush, applyRemote, push };
}
