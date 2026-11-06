import test from 'node:test';
import assert from 'node:assert/strict';
import { createSettingsClient } from '../desktop/ui/services/settings-client.js';

function fixture() {
  const listeners = [];
  const writes = [];
  const bridge = {
    readSettings: async domains => ({ ok: true, values: { size: { scale: 1.5, domains } } }),
    writeSettings: async request => { writes.push(request); return { ok: true, values: request.changes, changedKeys: Object.keys(request.changes) }; },
    previewSettings: async request => ({ ok: true, values: request.changes }),
    onSettingsChanged: fn => { listeners.push(fn); return () => { const i = listeners.indexOf(fn); if (i >= 0) listeners.splice(i, 1); }; },
  };
  return { bridge, listeners, writes };
}

test('read caches the domain and write forwards the request unchanged', async () => {
  const { bridge, writes } = fixture();
  const client = createSettingsClient({ bridge });
  const read = await client.read(['size']);
  assert.deepEqual(read.values.size, { scale: 1.5, domains: ['size'] });
  assert.deepEqual(client.current('size'), { scale: 1.5, domains: ['size'] });
  const result = await client.write({ domain: 'size', changes: { scale: 2 }, force: true });
  assert.deepEqual(writes, [{ domain: 'size', changes: { scale: 2 }, force: true }]);
  assert.equal(result.ok, true);
});

test('a change from another window updates the mirror and notifies subscribers', () => {
  const { bridge, listeners } = fixture();
  const scope = { disposed: false, add(fn) { this.fn = fn; return fn; } };
  const client = createSettingsClient({ bridge, scope });
  const seen = [];
  client.subscribe('size', change => seen.push(change));
  listeners[0]({ domain: 'size', values: { scale: 1.9 }, revision: 2 });
  assert.equal(client.current('size').scale, 1.9);
  assert.equal(seen[0].revision, 2);
  scope.fn();
  assert.equal(listeners.length, 0, 'disposing the scope unsubscribes');
});
