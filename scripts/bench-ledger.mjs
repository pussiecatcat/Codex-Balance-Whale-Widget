import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { UsageLedger } from '../runtime/ledger.mjs';

const EVENTS = 20000, DAYS = 90;
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'whale-bench-'));
const ledger = new UsageLedger(dir);
const scope = 'a'.repeat(24) + '-USD';
const now = Date.parse('2026-11-04T02:00:00Z');
const dayKey = ts => new Date(ts + 8 * 3600000).toISOString().slice(0, 10);
const events = Array.from({ length: EVENTS }, (_, index) => {
  const day = Math.floor(index / Math.ceil(EVENTS / DAYS));
  const ts = now - day * 86400000;
  return { id: 'event-' + index, ts, day: dayKey(ts), model: 'model-' + (index % 5), cost: 0.0001, source: 'configured-pricing-estimate' };
});
ledger.save(scope, { version: 1, revision: 0, date: dayKey(now), observed: 0, firstObservation: now, lastObservation: null, history: {}, events, correctionLog: [] });

const best = fn => Math.min(...Array.from({ length: 5 }, () => {
  const start = process.hrtime.bigint();
  fn();
  return Number(process.hrtime.bigint() - start) / 1e6;
}));
const recordsMs = best(() => ledger.records(scope, now));
const todayMs = best(() => ledger.today(scope, now));
const result = { events: EVENTS, days: DAYS, recordsMs: Number(recordsMs.toFixed(1)), todayMs: Number(todayMs.toFixed(1)) };
process.stdout.write(JSON.stringify(result) + '\n');
fs.rmSync(dir, { recursive: true, force: true });

const RECORDS_BUDGET_MS = 800;
const TODAY_BUDGET_MS = 120;
if (process.argv.includes('--check') && (recordsMs > RECORDS_BUDGET_MS || todayMs > TODAY_BUDGET_MS)) {
  process.stderr.write(`Ledger benchmark over budget: records ${recordsMs.toFixed(1)} ms > ${RECORDS_BUDGET_MS}, today ${todayMs.toFixed(1)} ms > ${TODAY_BUDGET_MS}\n`);
  process.exitCode = 1;
}
