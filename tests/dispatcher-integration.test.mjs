import test from 'node:test';
import assert from 'node:assert/strict';
import nodeFs from 'node:fs';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { createDispatcher } from '../runtime/dispatcher.mjs';
import { MEDIA_POLICY } from '../lib/media-validation.mjs';
import { FX_POLICY } from '../runtime/fx.mjs';
import { usageDefaults } from '../runtime/ledger.mjs';
import { writeJson } from '../runtime/paths.mjs';

const fxResponse = rate => new Response(JSON.stringify({ amount: 1, base: 'USD', date: '2026-09-15', rates: { CNY: rate } }));
async function setup(t, options = {}) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'whale-dispatcher-'));
  const { initialMode, ...serverOptions } = options;
  if (initialMode) await fs.writeFile(path.join(root, 'display-mode.json'), JSON.stringify({ version: 1, mode: initialMode }));
  const state = { balances: 0, closes: 0 };
  const resolveUsage = saved => {
    const defaults = usageDefaults(), result = { ...saved };
    for (const key of Object.keys(defaults)) result[key] = { ...defaults[key], ...(saved?.[key] || {}) };
    for (const kind of Object.keys(defaults.events)) result.events[kind] = { ...defaults.events[kind], ...(saved?.events?.[kind] || {}) };
    return result;
  };
  const service = {
    config: { codexHome: path.join(root, 'codex'), publicInfo: () => ({ settings: { monitorSessions: false } }), resolve: () => ({ model: 'test', setting: { monitorSessions: false } }) },
    turns: new Map(),
    getBalance: async () => { state.balances++; return { ok: true, totalBalance: 20 }; },
    close: async args => { state.closes++; assert.equal(args.timeoutMs, 3000); },
    resolveUsageSettings: saved => resolveUsage(saved || {}),
    prepareUsageSettings: (patch, { base = {} } = {}) => {
      const result = resolveUsage(base);
      for (const key of Object.keys(result)) if (key !== 'events' && patch[key] && typeof patch[key] === 'object') result[key] = { ...result[key], ...patch[key] };
      for (const kind of Object.keys(result.events)) if (patch.events?.[kind]) result.events[kind] = { ...result.events[kind], ...patch.events[kind] };
      return result;
    },
    commitUsageSettings: (settings, { fs: fileSystem = nodeFs } = {}) => {
      writeJson(path.join(root, 'usage-settings.json'), settings, { fs: fileSystem });
      return { ok: true, settings };
    },
    ...serverOptions.service,
  };
  const server = createDispatcher({ dataDir: root, monitor: false, autoRefresh: false, fxFetchImpl: async () => fxResponse(6.7), ...serverOptions, service });
  t.after(async () => {
    await server.close().catch(() => {});
    const resolved = path.resolve(root);
    assert.ok(resolved.startsWith(path.resolve(os.tmpdir()) + path.sep) && path.basename(resolved).startsWith('whale-dispatcher-'));
    await fs.rm(resolved, { recursive: true, force: true });
  });
  async function request(route, method = 'GET', body = null) { const response = await server.dispatch(route, { method, body }); return { ...response, payload: JSON.parse(response.body.toString()) }; }
  return { server, state, service, root, request };
}

test('media policy and the guarded script are served locally before widget startup', async t => {
  const { server, request } = await setup(t);
  const policy = await request('/api/media-policy'); assert.equal(policy.status, 200); assert.deepEqual(policy.payload.policy, MEDIA_POLICY);
  assert.equal((await request('/api/media-policy', 'PUT')).status, 405);
  const script = await server.dispatch('/media-guard.js'); assert.equal(script.status, 200); assert.match(script.headers['content-type'], /javascript/); assert.match(script.body.toString(), /WhaleMediaGuard/);
  const head = await server.dispatch('/media-guard.js', { method: 'HEAD' }); assert.equal(head.body.length, 0);
  const html = (await server.dispatch('/widget.html')).body.toString();
  assert.ok(html.indexOf('src="/media-guard.js"') >= 0 && html.indexOf('src="/media-guard.js"') < html.indexOf('src="/dsh-whale/widget.js"'));
  assert.ok(html.indexOf('src="/turn-notice.js"') >= 0 && html.indexOf('src="/turn-notice.js"') < html.indexOf('src="/dsh-whale/widget.js"'));
  assert.match(html, /src="\/sound-settings\.js"/);
  assert.doesNotMatch(html, /src="\/dashboard\.js"/, 'desktop menu keeps the original compact layout');
});

test('sound modules and the versioned combined settings route are explicit local resources', async t => {
  const { server, request } = await setup(t);
  for (const route of ['/services/request.js', '/services/sound-reference.js', '/features/sound-settings/controller.js', '/features/sound-settings/model.js', '/features/sound-settings/view.js']) {
    const response = await server.dispatch(route);
    assert.equal(response.status, 200, route);
    assert.match(response.headers['content-type'], /javascript/, route);
  }
  const first = await request('/api/sound-settings');
  assert.equal(first.status, 200);
  assert.equal(first.payload.schemaVersion, 1);
  assert.equal(first.payload.size.scale, 1);
  const command = {
    schemaVersion: 1,
    revision: first.payload.revision,
    size: { ...first.payload.size, vol: .2 },
    usage: { ...first.payload.usage, taskEnd: { ...first.payload.usage.taskEnd, on: true, sel: 'preset:duck:press' } },
  };
  const saved = await request('/api/sound-settings', 'PUT', command);
  assert.equal(saved.status, 200);
  assert.equal(saved.payload.size.vol, .2);
  assert.equal(saved.payload.usage.taskEnd.on, true);
  const stale = await request('/api/sound-settings', 'PUT', command);
  assert.equal(stale.status, 409);
  assert.equal(stale.payload.code, 'SETTINGS_CONFLICT');
  assert.equal((await request('/api/sound-settings', 'POST', command)).status, 405);
});

