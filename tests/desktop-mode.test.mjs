import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
const { createVisibilityController } = createRequire(import.meta.url)('../desktop/visibility.cjs');
const { normalizeHostState } = createRequire(import.meta.url)('../desktop/host-state.cjs');
const { createModeController } = createRequire(import.meta.url)('../desktop/mode-controller.cjs');
const { registerShortcuts } = createRequire(import.meta.url)('../desktop/shortcuts.cjs');
const { createLegacyStorageImporter } = createRequire(import.meta.url)('../desktop/legacy-storage-import.cjs');
function fixture() {
 let state = { ready: true, standalone: true, host: { hostAlive: false, visible: false, attached: false } }, visible = false;
 const calls = [], pending = [];
 const window = { isDestroyed: () => false, isVisible: () => visible, hide() { visible = false; calls.push('hide'); }, showInactive() { visible = true; calls.push('show'); } };
 const controller = createVisibilityController({ getWindow: () => window, getState: () => state, schedule: f => { pending.push(f); return f; }, cancel: f => { const i = pending.indexOf(f); if (i >= 0) pending.splice(i, 1); } });
 return { controller, calls, set: patch => { state = { ...state, ...patch }; controller.update(); }, visible: () => visible, flush: () => { while (pending.length) pending.shift()(); } };
}
test('standalone displays without Codex and ignores host minimize/modal/epoch changes', () => {
 const f = fixture(); f.controller.update(); assert.equal(f.visible(), true);
 for (let n = 0; n < 100; n++) f.set({ host: { hostAlive: n % 2 === 0, visible: false, modal: true, visibilityRevision: n, hostPid: n } });
 assert.deepEqual(f.calls, ['show']);
});
for (const guard of ['manuallyHidden', 'quitting']) test('standalone respects ' + guard, () => {
 const f = fixture(); f.controller.update(); f.set({ [guard]: true }); f.controller.requestRecovery(); f.flush(); assert.equal(f.visible(), false);
});
test('standalone cannot bypass renderer readiness and switching to follow applies host guards', () => {
 const f = fixture(); f.set({ ready: false }); assert.equal(f.visible(), false);
 f.set({ ready: true }); f.flush(); assert.equal(f.visible(), true);
 f.set({ standalone: false }); f.flush(); assert.equal(f.visible(), false);
});

function mainModeFixture() {
 const calls = [], area = { x: 0, y: 0, width: 1920, height: 1080 };
 let currentBounds = { x: 7, y: 7, width: 1900, height: 1050 };
 const screen = { getPrimaryDisplay: () => ({ workArea: area }) };
 const window = { isDestroyed: () => false, getBounds: () => currentBounds,
   setBounds: rect => { currentBounds = { ...rect }; calls.push('bounds'); }, setPosition: () => calls.push('position'),
   setAlwaysOnTop: () => calls.push('top'), webContents: { send: event => calls.push(event) } };
 const controller = createModeController({
   getWindow: () => window, getQuitting: () => false, initialHost: null, initialMode: 'follow-codex',
   dataDir: '/test', normalizedHost: normalizeHostState, platform: 'win32', usesWindowShape: true, harnessEnabled: false,
   read: () => ({}), save: () => calls.push('save'), screen, toDipRect: rect => rect,
   sendCursor: () => {}, updateTray: () => {}, markStartup: () => {}, diagnose: () => {},
   visibility: () => calls.push(controller.state.modePending ? 'hidden-pending' : 'visibility'),
   show: () => calls.push('show'), syncNativeViewport: () => '',
   visibilityController: { observeNativeVisibility: () => false }, diagnostics: { sample() {} },
   quit: () => calls.push('quit'), hideManuallyOff: () => {},
 });
 const host = patch => controller.setHost({ hostAlive: true, hostPid: 1, window: '1', visible: true, attached: true, nativeFollowing: true, mode: 'follow-codex', ...patch });
 return { state: controller.state, calls, host, setMode: controller.setMode };
}

test('reselecting the active mode closes UI without changing geometry or remapping', () => {
 const f = mainModeFixture(); f.setMode('follow-codex');
 assert.deepEqual(f.calls, ['whale-desktop-mode']);
});

test('standalone waits for native detach and follow waits for fresh attachment', async () => {
 const f = mainModeFixture(); f.setMode('standalone');
 assert.equal(f.state.modePending, true); assert.ok(!f.calls.includes('bounds'));
 await f.host({ serial: 1 }); assert.equal(f.state.modePending, true);
 await f.host({ serial: 2, mode: 'standalone' }); assert.equal(f.state.modePending, true);
 await f.host({ serial: 3, mode: 'standalone', attached: false, nativeFollowing: false });
 assert.equal(f.state.modePending, false); assert.ok(f.calls.includes('bounds'));
 f.calls.length = 0; f.setMode('follow-codex');
 await f.host({ serial: 4, mode: 'standalone', attached: false, nativeFollowing: false });
 assert.equal(f.state.modePending, true); assert.ok(!f.calls.includes('whale-desktop-mode'));
 await f.host({ serial: 5 });
 assert.equal(f.state.modePending, false); assert.ok(f.calls.includes('whale-desktop-mode')); assert.ok(f.calls.includes('visibility'));
});

test('legacy import records a failure instead of retrying on every launch', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'whale-legacy-'));
  const saved = new Map(); let windows = 0;
  class LegacyWindow {
    constructor() { windows++; this.webContents = { executeJavaScript: async () => { throw new Error('legacy read failed'); } }; }
    loadURL() { return Promise.resolve(); }
    destroy() {}
  }
  const importer = createLegacyStorageImporter({ dataDir: dir, BrowserWindow: LegacyWindow,
    session: { defaultSession: { protocol: { handle() {}, unhandle() {} } } },
    harnessEnabled: false, storeValues() {}, values: () => ({}),
    save: (name, value) => { saved.set(name, value); fs.writeFileSync(name, JSON.stringify(value)); } });
  await importer();
  const marker = [...saved.entries()].find(([name]) => name.endsWith('legacy-storage-imported.json'));
  assert.equal(marker[1].complete, false);
  await importer();
  assert.equal(windows, 1, 'a recorded failure is not retried');
  fs.rmSync(dir, { recursive: true, force: true });
});

test('shortcut conflicts are reported instead of silently ignored', () => {
  const diagnosed = [];
  const flags = registerShortcuts({ globalShortcut: { register: () => false }, isMac: false, toggle() {},
    reportVisibility() {}, usesWindowShape: true, harnessEnabled: false, diagnose: reason => diagnosed.push(reason) });
  assert.equal(flags.toggleRegistered, false);
  assert.equal(flags.diagnosticRegistered, false);
  assert.ok(diagnosed.includes('toggle-shortcut-unavailable'));
  const registered = registerShortcuts({ globalShortcut: { register: () => true }, isMac: true, toggle() {},
    reportVisibility() {}, usesWindowShape: false, harnessEnabled: false, diagnose() {} });
  assert.deepEqual(registered, { toggleRegistered: true, diagnosticRegistered: false });
});
