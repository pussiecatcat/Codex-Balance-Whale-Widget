import test from 'node:test';
import assert from 'node:assert/strict';
import { createSettingsClient, settingsCommand } from '../desktop/ui/services/settings-client.js';

test('commands contain only edited leaves and retain array values as one field', () => {
  const initial = { size: { vol: .9, scale: 1 }, usage: { events: { question: { vol: 1, on: true } }, turnCost: { lines: ['one'] } } };
  const next = structuredClone(initial); next.usage.events.question.vol = .4; next.usage.turnCost.lines.push('two');
  assert.deepEqual(settingsCommand(initial, next), { schemaVersion: 2,
    base: { usage: { events: { question: { vol: 1 } }, turnCost: { lines: ['one'] } } },
    patch: { usage: { events: { question: { vol: .4 } }, turnCost: { lines: ['one', 'two'] } } } });
  assert.equal(settingsCommand(initial, initial), null);
});

test('rapid updates capture intent, serialize reads and writes, and keep the newest value', async () => {
  let current = { schemaVersion: 2, size: { vol: .9 } }, unblock;
  const firstRead = new Promise(resolve => { unblock = resolve; });
  const calls = []; let reads = 0;
  const client = createSettingsClient(async (_url, options = {}) => {
    calls.push(options.method || 'GET');
    if (!options.method) { if (++reads === 1) await firstRead; return structuredClone(current); }
    assert.equal(options.body.base.size.vol, current.size.vol);
    current.size.vol = options.body.patch.size.vol; return structuredClone(current);
  });
  const value = { size: { vol: .2 } };
  const first = client.update(value); value.size.vol = .8;
  const second = client.update(value); value.size.vol = .5;
  unblock(); await Promise.all([first, second]);
  assert.deepEqual(calls, ['GET', 'PUT', 'GET', 'PUT']);
  assert.equal(current.size.vol, .8);
});

test('a conflict is surfaced without overwriting it and the queue continues afterward', async () => {
  let writes = 0;
  const client = createSettingsClient(async (_url, options = {}) => {
    if (!options.method) return { schemaVersion: 2, size: { vol: .9 } };
    if (++writes === 1) throw Object.assign(new Error('conflict'), { status: 409 });
    return { ok: true };
  });
  await assert.rejects(client.update({ size: { vol: .2 } }), error => error.status === 409);
  assert.equal(writes, 1);
  await client.update({ size: { vol: .4 } }); assert.equal(writes, 2);
});