test('widget stylesheet is served as its own file, not inlined in the bundle', async t => {
  const { server } = await setup(t);
  const css = await server.dispatch('/whale-widget.css');
  assert.equal(css.status, 200);
  assert.match(css.headers['content-type'], /text\/css/);
  const cssText = css.body.toString();
  assert.match(cssText, /\.dshwv-root\{/);
  assert.match(cssText, /\.dshwv-menu\{max-height:calc\(100vh - 16px\)/, 'the rule appended after the main block must survive the move');
  const html = (await server.dispatch('/widget.html')).body.toString();
  assert.match(html, /href="\/whale-widget\.css"/);
  const js = (await server.dispatch('/dsh-whale/widget.js')).body.toString();
  assert.doesNotMatch(js, /\.dshwv-root\{position:fixed/, 'widget CSS must not be inlined back into the bundle');
  assert.doesNotMatch(js, /styleEl/, 'the inline <style> injection is gone; the stylesheet loads via <link>');
});

test('FX refresh=1 performs one deliberate fetch beyond a valid cache and preserves cooldown', async t => {
  let calls = 0;
  const { request } = await setup(t, { fxFetchImpl: async () => fxResponse(6 + ++calls / 10) });
  assert.equal((await request('/api/fx/usd-cny')).payload.usdCny, 6.1);
  assert.equal((await request('/api/fx/usd-cny')).payload.usdCny, 6.1); assert.equal(calls, 1);
  const manual = await request('/api/fx/usd-cny?refresh=1'); assert.equal(manual.payload.usdCny, 6.2); assert.equal(calls, 2);
  assert.ok(manual.payload.cooldownRemainingMs > 0 && manual.payload.cooldownRemainingMs <= FX_POLICY.manualCooldownMs);
  const repeated = await request('/api/fx/usd-cny?refresh=1'); assert.equal(repeated.payload.usdCny, 6.2); assert.equal(calls, 2);
  assert.equal((await request('/api/fx/usd-cny?refresh=1', 'POST')).status, 405);
});

test('FX failures retain checked time, manual cooldown and automatic retry metadata without raw errors', async t => {
  let calls = 0;
  const { request } = await setup(t, { fxFetchImpl: async () => { calls++; throw new Error('private server failure text'); } });
  const result = await request('/api/fx/usd-cny?refresh=1'); assert.equal(result.status, 503); assert.equal(result.payload.ok, false);
  assert.ok(Number.isFinite(Date.parse(result.payload.checkedAt)));
  assert.ok(result.payload.cooldownRemainingMs > 0 && result.payload.retryAfterMs > 0);
  assert.equal(JSON.stringify(result.payload).includes('private server failure text'), false);
  const again = await request('/api/fx/usd-cny'); assert.equal(again.status, 503); assert.equal(calls, 1);
});

test('automatic FX starts in the background and close aborts it before stopping the monitor and service', async t => {
  const calls = []; let began;
  const started = new Promise(resolve => { began = resolve; });
  const { server, state } = await setup(t, {
    initialMode: 'api',
    monitor: true, autoRefresh: true,
    fxFetchImpl: async (_url, { signal }) => { signal.addEventListener('abort', () => calls.push('fx-abort'), { once: true }); began(); return new Promise(() => {}); },
    service: { close: async options => { assert.equal(options.timeoutMs, 3000); calls.push('service'); } },
  });
  await started; assert.equal(state.balances, 1);
  const stop = server.watcher.stop.bind(server.watcher);
  server.watcher.stop = async options => { assert.equal(options.timeoutMs, 1200); calls.push('monitor'); return stop(options); };
  const first = server.close(), second = server.close(); assert.equal(first, second);
  await first; assert.deepEqual(calls, ['fx-abort', 'monitor', 'service']);
  const rejected = await server.dispatch('/api/media-policy'); assert.equal(rejected.status, 503);
});

test('close continues to settle the service after a monitor cleanup error', async t => {
  let closed = false;
  const { server } = await setup(t, { monitor: true, service: { close: async () => { closed = true; } } });
  const stop = server.watcher.stop.bind(server.watcher);
  server.watcher.stop = async options => { await stop(options); throw new Error('synthetic cleanup failure'); };
  await assert.rejects(server.close(), /部分挂件组件/); assert.equal(closed, true);
});

test('close removes the periodic balance refresh instead of starting more jobs after shutdown', async t => {
  t.mock.timers.enable({ apis: ['setInterval'] });
  const { server, state } = await setup(t, { autoRefresh: true, initialMode: 'api' });
  assert.equal(state.balances, 1); t.mock.timers.tick(60000); assert.equal(state.balances, 2);
  await server.close(); t.mock.timers.tick(60000); assert.equal(state.balances, 2);
  t.mock.timers.reset();
});

// ui-state.json has one writer: the desktop host, through UiStateStore over the
// preload IPC. A whale:// route to the same file was the documented second
// writer — it had no callers and is gone, so this pins the single-writer rule
// rather than leaving it to a later reader to re-derive.
test('ui-state is written only by the desktop host, not through a whale:// route', async t => {
  const { request } = await setup(t);
  assert.equal((await request('/api/ui-state')).status, 404);
  assert.equal((await request('/api/ui-state', 'PUT', { 'dshw-test': 'value' })).status, 404);
});
