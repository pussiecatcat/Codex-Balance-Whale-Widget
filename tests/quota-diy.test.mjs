import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import { EventEmitter } from 'node:events';
import { PassThrough, Writable } from 'node:stream';
import { quotaFromAppServer, readCodexRateLimits, resetCodexRateLimitsArgsCache } from '../runtime/codex-rate-limits.mjs';
import { createInsightsService } from '../runtime/insights.mjs';

const source = await fs.readFile(new URL('../desktop/ui/quota.js', import.meta.url), 'utf8');
const context = { module: { exports: {} } };
vm.runInNewContext(source, context);
const { countdown, countdownShort, resetAt, snapshotAt, percentNumber, quotaBar, quotaState, quotaText, planText, peakText } = context.module.exports;

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
  }, now), /60\.0%.*上次数据，待同步/);
  assert.match(quotaText({ type: 'quota', windowDurationMins: 300 }, {
    source: 'codex-app-server', observedAt: now - 3 * 60000,
    windows: [{ windowDurationMins: 300, usedPercent: 40, resetsAt: now + 10000 }],
  }, now), /60\.0%.*上次数据，待同步/);
});

test('quota tide state exposes remaining percentage and urgency tone', () => {
  const now = Date.UTC(2026, 9, 3, 4, 0, 0);
  const subscription = usedPercent => ({
    source: 'codex-app-server',
    windows: [{ windowDurationMins: 300, usedPercent, resetsAt: now + 60_000 }],
  });
  const steady = quotaState({ windowDurationMins: 300 }, subscription(36), now);
  assert.deepEqual({ left: steady.left, tone: steady.tone }, { left: 64, tone: 'steady' });
  assert.equal(percentNumber(64), '64');
  assert.equal(percentNumber(63.6), '63.6');
  assert.match(snapshotAt(now), /^\d{2}:\d{2}:\d{2}$/);
  assert.equal(quotaState({ windowDurationMins: 300 }, subscription(65), now).tone, 'caution');
  assert.equal(quotaState({ windowDurationMins: 300 }, subscription(85), now).tone, 'critical');
  assert.equal(quotaState({ windowDurationMins: 300 }, subscription(85), now + 120_000).tone, 'unknown');
});

test('forced Codex insight refresh bypasses the thirty-second snapshot cache', async t => {
  const codexHome = await fs.mkdtemp(path.join(os.tmpdir(), 'whale-insights-'));
  await fs.writeFile(path.join(codexHome, 'auth.json'), JSON.stringify({ auth_mode: 'chatgpt', tokens: { account_id: 'fixture', access_token: 'fixture' } }));
  t.after(() => fs.rm(codexHome, { recursive: true, force: true }));
  let now = 1_790_000_000_000, calls = 0;
  const config = { codexHome, resolve: () => ({ accountId: 'fixture', id: 'openai', key: null,
    baseUrl: 'https://api.openai.com/v1', setting: { monitorSessions: false } }) };
  const service = createInsightsService(config, { clock: () => now, readRateLimits: async () => ({
    observedAt: now, planType: 'plus', windows: [{ windowDurationMins: 300, usedPercent: ++calls, resetsAt: now + 3600000 }],
  }) });
  t.after(() => service.close());
  assert.equal((await service.get()).subscription.windows[0].usedPercent, 1);
  now += 1000;
  assert.equal((await service.get()).subscription.windows[0].usedPercent, 1);
  assert.equal(calls, 1);
  assert.equal((await service.get({ force: true })).subscription.windows[0].usedPercent, 2);
  assert.equal(calls, 2);
});

