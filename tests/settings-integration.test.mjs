import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { WhaleService } from '../runtime/service.mjs';
import { SoundSettingsService } from '../runtime/sound-settings.mjs';
import { createStorageSync } from '../desktop/ui/features/widget/storage-sync.js';
const require = createRequire(import.meta.url);
const { SettingsStore, createSoundSettingsDomains } = require('../desktop/settings-store.cjs');
const { UiStateStore } = require('../desktop/ui-state-store.cjs');
const { registerIpcHandlers } = require('../desktop/ipc-handlers.cjs');

function fixture(t) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'whale-settings-fix-'));
  const config = { dataDir: directory, resolve: () => ({ dashboardUrl: 'https://example.invalid', accountId: 'fixture', setting: {} }) };
  const whale = new WhaleService({ config, provider: {} });
  fs.writeFileSync(path.join(directory, '.dshw-size.json'), JSON.stringify({ scale: 2.4, vol: 0.42, sound: true }));
  const service = new SoundSettingsService({ dataDir: directory, whale });
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  return { service, store: new SettingsStore({ domains: createSoundSettingsDomains(service) }) };
}

test('settings adapters await real service reads and support consecutive saves with a baseline', async t => {
  const { store, service } = fixture(t);
  const first = await store.read(['size', 'usage']);
  assert.equal(first.size.scale, 2.4);
  assert.equal(first.size.vol, 0.42);
  const saved = await store.save({ domain: 'size', changes: { scale: 1.9 }, base: first.size });
  assert.equal(saved.ok, true);
  assert.equal((await store.save({ domain: 'size', changes: { scale: 2.1 }, base: saved.values })).ok, true);
  assert.equal((await service.load()).size.scale, 2.1);
  assert.equal((await service.load()).size.vol, 0.42);
});

test('concurrent settings writes preserve distinct fields and reject a stale same-field baseline', async t => {
  const { store } = fixture(t);
  const { size: base } = await store.read('size');
  const results = await Promise.all([
    store.save({ domain: 'size', changes: { scale: 1.9 }, base }),
    store.save({ domain: 'size', changes: { vol: 0.6 }, base }),
    store.save({ domain: 'size', changes: { scale: 1.2 }, base }),
  ]);
  assert.deepEqual(results.map(r => r.ok), [true, true, false]);
  assert.equal((await store.read('size')).size.scale, 1.9);
  assert.equal((await store.read('size')).size.vol, 0.6);
});

function ipcFixture(hostExtra = {}) {
  const handlers = new Map();
  const contents = { isDestroyed: () => false, mainFrame: {} };
  const settings = { isDestroyed: () => false, webContents: contents };
  const widget = { isDestroyed: () => false, webContents: { isDestroyed: () => false } };
  const sent = [];
  const host = { windows: () => ({ widget, settings }), window: () => widget, quitting: () => false,
    show() {}, sendCommand: (command, payload) => { sent.push({ command, payload }); return true; }, ...hostExtra };
  registerIpcHandlers({ ipcMain: { on() {}, handle: (name, fn) => handlers.set(name, fn) }, host });
  return { handlers, sent, event: { sender: contents, senderFrame: contents.mainFrame } };
}

test('settings editor IPC preserves the object payload expected by the renderer', async () => {
  const { handlers, sent, event } = ipcFixture();
  for (const editor of ['role', 'snap', 'bubble', 'reminder', 'workshop', 'sound', 'api']) {
    await handlers.get('whale-command')(event, 'open-editor', { editor });
    assert.equal(sent.at(-1).payload.editor, editor);
  }
});

test('settings IPC awaits reads and converts asynchronous save failures into explicit failure', async () => {
  const { handlers, event } = ipcFixture({ settingsStore: () => ({
    read: async () => ({ size: { scale: 2.4 } }),
    save: async () => { throw new Error('fixture write failed'); },
  }) });
  const read = await handlers.get('whale-settings-read')(event, { domains: ['size'] });
  assert.equal(read.values.size.scale, 2.4);
  assert.deepEqual(await handlers.get('whale-settings-write')(event, {}), { ok: false, error: 'fixture write failed' });
});

test('an in-flight widget patch cannot undo newer settings and unrelated edits survive', async t => {
  const state = Object.create(UiStateStore.prototype);
  const initial = { 'dshw-bubble-shape': 'ellipse', 'dshw-pos': 'old' };
  Object.assign(state, { value: { ...initial }, encoded: JSON.stringify(initial), dirty: false, timer: null });
  t.after(() => clearTimeout(state.timer));
  let local = { ...initial }, release;
  const gate = new Promise(resolve => { release = resolve; });
  const sync = createStorageSync({ initial, read: () => ({ ...local }),
    write: async patch => { await gate; return state.applyPatch(patch); },
    reconcile: (key, value) => { if (value === null) delete local[key]; else local[key] = value; } });
  local['dshw-bubble-shape'] = 'round'; local['dshw-pos'] = 'dragged';
  const saving = sync.save();
  state.setKeys({ 'dshw-bubble-shape': 'newer' });
  release(); await saving;
  assert.equal(state.get()['dshw-bubble-shape'], 'newer');
  assert.equal(state.get()['dshw-pos'], 'dragged');
  assert.equal(local['dshw-bubble-shape'], 'newer');
  assert.equal(state.applyPatch(initial).ok, false, 'raw full snapshots are refused');
  local['dshw-pos'] = null;
  await sync.save();
  assert.equal(Object.hasOwn(state.get(), 'dshw-pos'), false);
});



test('completion reminder updates both files in the existing sound transaction', async t => {
  const { store, service } = fixture(t);
  const initial = await store.read('completion');
  assert.equal((await store.save({ domain: 'completion', changes: { turnCostOn: false, on: false }, base: initial.completion })).ok, true);
  const off = await service.load();
  assert.equal(off.size.turnCostOn, false);
  assert.equal(off.usage.taskEnd.on, false);
  assert.equal(off.size.vol, .42);
  const current = await store.read('completion');
  assert.equal((await store.save({ domain: 'completion', changes: { turnCostOn: true, on: true }, base: current.completion })).ok, true);
  const on = await service.load();
  assert.equal(on.size.turnCostOn, true);
  assert.equal(on.usage.taskEnd.on, true);
});
