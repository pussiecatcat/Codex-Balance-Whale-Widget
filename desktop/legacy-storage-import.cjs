const fs = require('node:fs');
const path = require('node:path');

// One-time import from the old web localStorage. It runs in an isolated hidden
// window against a local origin, records a marker whatever happens, and never
// blocks startup or retries on every launch.
function createLegacyStorageImporter({ dataDir, BrowserWindow, session, harnessEnabled, storeValues, values, save }) {
  return async function importLegacyStorage() {
    const marker = path.join(dataDir, 'legacy-storage-imported.json');
    if (fs.existsSync(marker) || harnessEnabled) return;
    let legacy = null;
    try {
      legacy = new BrowserWindow({ show: false, webPreferences: { nodeIntegration: false, contextIsolation: true, sandbox: true } });
      session.defaultSession.protocol.handle('http', request => new Response(request.url.startsWith('http://127.0.0.1:47321/') ? '<!doctype html><title>Local migration</title>' : '', { status: request.url.startsWith('http://127.0.0.1:47321/') ? 200 : 403, headers: { 'Content-Type': 'text/html' } }));
      await legacy.loadURL('http://127.0.0.1:47321/');
      const old = await legacy.webContents.executeJavaScript("Object.fromEntries(Object.keys(localStorage).filter(k => /^dshw[-v]/.test(k)).map(k => [k, localStorage.getItem(k)]))");
      storeValues({ ...old, ...values() }); save(marker, { complete: true, at: new Date().toISOString() });
    } catch (error) {
      // A failed migration must not block startup or retry on every launch: the
      // marker records it once, and the widget starts without the legacy values.
      try { save(marker, { complete: false, at: new Date().toISOString(), error: String(error?.message || error).slice(0, 200) }); } catch { /* the marker is best effort */ }
    } finally {
      try { legacy?.destroy(); } catch { /* the migration window may already be gone */ }
      try { session.defaultSession.protocol.unhandle('http'); } catch { /* only this importer registers it */ }
    }
  };
}

module.exports = { createLegacyStorageImporter };
