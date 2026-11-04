import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { UsageLedger } from '../runtime/ledger.mjs';

function fixture(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'whale-ledger-records-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  return dir;
}

test('records indexes per-day estimates once and today() matches the full view', t => {
  const ledger = new UsageLedger(fixture(t));
  const scope = 'a'.repeat(24) + '-USD';
  const now = Date.parse('2026-11-04T02:00:00Z'); // 10:00 in the UTC+8 accounting frame
  for (let i = 0; i < 50; i++) {
    ledger.append(scope, { id: 'event-' + i, ts: now - i * 86400000, model: 'gpt', cost: 1, source: 'configured-pricing-estimate' });
  }
  const records = ledger.records(scope, now);
  const today = ledger.today(scope, now);
  assert.equal(records.all.days.length, 50);
  assert.equal(records.all.days[0].models.length, 1);
  assert.deepEqual(today.models, records.today.models);
  assert.equal(today.total, records.today.total);
  assert.equal(today.note, records.note);
});

test('today() ignores estimates from other days and keeps the observed total', t => {
  const ledger = new UsageLedger(fixture(t));
  const scope = 'b'.repeat(24) + '-USD';
  const now = Date.parse('2026-11-04T02:00:00Z');
  ledger.append(scope, { id: 'old', ts: now - 86400000, model: 'old', cost: 9, source: 'configured-pricing-estimate' });
  ledger.append(scope, { id: 'new', ts: now, model: 'new', cost: 2, source: 'configured-pricing-estimate' });
  const today = ledger.today(scope, now);
  assert.equal(today.models.length, 1);
  assert.equal(today.models[0].model, 'new（估算）');
  assert.equal(today.models[0].cost, 2);
  assert.equal(today.total, 0);
});
