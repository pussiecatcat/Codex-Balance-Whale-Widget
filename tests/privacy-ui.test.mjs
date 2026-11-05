import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import { ConfigStore, PRIVATE_SETTING_FIELDS } from '../runtime/config.mjs';
import { WhaleService } from '../runtime/service.mjs';
import { statusForError, statusView } from '../desktop/ui/features/widget/status-tones.js';
import { createDispatcher } from '../runtime/dispatcher.mjs';

const marker = 'PRIVACY_FIXTURE_ONLY';
function fixture(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'whale-privacy-test-'));
  t.after(() => {
    const target = path.resolve(dir);
    assert.ok(target.startsWith(path.resolve(os.tmpdir()) + path.sep) && path.basename(target).startsWith('whale-privacy-test-'));
    fs.rmSync(target, { recursive: true, force: true });
  });
  const codex = path.join(dir, 'fixture-codex'); fs.mkdirSync(codex);
  fs.writeFileSync(path.join(codex, 'config.toml'), 'model_provider="fixture"\n[model_providers.fixture]\nbase_url="https://example.invalid/v1"\n[profiles.PRIVACY_FIXTURE_ONLY]\nmodel="PRIVACY_FIXTURE_ONLY"\n');
  const config = new ConfigStore({ dataDir: path.join(dir, 'data'), codexHome: codex, env: { [marker]: 'FAKE_FIXTURE_VALUE' } });
  config.save({ baseUrl: 'https://privacy-fixture-only.invalid/v1', keyEnv: marker, profile: marker,
    projectDir: path.join(dir, marker), dashboardUrl: 'https://privacy-fixture-only.invalid/billing',
    balancePath: '/' + marker, balanceField: 'data.' + marker, usedField: 'data.' + marker,
    models: { [marker]: { input: 1, cachedInput: 0.1, output: 3 }, 'other-fixture-model': { input: 2, cachedInput: 0.2, output: 4 } } });
  return config;
}

function assertSafe(info) {
  const json = JSON.stringify(info);
  assert.doesNotMatch(json, /PRIVACY_FIXTURE_ONLY|privacy-fixture-only|FAKE_FIXTURE_VALUE|other-fixture-model/i);
  for (const key of PRIVATE_SETTING_FIELDS) assert.equal(Object.hasOwn(info.settings, key), false, key);
  for (const key of PRIVATE_SETTING_FIELDS) assert.equal(typeof info.configured[key], 'boolean', key);
}

test('settings and status DTOs omit private values and resolving preserves internal account identity', t => {
  const config = fixture(t), before = config.resolve();
  assertSafe(config.settingsInfo()); assertSafe(config.publicInfo());
  assert.equal(config.publicInfo().hasKey, true);
  config.save({ currency: 'CNY', monitorSessions: false });
  const after = config.resolve();
  assert.equal(after.accountId, before.accountId); assert.equal(after.baseUrl, before.baseUrl);
  for (const key of PRIVATE_SETTING_FIELDS) assert.deepEqual(after.setting[key], before.setting[key], key);
});

test('explicit resets and per-model price edits preserve unrelated private settings', t => {
  const config = fixture(t), before = config.load();
  config.save({ baseUrl: '', pricingUpdate: { model: marker, prices: { input: 7, cachedInput: 1, output: 8 } } });
  assert.equal(config.load().baseUrl, '');
  assert.deepEqual(config.load().models['other-fixture-model'], before.models['other-fixture-model']);
  assert.equal(config.load().models[marker].input, 7);
  config.save({ pricingUpdate: { model: marker, prices: null } });
  assert.equal(Object.hasOwn(config.load().models, marker), false);
  assert.deepEqual(config.load().models['other-fixture-model'], before.models['other-fixture-model']);
  assert.throws(() => config.save({ pricingUpdate: { model: '__proto__', prices: null } }), /模型名称/);
  assert.equal(config.load().keyEnv, before.keyEnv);
});

