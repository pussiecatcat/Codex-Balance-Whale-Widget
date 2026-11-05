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
  ledger.observe(scope, { totalUsed: 10 }, now - 3600000);
  ledger.observe(scope, { totalUsed: 13 }, now);
  const records = ledger.records(scope, now);
  const today = ledger.today(scope, now);
  assert.equal(records.all.days.length, 50);
  assert.equal(records.all.days[0].models.length, 1);
  assert.ok(today.total > 0, 'the fast path must include observed consumption');
  assert.deepEqual(today.models, records.today.models);
  assert.equal(today.total, records.today.total);
  assert.equal(today.since, records.today.since);
  assert.equal(today.source, records.today.source);
  assert.equal(today.warning, records.warning);
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

test('legacy token-only root rows move to the identity ledger once and money stays put', t => {
  const ledger = new UsageLedger(fixture(t));
  const legacy = 'c'.repeat(24) + '-CNY', identity = 'd'.repeat(24) + '-CNY';
  const now = Date.parse('2026-11-04T02:00:00Z');
  ledger.append(legacy, { id: 'root', ts: now - 1000, tokens: 120, source: 'token-only', cost: null, costState: 'unknown' });
  ledger.append(legacy, { id: 'priced', ts: now - 900, tokens: 80, source: 'configured-pricing-estimate', cost: 1.5, costState: 'estimated' });
  ledger.append(legacy, { id: 'child', ts: now - 800, tokens: 10, isSubagent: true, source: 'subagent-token-only', cost: null });
  const before = fs.readFileSync(ledger.file(legacy), 'utf8');
  assert.equal(ledger.migrateLegacyTokenHistory(identity, now), 1);
  const migrated = ledger.find(identity, { id: 'root' });
  assert.equal(migrated.tokens, 120);
  assert.equal(migrated.cost, null);
  assert.equal(migrated.currency, 'CNY');
  assert.equal(migrated.migratedFrom, legacy);
  assert.equal(ledger.find(identity, { id: 'priced' }), null);
  assert.equal(ledger.find(identity, { id: 'child' }), null);
  assert.equal(ledger.migrateLegacyTokenHistory(identity, now), 0, 'a second launch must not duplicate rows');
  assert.equal(fs.readFileSync(ledger.file(legacy), 'utf8'), before, 'the old ledger is only read');
});

test('a balance poll writes a small sidecar instead of the whole event ledger', t => {
  const ledger = new UsageLedger(fixture(t));
  const scope = 'e'.repeat(24) + '-USD';
  const now = Date.parse('2026-11-04T02:00:00Z');
  ledger.append(scope, { id: 'kept', ts: now - 60000, model: 'gpt', cost: 1, source: 'configured-pricing-estimate' });
  // The first observation of a new day also writes the day boundary, so let it
  // finish before measuring what a steady poll touches.
  ledger.observe(scope, { totalUsed: 8 }, now);
  const mainBefore = fs.readFileSync(ledger.file(scope), 'utf8');
  ledger.observe(scope, { totalUsed: 10 }, now + 30000);
  assert.equal(fs.readFileSync(ledger.file(scope), 'utf8'), mainBefore, 'the event ledger is untouched by a meter update');
  assert.ok(fs.statSync(ledger.meterFile(scope)).size < 1024, 'the sidecar stays small');
  assert.equal(ledger.today(scope, now + 30000).total, 2, 'today() sees the sidecar delta');
  ledger.observe(scope, { totalUsed: 12 }, now + 60000);
  assert.equal(ledger.today(scope, now + 60000).total, 4, 'a newer meter value invalidates the today cache');
  ledger.append(scope, { id: 'later', ts: now + 120000, model: 'gpt', cost: 2, source: 'configured-pricing-estimate' });
  assert.equal(fs.existsSync(ledger.meterFile(scope)), false, 'a full save folds the sidecar into the main ledger');
  assert.equal(ledger.load(scope).lastObservation.used, 12);
});
