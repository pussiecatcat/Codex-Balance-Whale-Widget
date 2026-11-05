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
const model = 'gpt-5-codex';
const note = '根据 Codex 记录的 token 数量与手动配置价格估算，包含本主轮已记录的子任务用量；服务商折扣、缓存策略和账单延迟可能造成差异。这是本轮运行期间同一 API 密钥的已观测合计扣费，可能含其他任务或设备的调用；并非逐请求最终账单。';
const usage = () => ({ [model]: { input_tokens: 800, cached_input_tokens: 200, output_tokens: 400 } });

// Shape taken from the events TurnAccounting actually appends. The previous
// benchmark used six fields per event (about 8.6x smaller), so its parse time
// said little about a real ledger and it never measured a write.
const events = Array.from({ length: EVENTS }, (_, index) => {
  const day = Math.floor(index / Math.ceil(EVENTS / DAYS));
  const ts = now - day * 86400000;
  return {
    id: 'event-' + index, ts, day: dayKey(ts), sessionId: 'session-' + (index % 50),
    sessionLabel: 'Codex 会话 ' + (index % 50), turnId: 'turn-' + index, rootTurnId: 'turn-' + index,
    accountId: 'a'.repeat(24), model, label: '上一轮消耗（估算）:', note,
    cost: 0.0001, amount: 0.0001, costState: 'estimated', source: 'configured-pricing-estimate',
    tokens: 1200, childTurns: 2, ownByModel: usage(), byModel: usage(),
    currency: 'USD', pricing: { [model]: { input: 1, cachedInput: 0.5, output: 2 } }, pricingCurrency: 'USD',
    revision: 1, partial: false, historical: false, outcome: 'completed', failureKind: null,
  };
});
ledger.save(scope, { version: 1, revision: 0, date: dayKey(now), observed: 0, firstObservation: now, lastObservation: null, history: {}, events, correctionLog: [] });
const bytes = fs.statSync(ledger.file(scope)).size;

const time = fn => {
  const start = process.hrtime.bigint();
  fn();
  return Number(process.hrtime.bigint() - start) / 1e6;
};
const stats = (fn, runs = 5, before = () => {}) => {
  const samples = Array.from({ length: runs }, () => { before(); return time(fn); }).sort((a, b) => a - b);
  return { median: Number(samples[Math.floor(samples.length / 2)].toFixed(1)), max: Number(samples.at(-1).toFixed(1)) };
};

const loadMs = stats(() => ledger.load(scope));
const recordsMs = stats(() => ledger.records(scope, now));
const todayMs = stats(() => ledger.today(scope, now), 5, () => ledger.clearReadCache(scope));
ledger.clearReadCache(scope); ledger.today(scope, now);
const todayWarmMs = stats(() => ledger.today(scope, now));

// A successful provider poll with an unchanged balance should not rewrite the
// file. Measure both sides so a regression in the no-op path is visible too.
let used = 100;
const observeMs = stats(() => ledger.observe(scope, { totalUsed: ++used }, Date.now()), 3);
const steadyMs = stats(() => ledger.observe(scope, { totalUsed: used }, Date.now()), 3);

const result = {
  events: EVENTS, days: DAYS, bytes,
  loadMs, recordsMs, todayMs, todayWarmMs, observeMs, steadyObserveMs: steadyMs,
};
process.stdout.write(JSON.stringify(result) + '\n');
fs.rmSync(dir, { recursive: true, force: true });

// Generous enough for a slower Windows CI runner, tight enough to catch a
// return to full-ledger work on the today path. Re-measure before tightening.
const BUDGETS = { load: 500, records: 800, today: 400, todayWarm: 5, observe: 1500, steadyObserve: 500 };
const over = Object.entries(BUDGETS).filter(([key, limit]) => result[key + 'Ms'].median > limit);
if (process.argv.includes('--check') && over.length) {
  process.stderr.write('Ledger benchmark over budget: ' + over.map(([key, limit]) => `${key} ${result[key + 'Ms'].median} ms > ${limit}`).join(', ') + '\n');
  process.exitCode = 1;
}