test('configuration GET and PUT return only the privacy DTO', async t => {
  const config = fixture(t), service = new WhaleService({ config }), dispatcher = createDispatcher({ dataDir: config.dataDir, service, monitor: false, autoRefresh: false });
  try {
    for (const options of [{}, { method: 'PUT', body: { currency: 'CNY' } }]) {
      const response = await dispatcher.dispatch('/api/config', options);
      assert.equal(response.status, 200); assertSafe(JSON.parse(response.body));
    }
    assert.equal(config.load().keyEnv, marker);
  } finally { await dispatcher.close(); }
});

class Element {
  constructor(name) { this.name = name; this.value = ''; this.placeholder = ''; this.checked = false; this.hidden = false; this.dataset = {}; this.listeners = new Map(); }
  addEventListener(name, fn) { this.listeners.set(name, fn); }
  setAttribute(name, value) { this[name] = value; }
  closest() { return { firstChild: { textContent: this.name } }; }
  insertAdjacentElement(_position, element) { this.reset = element; }
  focus() {}
  showModal() { this.open = true; }
  close() { this.open = false; }
  async fire(name) { return this.listeners.get(name)?.({ preventDefault() {} }); }
}

test('settings UI never echoes private values and blank saves never erase them', async t => {
  const config = fixture(t), before = config.load(), controls = new Map(), ids = new Map(), window = new Element('window'), puts = [];
  const names = [...PRIVATE_SETTING_FIELDS.filter(k => k !== 'models'), 'provider', 'currency', 'balanceScale', 'billingUsageDivisor', 'quotaPerUnit', 'monitorSessions', 'priceModel', 'priceInput', 'priceCached', 'priceOutput', 'priceWrite', 'removePrice'];
  for (const name of names) controls.set(name, new Element(name));
  for (const id of ['settings-form', 'settings-dialog', 'settings-error', 'settings-discard', 'discard-settings', 'keep-editing', 'close-settings', 'cancel-settings', 'toast', 'test-api-connection', 'api-connection-result', 'restart-whale', 'provider-auto-status', 'auto-api-test', 'auto-api-edit', 'current-api-settings']) ids.set(id, new Element(id));
  ids.get('settings-form').elements = { namedItem: name => controls.get(name) };
  const document = { getElementById: id => ids.get(id), createElement: name => new Element(name) };
  const requestJson = async (_url, options = {}) => {
    if (options.method === 'PUT') { puts.push(options.body); config.save(options.body); }
    return { ok: true, ...config.settingsInfo() };
  };
  const source = fs.readFileSync(new URL('../desktop/ui/client.js', import.meta.url), 'utf8').replace(/^import .*$/mg, '');
  vm.runInNewContext(source, { document, window, requestJson, statusForError, statusView, location: { reload() {} }, Set, Number, JSON, setTimeout: () => 0, clearTimeout() {} });
  await window.fire('whale-open-settings');
  for (const key of PRIVATE_SETTING_FIELDS.filter(k => k !== 'models')) {
    assert.equal(controls.get(key).value, ''); assert.match(controls.get(key).placeholder, /已配置/);
  }
  assert.equal(controls.get('priceModel').value, '');
  await ids.get('settings-form').fire('submit');
  for (const key of PRIVATE_SETTING_FIELDS) { assert.equal(Object.hasOwn(puts[0], key), false); assert.deepEqual(config.load()[key], before[key]); }
  controls.get('baseUrl').value = 'https://replacement-fixture.invalid/v1';
  await ids.get('settings-form').fire('submit');
  assert.equal(config.load().baseUrl, 'https://replacement-fixture.invalid/v1');
  await window.fire('whale-open-settings');
  await controls.get('baseUrl').reset.fire('click');
  await ids.get('settings-form').fire('submit');
  assert.equal(config.load().baseUrl, '');
  assert.equal(config.load().keyEnv, marker);
  assert.equal(puts.some(patch => JSON.stringify(patch).includes('内容隐藏')), false);
});

