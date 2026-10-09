import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import { EventEmitter } from 'node:events';
import { PassThrough, Writable } from 'node:stream';
import { createCodexRateLimitsClient } from '../runtime/codex-rate-limits.mjs';
import { createInsightsService } from '../runtime/insights.mjs';

const defer = () => { let resolve; const promise = new Promise(r => { resolve = r; }); return { promise, resolve }; };
const tick = () => new Promise(resolve => setImmediate(resolve));
const result = used => ({ rateLimits: { planType: 'plus', primary: { usedPercent: used, windowDurationMins: 300, resetsAt: Date.now() / 1000 + 3600 } } });
function fakeProcess(responder = () => ({ result: result(20) })) {
  const children = [], sent = [];
  const spawnImpl = () => {
    const child = new EventEmitter(); child.stdout = new PassThrough(); child.killed = false;
    child.stdin = new Writable({ write(chunk, encoding, callback) {
      const message = JSON.parse(String(chunk)); sent.push(message);
      queueMicrotask(() => {
        const reply = message.method === 'initialize' ? { result: {} } :
          message.method === 'account/rateLimits/read' ? responder(message, children.length) : null;
        if (reply && !child.killed) child.stdout.write(JSON.stringify({ id: message.id, ...reply }) + '\n');
      }); callback();
    } });
    child.kill = () => { child.killed = true; child.emit('close'); };
    children.push(child); return child;
  };
  return { spawnImpl, children, sent };
}
test('quota reader reuses one initialized connection and closes it on shutdown', async () => {
  const fake = fakeProcess(); const client = createCodexRateLimitsClient({ ...fake, executable: 'fixture' });
  try {
    assert.equal((await client.read()).windows[0].remainingPercent, 80);
    await client.read();
    assert.equal(fake.children.length, 1);
    assert.equal(fake.sent.filter(x => x.method === 'initialize').length, 1);
    assert.equal(fake.sent.filter(x => x.method === 'account/rateLimits/read').length, 2);
  } finally { client.close(); }
  assert.ok(fake.children.every(x => x.killed));
  await assert.rejects(client.read(), { code: 'ABORTED' });
});
test('transient RPC failure retries once on a new connection; authentication failure does not retry', async () => {
  const fake = fakeProcess((_message, processCount) => processCount === 1 ? { error: { message: 'temporary outage' } } : { result: result(21) });
  const client = createCodexRateLimitsClient({ ...fake, executable: 'fixture' });
  try { assert.equal((await client.read()).windows[0].usedPercent, 21); assert.equal(fake.children.length, 2); }
  finally { client.close(); }
  const bad = fakeProcess(() => ({ error: { code: 401, message: 'Unauthorized secret must not leak' } }));
  const denied = createCodexRateLimitsClient({ ...bad, executable: 'fixture' });
  try {
    await assert.rejects(denied.read(), error => error.code === 'AUTH_REQUIRED' && !error.message.includes('secret'));
    assert.equal(bad.children.length, 1);
  } finally { denied.close(); }
});
test('quota timeout and cancellation cannot leave an orphaned query process', async () => {
  const fake = fakeProcess(() => null), keepAlive = setInterval(() => {}, 100);
  const client = createCodexRateLimitsClient({ ...fake, executable: 'fixture', timeoutMs: 15 });
  try {
    await assert.rejects(client.read(), { code: 'TIMEOUT' });
    assert.equal(fake.children.length, 2); assert.ok(fake.children.every(x => x.killed));
    const abort = new AbortController(), reading = client.read({ signal: abort.signal });
    await tick(); abort.abort(); await assert.rejects(reading, { code: 'ABORTED' });
    assert.ok(fake.children.every(x => x.killed));
  } finally { clearInterval(keepAlive); client.close(); }
});
async function serviceFixture(t, options = {}) {
  const codexHome = await fs.mkdtemp(path.join(os.tmpdir(), 'whale-quota-reliable-'));
  const auth = account => fs.writeFile(path.join(codexHome, 'auth.json'), JSON.stringify({ auth_mode: 'chatgpt', tokens: { account_id: account, access_token: account } }));
  await auth('first');
  let now = Date.now();
  const config = { codexHome, resolve: () => ({ accountId: 'fixture', id: 'openai', key: null,
    baseUrl: 'https://api.openai.com/v1', setting: { monitorSessions: true } }) };
  const value = used => ({ observedAt: now, planType: 'plus', windows: [{ observedAt: now, windowDurationMins: 300, usedPercent: used, resetsAt: now + 3600000 }] });
  const service = createInsightsService(config, { clock: () => now, collectLocal: async () => ({}), ...options });
  t.after(async () => { service.close(); await fs.rm(codexHome, { recursive: true, force: true }); });
  return { service, value, auth, codexHome, advance: ms => { now += ms; } };
}
test('failed refresh preserves successful quota and its original observation time; next success recovers', async t => {
  let fail = false, calls = 0, fixture;
  fixture = await serviceFixture(t, { readRateLimits: async () => { calls++; if (fail) throw Error('offline'); return fixture.value(calls); } });
  const first = (await fixture.service.getQuota()).subscription;
  fail = true; fixture.advance(1000);
  const stale = (await fixture.service.getQuota({ force: true })).subscription;
  assert.equal(stale.windows[0].usedPercent, first.windows[0].usedPercent);
  assert.equal(stale.observedAt, first.observedAt); assert.equal(stale.status, 'stale');
  await fixture.service.getQuota(); assert.equal(calls, 2, 'failed reads have a short cooldown');
  fixture.advance(3001); fail = false;
  const recovered = (await fixture.service.getQuota()).subscription;
  assert.equal(recovered.status, 'ready'); assert.equal(recovered.windows[0].usedPercent, 3);
});
test('quota fast path never waits for history scans and concurrent opens coalesce', async t => {
  const history = defer(), query = defer(); let calls = 0, scans = 0, fixture;
  fixture = await serviceFixture(t, { readRateLimits: async () => { calls++; await query.promise; return fixture.value(30); },
    collectLocal: () => { scans++; return history.promise; } });
  let complete = false;
  const full = fixture.service.get().then(x => { complete = true; return x; });
  const fast = fixture.service.getQuota(); query.resolve();
  assert.equal((await fast).subscription.windows[0].usedPercent, 30);
  assert.equal(complete, false); assert.equal(calls, 1); assert.equal(scans, 1);
  history.resolve({ tokens: { total: 17 } });
  assert.equal((await full).tokens.total, 17);
});
test('forced request behind normal read runs once after it; concurrent force callers share the result', async t => {
  const gate = defer(); let calls = 0, fixture;
  fixture = await serviceFixture(t, { readRateLimits: async () => { const n = ++calls; if (n === 1) await gate.promise; return fixture.value(n); } });
  const first = fixture.service.getQuota(), force1 = fixture.service.getQuota({ force: true }), force2 = fixture.service.getQuota({ force: true });
  gate.resolve(); await first;
  assert.equal((await force1).subscription.windows[0].usedPercent, 2);
  assert.equal((await force2).subscription.windows[0].usedPercent, 2); assert.equal(calls, 2);
});
test('account change or logout cannot display a previous account or accept a late result', async t => {
  const gate = defer(); let calls = 0, fixture;
  fixture = await serviceFixture(t, { readRateLimits: async () => { calls++; if (calls === 2) await gate.promise; return fixture.value(11); } });
  await fixture.service.getQuota(); const late = fixture.service.getQuota({ force: true });
  await fixture.auth('second'); gate.resolve();
  assert.equal((await late).subscription.available, false);
  await fs.writeFile(path.join(fixture.codexHome, 'auth.json'), '{}');
  const loggedOut = (await fixture.service.getQuota({ force: true })).subscription;
  assert.equal(loggedOut.available, false); assert.equal(loggedOut.status, 'unauthenticated'); assert.equal(calls, 2);
});
test('explicit authentication errors clear cached quota; authoritative empty windows are not hidden by last-good data', async t => {
  let mode = 'ok', fixture;
  fixture = await serviceFixture(t, { readRateLimits: async () => {
    if (mode === 'auth') throw Object.assign(Error('private'), { code: 'AUTH_REQUIRED' });
    return mode === 'empty' ? { windows: [], observedAt: Date.now() } : fixture.value(20);
  } });
  await fixture.service.getQuota(); mode = 'auth';
  assert.equal((await fixture.service.getQuota({ force: true })).subscription.available, false);
  mode = 'ok'; await fixture.service.getQuota({ force: true }); mode = 'empty';
  assert.equal((await fixture.service.getQuota({ force: true })).subscription.available, false);
});

