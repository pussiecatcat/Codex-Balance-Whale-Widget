import test from 'node:test';
import assert from 'node:assert/strict';
import { createConfigSync, savedAnchor } from '../desktop/ui/features/widget/config-sync.js';

function fixture(requestJson) {
  const state = { balance: null, left: 150, top: 100 };
  const notices = [], errors = [], stored = new Map();
  const root = {};
  const sync = createConfigSync({ requestJson, settingsUrl: '/settings', balanceUrl: '/balance',
    root, localStorage: { setItem: (key, value) => stored.set(key, value) }, getState: () => state,
    getAccountView: () => ({ mode: 'api' }), setNativeCurrency() {}, onBalance: value => notices.push(value),
    checkAlerts() {}, requireSaved: value => assert.equal(value.ok, true), onError: error => errors.push(error),
    getSizeSettings: () => ({ scale: 1.5 }),
    getPosition: () => ({ state, viewport: { w: 300, h: 200 }, width: 100, height: 80, rightGap: 17 }),
  });
  return { sync, state, notices, errors, stored, root };
}

test('settings retry merges the newest snapshot and preserves unrelated values', async () => {
  const writes = []; let revision = 1;
  const f = fixture(async (url, options) => {
    if (!options) return { ok: true, schemaVersion: 1, revision, size: { color: revision }, usage: { taskEnd: { on: true } } };
    writes.push(options.body);
    if (revision++ === 1) throw Object.assign(Error('conflict'), { status: 409 });
    return { ok: true };
  });
  await f.sync.save();
  assert.deepEqual(writes.map(write => write.size), [{ color: 1, scale: 1.5 }, { color: 2, scale: 1.5 }]);
  assert.deepEqual(writes[1].usage, { taskEnd: { on: true } });
  assert.equal(f.errors.length, 0);
  assert.deepEqual(JSON.parse(f.stored.get('dshw-pos')), { v: 2, hAnchor: 'right', hDist: 33, vAnchor: 'bottom', vDist: 20 });
});

test('balance refresh coalesces requests, clears busy and keeps private provider names off the tooltip', async () => {
  let resolve, count = 0;
  const f = fixture(() => { count++; return new Promise(done => { resolve = done; }); });
  const pending = f.sync.refresh(true);
  f.sync.refresh(false);
  assert.equal(count, 1); assert.equal(f.sync.busy, true);
  resolve({ ok: true, totalBalance: 3.25, currency: 'USD', providerName: 'private fixture', balanceLabel: 'API 可用余额', todayUsage: .1 });
  await pending;
  assert.equal(f.sync.busy, false); assert.equal(f.state.status, 'ok');
  assert.equal(f.state.balance, 3.25); assert.equal(f.root.title, 'API 可用余额');
});

test('saved anchors clamp distances and account for the scrollbar gap only on the right', () => {
  assert.deepEqual(savedAnchor({ state: { left: 8, top: 4 }, viewport: { w: 200, h: 100 }, width: 20, height: 30, rightGap: 17 }),
    { v: 2, hAnchor: 'left', hDist: 8, vAnchor: 'top', vDist: 4 });
});
