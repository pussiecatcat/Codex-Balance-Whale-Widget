import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { Worker } from 'node:worker_threads';
import { pricingSchedule } from './pricing-schedule.mjs';
import { createCodexRateLimitsClient } from './codex-rate-limits.mjs';

export function createInsightsService(config, { readRateLimits, clock = Date.now, collectLocal } = {}) {
  const client = readRateLimits ? null : createCodexRateLimitsClient({ codexHome: config.codexHome, clock });
  const read = readRateLimits || (options => client.read(options));
  let scopeKey = '', credentialKey = '', epoch = 0, closed = false;
  let lastGood = null, checkedAt = null, failure = null, pending = null, local = null, localPending = null;
  const workers = new Set();

  function context() {
    const c = config.resolve();
    let auth = {}, authChangedAt = 0;
    try {
      const file = path.join(config.codexHome, 'auth.json'), stat = fs.statSync(file);
      authChangedAt = stat.mtimeMs;
      if (stat.size < 1024 * 1024) auth = JSON.parse(fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, ''));
    } catch {}
    const subscribed = !c.key && c.id === 'openai' && (auth.auth_mode === 'chatgpt' || !!auth.tokens?.access_token);
    const digest = value => crypto.createHash('sha256').update(value).digest('hex');
    // Keep credentials private; account/mode changes invalidate both data and in-flight reads.
    const credential = digest(String(auth.tokens?.access_token || ''));
    const key = digest([c.accountId, subscribed, auth.tokens?.account_id || credential, c.setting.monitorSessions].join('\0'));
    if (key !== scopeKey) {
      scopeKey = key; epoch++; pending?.abort.abort(); pending = null;
      lastGood = null; checkedAt = null; failure = null; local = null; localPending = null;
      client?.reset();
    } else if (credentialKey !== credential) {
      pending?.abort.abort(); pending = null; checkedAt = null; client?.reset();
    }
    credentialKey = credential;
    return { c, subscribed, authChangedAt, epoch };
  }
  function scan(ctx) {
    if (closed || ctx.c.setting.monitorSessions === false) return Promise.resolve({});
    if (local && clock() - local.at < 60000) return Promise.resolve(local.data);
    if (localPending) return localPending;
    const job = (collectLocal ? Promise.resolve().then(() => collectLocal()) : new Promise(resolve => {
      const worker = new Worker(new URL('./insights-worker.mjs', import.meta.url), {
        workerData: { codexHome: config.codexHome, now: clock() },
      });
      workers.add(worker); let finished = false;
      const done = data => {
        if (finished) return; finished = true; clearTimeout(timeout);
        workers.delete(worker); void worker.terminate(); resolve(data);
      };
      const timeout = setTimeout(() => done({ error: 'observation-timeout' }), 8000); timeout.unref();
      worker.once('message', done); worker.once('error', () => done({}));
      worker.once('exit', () => done({}));
    })).catch(() => ({})).then(data => {
      if (!closed && ctx.epoch === epoch) local = { at: clock(), data };
      return data;
    }).finally(() => { if (localPending === job) localPending = null; });
    localPending = job;
    return job;
  }
  function snapshot(ctx) {
    const invalid = closed || !ctx.subscribed || failure === 'AUTH_REQUIRED';
    let value = invalid ? null : lastGood, source = value ? 'codex-app-server' : 'local-session';
    const fallback = local?.data;
    if (!invalid && !value && failure && fallback?.observedAt >= ctx.authChangedAt && fallback.windows?.length) value = fallback;
    const windows = value?.windows || [];
    const stale = !!value && (!!failure || clock() - value.observedAt > (source === 'local-session' ? 900000 : 120000));
    return { ok: true, pricing: pricingSchedule(ctx.c, clock()), tokens: local?.data?.tokens || null,
      subscription: { available: windows.length > 0, windows, observedAt: value?.observedAt || null,
        checkedAt, source, planType: value?.planType || null, stale, refreshing: !!pending,
        status: invalid ? 'unauthenticated' : failure ? (windows.length ? 'stale' : 'error') : windows.length ? 'ready' : 'unavailable',
        reason: invalid ? '请在 Codex 中登录订阅账号' : failure ? '查询暂不可用，正在重试' : windows.length ? '' : 'Codex 当前未提供五小时或每周额度',
        error: failure } };
  }
  async function getQuota({ force = false } = {}) {
    let ctx = context();
    if (closed || !ctx.subscribed) return snapshot(ctx);
    if (pending) {
      const previous = pending;
      await previous.promise;
      if (closed) return snapshot(context());
      if (ctx.epoch !== epoch) return getQuota({ force });
      if (force && !previous.force) return getQuota({ force: true });
      return snapshot(context());
    }
    if (!force && checkedAt !== null && clock() - checkedAt < (failure ? 3000 : 10000)) return snapshot(ctx);
    const current = { force, abort: new AbortController(), promise: null };
    pending = current;
    current.promise = (async () => {
      try {
        const value = await read({ codexHome: config.codexHome, signal: current.abort.signal });
        // Recheck disk identity before accepting a response obtained during an account switch.
        context();
        if (closed || ctx.epoch !== epoch || pending !== current) return;
        if (!value || !Array.isArray(value.windows)) throw new Error('unavailable');
        lastGood = value; checkedAt = clock(); failure = null;
      } catch (error) {
        context();
        if (closed || ctx.epoch !== epoch || pending !== current) return;
        checkedAt = clock(); failure = error.code === 'AUTH_REQUIRED' ? 'AUTH_REQUIRED' : 'UNAVAILABLE';
        if (failure === 'AUTH_REQUIRED') lastGood = null;
        // Recovery data is optional and never holds up the official quota response.
        else if (!lastGood) void scan(ctx);
      } finally { if (pending === current) pending = null; }
    })();
    await current.promise;
    ctx = context();
    return snapshot(ctx);
  }
  async function get(options = {}) {
    const ctx = context();
    await Promise.all([getQuota(options), scan(ctx)]);
    return snapshot(context());
  }
  return { get, getQuota, close() {
    closed = true; epoch++; pending?.abort.abort(); client?.close();
    for (const worker of workers) void worker.terminate();
    workers.clear(); lastGood = null; local = null;
  } };
}