const quotaSource = await fs.readFile(new URL('../desktop/ui/quota.js', import.meta.url), 'utf8');
function frontend() {
  let now = Date.now(), response = { ok: true, subscription: { available: true, status: 'ready', source: 'codex-app-server', observedAt: now,
    windows: [{ windowDurationMins: 300, usedPercent: 20, resetsAt: now + 3600000 }] } }, failing = false;
  const listeners = {}, intervals = new Map(), timeouts = new Map(), requests = []; let timerId = 0;
  const box = { AbortController, Date: class extends Date { static now() { return now; } }, document: {},
    window: { addEventListener: (name, fn) => { listeners[name] = fn; } },
    setInterval: (fn, ms) => { intervals.set(++timerId, { fn, ms }); return timerId; }, clearInterval: id => intervals.delete(id),
    setTimeout: (fn, ms) => { timeouts.set(++timerId, { fn, ms }); return timerId; }, clearTimeout: id => timeouts.delete(id),
    fetch: async url => { requests.push(url); if (failing) throw Error('offline'); return { ok: true, json: async () => url.startsWith('/api/pricing') ? {} : structuredClone(response) }; },
  };
  vm.runInNewContext(quotaSource, box);
  return { api: box.window.WhaleQuota, requests, listeners, intervals, timeouts,
    advance: ms => { now += ms; }, fail: flag => { failing = flag; }, setResponse: data => { response = data; } };
}
test('frontend prewarms while closed, retries failures, retains marked data, and clears on logout', async () => {
  const ui = frontend(); ui.listeners['whale-account-view']({ detail: { mode: 'subscription' } }); await tick();
  assert.ok(ui.requests.includes('/api/quota?refresh=1'));
  ui.advance(31000); for (const timer of ui.intervals.values()) timer.fn(); await tick();
  assert.equal(ui.requests.filter(url => url.startsWith('/api/quota')).length, 2, 'closed bubbles still prefetch');
  ui.fail(true); await ui.api.refresh(true);
  assert.match(ui.api.text({ windowDurationMins: 300 }), /80\.0%.*上次数据/);
  ui.fail(false); ui.advance(3001); for (const timer of ui.intervals.values()) timer.fn(); await tick();
  assert.doesNotMatch(ui.api.text({ windowDurationMins: 300 }), /上次数据/);
  ui.setResponse({ ok: true, subscription: { available: false, windows: [], status: 'unauthenticated' } });
  await ui.api.refresh(true); assert.doesNotMatch(ui.api.text({ windowDurationMins: 300 }), /80/);
  ui.listeners.pagehide(); assert.equal(ui.intervals.size, 0); assert.equal(ui.timeouts.size, 0);
});
test('stale quota across the reset boundary stays explicitly historical, never becomes a fabricated refill', async () => {
  const ui = frontend(); await ui.api.refresh(true); ui.advance(3600001);
  const text = ui.api.text({ windowDurationMins: 300 });
  assert.match(text, /80\.0%.*等待额度更新.*上次数据/); assert.doesNotMatch(text, /100\.0%/);
});
