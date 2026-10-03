import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';
import { EventEmitter } from 'node:events';
import { PassThrough, Writable } from 'node:stream';
import { quotaFromAppServer, readCodexRateLimits } from '../runtime/codex-rate-limits.mjs';

const source = await fs.readFile(new URL('../desktop/ui/quota.js', import.meta.url), 'utf8');
const context = { module: { exports: {} } };
vm.runInNewContext(source, context);
const { countdown, countdownShort, resetAt, quotaBar, quotaState, quotaText, planText, peakText } = context.module.exports;

test('plan and all original peak styles resolve legacy and new placeholders', () => {
  const now=Date.parse('2026-10-02T10:00:00Z'),pricing={visible:true,phase:'peak',nextChangeAt:now+3600000};
  assert.equal(planText({tpl:'{plan_name}'},{planType:'plus'}),'Codex Plus');
  for(const [style,expected] of [['default','高峰时段'],['liangwen','梁文峰'],['qiangqiang','!?峰峰?!'],['mini','峰']])assert.equal(peakText({peakStyle:style,tpl:'{status}'},pricing,now),expected);
  assert.equal(peakText({type:'nextpeak',tpl:'{countdown}'},pricing,now),'01:00:00');
  assert.match(peakText({}, {visible:false},now),/无峰谷/);
});

test('Codex direct rate limits select only the ordinary 5-hour and weekly windows', () => {
  const now = 1_790_000_000_000;
  const result = quotaFromAppServer({
    rateLimits: { primary: { windowDurationMins: 300, usedPercent: 99 } },
    rateLimitsByLimitId: {
      codex: { primary: { windowDurationMins: 300, usedPercent: 40, resetsAt: now / 1000 + 3600 },
        secondary: { windowDurationMins: 10080, usedPercent: 43, resetsAt: now / 1000 + 86400 } },
      base_model_inference: { primary: { windowDurationMins: 10080, usedPercent: 80 } },
    },
  }, now);
  assert.deepEqual(result.map(w => [w.windowDurationMins, w.remainingPercent]), [[300, 60], [10080, 57]]);
  assert.equal(result[0].resetsAt, now + 3600000);
  assert.equal(result[0].stale, false);
});

test('DIY quota module counts down independently and labels missing or stale data', () => {
  const now = 1_790_000_000_000;
  const subscription = { source: 'codex-app-server', windows: [
    { windowDurationMins: 300, usedPercent: 40, resetsAt: now + 3661000 },
    { windowDurationMins: 10080, usedPercent: 43, resetsAt: now + 2 * 86400000 },
  ] };
  assert.equal(countdown(now + 3661000, now), '01:01:01');
  assert.equal(countdownShort(now + 3661000, now), '1小时 01分');
  assert.equal(countdownShort(now + 2 * 86400000 + 3600000, now), '2天 01小时');
  assert.equal(quotaBar(60), '━━━━━───');
  assert.match(resetAt(now + 3661000), /\d/);
  assert.equal(quotaText({ type: 'quota', windowDurationMins: 300,
    tpl: '{quota_label} {quota_left} · {quota_reset} · {quota_source}' }, subscription, now),
    '5 小时 60.0% · 01:01:01 · Codex 实时查询');
  assert.equal(quotaText({ type: 'quota', windowDurationMins: 300,
    tpl: '{quota_left_round} · {quota_reset_short} · {quota_bar}' }, subscription, now),
    '60% · 1小时 01分 · ━━━━━───');
  assert.match(quotaText({ type: 'quota', windowDurationMins: 10080 }, subscription, now), /57\.0% · 2天 00:00:00/);
  assert.match(quotaText({ type: 'quota', windowDurationMins: 300 }, { windows: [] }, now), /未观测/);
  assert.match(quotaText({ type: 'quota', windowDurationMins: 300 }, {
    source: 'local-session', windows: [{ windowDurationMins: 300, usedPercent: 40, resetsAt: now + 10000, observedAt: now - 16 * 60000 }],
  }, now), /未观测.*数据已过期/);
  assert.match(quotaText({ type: 'quota', windowDurationMins: 300 }, {
    source: 'codex-app-server', observedAt: now - 3 * 60000,
    windows: [{ windowDurationMins: 300, usedPercent: 40, resetsAt: now + 10000 }],
  }, now), /未观测.*数据已过期/);
});

test('quota tide state exposes remaining percentage and urgency tone', () => {
  const now = Date.UTC(2026, 9, 3, 4, 0, 0);
  const subscription = usedPercent => ({
    source: 'codex-app-server',
    windows: [{ windowDurationMins: 300, usedPercent, resetsAt: now + 60_000 }],
  });
  const steady = quotaState({ windowDurationMins: 300 }, subscription(36), now);
  assert.deepEqual({ left: steady.left, tone: steady.tone }, { left: 64, tone: 'steady' });
  assert.equal(quotaState({ windowDurationMins: 300 }, subscription(65), now).tone, 'caution');
  assert.equal(quotaState({ windowDurationMins: 300 }, subscription(85), now).tone, 'critical');
  assert.equal(quotaState({ windowDurationMins: 300 }, subscription(85), now + 120_000).tone, 'unknown');
});

test('direct Codex reader initializes app-server and requests rate limits without a login flow', async () => {
  const sent = [];
  function spawnImpl(executable, args, options) {
    assert.equal(executable, 'mock-codex');
    assert.deepEqual(args, ['app-server', '--stdio']);
    assert.equal(options.env.CODEX_HOME, 'C:/test-codex-home');
    const child = new EventEmitter();
    child.stdout = new PassThrough();
    child.stdin = new Writable({ write(chunk, _encoding, done) {
      const message = JSON.parse(String(chunk)); sent.push(message);
      if (message.method === 'initialize') queueMicrotask(() => child.stdout.write(JSON.stringify({ id: 1, result: {} }) + '\n'));
      if (message.method === 'account/rateLimits/read') queueMicrotask(() => {
        child.stdout.write(JSON.stringify({ id: 2, result: { rateLimits: {
          primary: { windowDurationMins: 300, usedPercent: 40, resetsAt: Math.ceil(Date.now() / 1000) + 3600 },
        } } }) + '\n');
      });
      done();
    } });
    child.kill = () => { child.emit('close', 0); return true; };
    return child;
  }
  const result = await readCodexRateLimits({ codexHome: 'C:/test-codex-home', executable: 'mock-codex', spawnImpl });
  assert.equal(result.windows[0].remainingPercent, 60);
  assert.deepEqual(sent.map(message => message.method), ['initialize', 'initialized', 'account/rateLimits/read']);
  assert.ok(sent.every(message => !/login|token|secret/i.test(JSON.stringify(message))));
});
