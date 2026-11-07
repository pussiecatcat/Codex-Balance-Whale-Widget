import test from 'node:test';
import assert from 'node:assert/strict';
import { createUiState } from '../desktop/ui/services/ui-state.js';

function storageStub(initial = {}) {
  const storage = { ...initial };
  Object.defineProperties(storage, {
    getItem: { value: key => Object.hasOwn(storage, key) ? storage[key] : null },
    setItem: { value: (key, value) => { storage[key] = String(value); } },
    removeItem: { value: key => { delete storage[key]; } },
    raw: { get: () => storage },
  });
  return storage;
}

function clock() {
  const timers = new Map(); let seq = 0;
  return {
    setTimeout: (fn) => { const id = ++seq; timers.set(id, fn); return id; },
    clearTimeout: id => timers.delete(id),
    run() { const entries = [...timers.values()]; timers.clear(); for (const fn of entries) fn(); },
    size: () => timers.size,
  };
}

test('consecutive writes debounce into one push and acknowledge the result', async () => {
  const storage = storageStub({ 'dshw-pos': 'old' });
  const pushes = []; const timer = clock();
  const state = createUiState({ storage, bridge: { storage: { 'dshw-pos': 'old' }, save: patch => { pushes.push(patch); return Promise.resolve({ ok: true, values: { ...patch.base, ...patch.changes } }); } },
    setTimeout: timer.setTimeout, clearTimeout: timer.clearTimeout });
  state.set('dshw-pos', 'a');
  state.set('dshw-pos', 'b');
  assert.equal(timer.size(), 1, 'the second write replaces the pending timer');
  assert.equal(storage.raw['dshw-pos'], 'b');
  timer.run();
  await state.flush();
  assert.equal(pushes.length, 1);
  assert.deepEqual(pushes[0].changes, { 'dshw-pos': 'b' });
  assert.deepEqual(state.pending().changes, {});
});

test('a failed push keeps the changes pending for the next attempt', async () => {
  const storage = storageStub(); const timer = clock();
  let ok = false, pushes = 0;
  const state = createUiState({ storage, bridge: { storage: {}, save: () => { pushes++; return Promise.resolve(ok ? { ok: true, values: { 'dshw-role': 'role_1' } } : { ok: false }); } },
    setTimeout: timer.setTimeout, clearTimeout: timer.clearTimeout });
  state.set('dshw-role', 'role_1');
  await state.flush();
  assert.equal(pushes, 1);
  assert.deepEqual(state.pending().changes, { 'dshw-role': 'role_1' });
  ok = true;
  await state.flush();
  assert.equal(pushes, 2);
  assert.deepEqual(state.pending().changes, {});
});

test('remote changes never overwrite a local edit that is still pending', () => {
  const storage = storageStub({ 'dshw-pos': 'old', 'dshw-role': 'old-role' });
  const timer = clock();
  const state = createUiState({ storage, bridge: { storage: { 'dshw-pos': 'old', 'dshw-role': 'old-role' }, save: () => Promise.resolve({ ok: true }) },
    setTimeout: timer.setTimeout, clearTimeout: timer.clearTimeout });
  state.set('dshw-pos', 'local');
  state.applyRemote({ keys: ['dshw-pos', 'dshw-role'], values: { 'dshw-pos': 'remote', 'dshw-role': 'remote-role' } });
  assert.equal(storage.raw['dshw-pos'], 'local', 'the pending local edit wins');
  assert.equal(storage.raw['dshw-role'], 'remote-role', 'an untouched key follows the remote change');
});

test('flush pushes immediately and cancels the pending timer', async () => {
  const storage = storageStub(); const timer = clock(); let pushes = 0;
  const state = createUiState({ storage, bridge: { storage: {}, save: () => { pushes++; return Promise.resolve({ ok: true, values: { 'dshw-pos': 'x' } }); } },
    setTimeout: timer.setTimeout, clearTimeout: timer.clearTimeout });
  state.set('dshw-pos', 'x');
  assert.equal(timer.size(), 1);
  await state.flush();
  assert.equal(timer.size(), 0);
  assert.equal(pushes, 1);
});

test('subscribers see local writes and values reconciled from the main process', async () => {
  const storage = storageStub(); const timer = clock(); const seen = [];
  const state = createUiState({ storage, bridge: { storage: {}, save: () => Promise.resolve({ ok: true, values: { 'dshw-bubble-shape': 'round' } }) },
    setTimeout: timer.setTimeout, clearTimeout: timer.clearTimeout });
  state.subscribe('dshw-bubble-shape', value => seen.push(value));
  state.set('dshw-bubble-shape', 'ellipse');
  await state.flush();
  assert.deepEqual(seen, ['ellipse', 'round']);
});