test('direct Codex reader initializes app-server and requests rate limits without a login flow', async () => {
  resetCodexRateLimitsArgsCache();
  const sent = [];
  function spawnImpl(executable, args, options) {
    assert.equal(executable, 'mock-codex');
    // codex-cli 0.120.0 起 --stdio 已被移除，现在先试 --listen stdio://。
    assert.deepEqual(args, ['app-server', '--listen', 'stdio://']);
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
  resetCodexRateLimitsArgsCache();
});

test('a Codex build that rejects --listen falls back to the legacy --stdio form', async () => {
  resetCodexRateLimitsArgsCache();
  const attempts = [];
  function spawnImpl(executable, args) {
    attempts.push(args);
    const child = new EventEmitter();
    child.stdout = new PassThrough();
    child.stderr = new PassThrough();
    child.kill = () => { child.emit('close', 0); return true; };
    child.stdin = new Writable({ write(chunk, _encoding, done) {
      const message = JSON.parse(String(chunk));
      if (args.includes('--stdio')) {
        // 旧写法：正常回数据。
        if (message.method === 'initialize') queueMicrotask(() => child.stdout.write(JSON.stringify({ id: 1, result: {} }) + '\n'));
        if (message.method === 'account/rateLimits/read') queueMicrotask(() => child.stdout.write(JSON.stringify({ id: 2, result: { rateLimits: {
          primary: { windowDurationMins: 300, usedPercent: 40, resetsAt: Math.ceil(Date.now() / 1000) + 3600 },
        } } }) + '\n'));
      } else {
        // 新写法在这个「旧版本」上被拒。
        queueMicrotask(() => { child.stderr.write("error: unexpected argument '--listen' found\n"); child.emit('close', 2); });
      }
      done();
    } });
    return child;
  }
  const result = await readCodexRateLimits({ codexHome: 'C:/test-codex-home', executable: 'legacy-mock-codex', spawnImpl });
  assert.equal(result.windows[0].usedPercent, 40, '回退后应拿到额度');
  assert.equal(attempts.length, 2, '应先试新写法再回退（实际 ' + attempts.length + ' 次）');
  assert.deepEqual(attempts[0], ['app-server', '--listen', 'stdio://']);
  assert.deepEqual(attempts[1], ['app-server', '--stdio']);

  // 记住可用的写法，第二次不再白试新写法。
  const before = attempts.length;
  await readCodexRateLimits({ codexHome: 'C:/test-codex-home', executable: 'legacy-mock-codex', spawnImpl });
  assert.equal(attempts.length, before + 1, '命中缓存后应只起一次进程');
  resetCodexRateLimitsArgsCache();
});

test('a cached arg form that is rejected again is renegotiated', async () => {
  resetCodexRateLimitsArgsCache();
  let rejecting = true;
  const attempts = [];
  function spawnImpl(executable, args) {
    attempts.push(args);
    const child = new EventEmitter();
    child.stdout = new PassThrough();
    child.stderr = new PassThrough();
    child.kill = () => { child.emit('close', 0); return true; };
    child.stdin = new Writable({ write(chunk, _encoding, done) {
      const message = JSON.parse(String(chunk));
      if (args.includes('--stdio') && !rejecting) {
        if (message.method === 'initialize') queueMicrotask(() => child.stdout.write(JSON.stringify({ id: 1, result: {} }) + '\n'));
        if (message.method === 'account/rateLimits/read') queueMicrotask(() => child.stdout.write(JSON.stringify({ id: 2, result: { rateLimits: {
          primary: { windowDurationMins: 300, usedPercent: 40, resetsAt: Math.ceil(Date.now() / 1000) + 3600 },
        } } }) + '\n'));
      } else {
        queueMicrotask(() => { child.stderr.write("error: unexpected argument '" + (args.includes('--stdio') ? '--stdio' : '--listen') + "' found\n"); child.emit('close', 2); });
      }
      done();
    } });
    return child;
  }
  // 两种写法当前都被拒：有界重试后失败，缓存里两种都标记为不可用。
  await assert.rejects(
    readCodexRateLimits({ codexHome: 'C:/test-codex-home', executable: 'upgraded-mock-codex', spawnImpl }),
    /参数不被当前版本支持/,
  );
  assert.equal(attempts.length, 2, '两种写法各试一次（实际 ' + attempts.length + ' 次）');
  // 之后旧版本写法恢复可用：被拒缓存不挡住重新协商。
  rejecting = false;
  const result = await readCodexRateLimits({ codexHome: 'C:/test-codex-home', executable: 'upgraded-mock-codex', spawnImpl });
  assert.equal(result.windows[0].usedPercent, 40);
  assert.deepEqual(attempts[attempts.length - 1], ['app-server', '--stdio']);
  resetCodexRateLimitsArgsCache();
});

test('a genuine failure is not retried with the other argument form', async () => {
  resetCodexRateLimitsArgsCache();
  let attempts = 0;
  function spawnImpl(executable, args) {
    attempts++;
    const child = new EventEmitter();
    child.stdout = new PassThrough();
    child.stderr = new PassThrough();
    child.kill = () => { child.emit('close', 1); return true; };
    child.stdin = new Writable({ write(_chunk, _encoding, done) {
      // 没有「参数被拒」的特征，只是没登录 / 起不来，不该换写法重试。
      queueMicrotask(() => child.emit('close', 1));
      done();
    } });
    return child;
  }
  await assert.rejects(
    readCodexRateLimits({ codexHome: 'C:/test-codex-home', executable: 'broken-codex', spawnImpl }),
    /Codex 额度查询已结束/,
  );
  assert.equal(attempts, 1, '非参数类失败不应重试（实际 ' + attempts + ' 次）');
  resetCodexRateLimitsArgsCache();
});