test('guided API setup probes the draft without saving and names a failure', async t => {
  const controls = new Map(), ids = new Map(), window = new Element('window'), puts = [], probes = [], commands = [];
  window.whaleDesktop = { command: async command => { commands.push(command); return true; } };
  let probeResponse = { ok: true, totalBalance: 12.5, currency: 'CNY', balanceLabel: 'API 账户余额' };
  const names = [...PRIVATE_SETTING_FIELDS.filter(k => k !== 'models'), 'provider', 'currency', 'balanceScale', 'billingUsageDivisor', 'quotaPerUnit', 'monitorSessions', 'priceModel', 'priceInput', 'priceCached', 'priceOutput', 'priceWrite', 'removePrice'];
  for (const name of names) controls.set(name, new Element(name));
  for (const id of ['settings-form', 'settings-dialog', 'settings-error', 'settings-discard', 'discard-settings', 'keep-editing', 'close-settings', 'cancel-settings', 'toast', 'test-api-connection', 'api-connection-result', 'restart-whale', 'provider-auto-status', 'auto-api-test', 'auto-api-edit', 'current-api-settings']) ids.set(id, new Element(id));
  ids.get('settings-form').elements = { namedItem: name => controls.get(name) };
  const document = { getElementById: id => ids.get(id), createElement: name => new Element(name) };
  const requestJson = async (url, options = {}) => {
    if (url === '/api/config/probe' && options.method === 'POST') { probes.push(options.body); return probeResponse; }
    if (url.startsWith('/api/config') && options.method === 'PUT') { puts.push(options.body); return { ok: true }; }
    return { ok: true, settings: {}, configured: {} };
  };
  const source = fs.readFileSync(new URL('../desktop/ui/client.js', import.meta.url), 'utf8').replace(/^import .*$/mg, '');
  vm.runInNewContext(source, { document, window, requestJson, statusForError, statusView, location: { reload() {} }, Set, Number, JSON, setTimeout: () => 0, clearTimeout() {} });
  const result = ids.get('api-connection-result'), button = ids.get('test-api-connection');
  await button.fire('click');
  assert.equal(probes.length, 1);
  assert.equal(puts.length, 0, 'testing a draft must not save it');
  assert.match(result.textContent, /连接成功：API 账户余额 · 12.5 CNY（尚未保存）/);
  assert.equal(result.className, 'is-ok');
  probeResponse = { ok: false, error: '未设置密钥环境变量 CUSTOM_API_KEY' };
  await button.fire('click');
  assert.match(result.textContent, /连接失败：未设置密钥环境变量 CUSTOM_API_KEY/);
  assert.equal(result.className, 'is-error');
  assert.equal(button.disabled, false);
  // A cached payload still has ok:true. It must not be presented as a fresh
  // connection just because the network request failed.
  probeResponse = { ok: true, stale: true, error: '服务商请求超时', updatedAt: '2026-11-04T06:02:00.000Z', totalBalance: 12.5, currency: 'CNY' };
  await button.fire('click');
  assert.match(result.textContent, /连接失败：服务商请求超时/);
  assert.match(result.textContent, /上次数据/);
  assert.equal(result.className, 'is-error');
  assert.equal(puts.length, 0, 'a failed test still must not save');
  await window.fire('whale-open-settings');
  assert.equal(result.textContent, '');
  assert.equal(result.className, '');
  assert.equal(ids.get('provider-auto-status').textContent, '未配置');
  probeResponse = { ok: true, totalBalance: 12.5, currency: 'CNY', balanceLabel: 'API 账户余额' };
  const probesBeforeAuto = probes.length;
  await ids.get('auto-api-test').fire('click');
  assert.equal(probes.length, probesBeforeAuto + 1);
  assert.match(ids.get('provider-auto-status').textContent, /已连接 · API 账户余额/);
  await ids.get('auto-api-edit').fire('click');
  assert.equal(ids.get('current-api-settings').open, true);
  await button.fire('click');
  await ids.get('restart-whale').fire('click');
  assert.deepEqual(commands, ['restart']);
});
