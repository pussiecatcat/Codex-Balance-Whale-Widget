import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';

const require = createRequire(import.meta.url);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { SettingsStore, sameValue } = require(path.join(root, 'desktop/settings-store.cjs'));

// A memory-backed domain that behaves like .dshw-size.json: the whole structure
// is written every time, so a partial write that dropped the untouched fields
// would lose them.
function memoryDomain(initial) {
  let state = { ...initial };
  return {
    read: () => JSON.parse(JSON.stringify(state)),
    write: values => { state = JSON.parse(JSON.stringify(values)); },
    raw: () => state,
  };
}

test('a keyed write leaves the other fields of the same domain untouched', async () => {
  const domain = memoryDomain({ scale: 1, sound: true, vol: 0.9, bubbleOn: true, scrollGapPx: 17 });
  const store = new SettingsStore({ domains: { size: domain } });
  const result = await store.save({ domain: 'size', changes: { scale: 1.4 }, base: domain.read() });
  assert.equal(result.ok, true);
  const after = domain.raw();
  assert.equal(after.scale, 1.4);
  assert.equal(after.vol, 0.9, '未改动的字段不能被重置');
  assert.equal(after.sound, true);
  assert.equal(after.scrollGapPx, 17, '未改动的字段不能回到默认值');
});

test('a write with nothing changed is refused instead of writing a snapshot', async () => {
  let writes = 0;
  const domain = {
    read: () => ({ scale: 1 }),
    write: () => { writes += 1; },
  };
  const store = new SettingsStore({ domains: { size: domain } });
  const result = await store.save({ domain: 'size', changes: {} });
  assert.equal(result.ok, false);
  assert.equal(writes, 0, '没有真实修改时不应落盘');
});

test('falsy values are real changes, not "unchanged"', async () => {
  const domain = memoryDomain({ sound: true, vol: 0.9, turnCostOn: true });
  const store = new SettingsStore({ domains: { size: domain } });
  const base = domain.read();
  assert.equal((await store.save({ domain: 'size', changes: { sound: false }, base })).ok, true);
  assert.equal(domain.raw().sound, false, 'false 必须被真正写入');
  assert.equal((await store.save({ domain: 'size', changes: { vol: 0 }, base })).ok, true);
  assert.equal(domain.raw().vol, 0, '0 必须被真正写入');
  assert.equal((await store.save({ domain: 'size', changes: { turnCostOn: false }, base })).ok, true);
  assert.equal(domain.raw().turnCostOn, false);
});

test('an unknown domain is refused', async () => {
  const store = new SettingsStore({ domains: {} });
  assert.equal((await store.save({ domain: 'nope', changes: { a: 1 } })).ok, false);
  await assert.rejects(store.read('nope'), /未知的设置域/);
});

test('a key changed elsewhere while the page was open is reported as a conflict', async () => {
  const domain = memoryDomain({ scale: 1, vol: 0.9 });
  const store = new SettingsStore({ domains: { size: domain } });
  const openedAs = domain.read();            // the settings window opens here
  domain.write({ ...domain.raw(), vol: 0.5 }); // the quick menu changes volume
  const result = await store.save({ domain: 'size', changes: { scale: 1.2, vol: 0.7 }, base: openedAs });
  assert.equal(result.ok, false);
  assert.equal(result.conflicts.length, 1, '只应报告 vol 冲突');
  assert.equal(result.conflicts[0].key, 'vol');
  assert.equal(result.conflicts[0].theirs, 0.5);
  assert.equal(result.conflicts[0].yours, 0.7);
  assert.equal(result.conflicts[0].openedAs, 0.9);
  assert.equal(domain.raw().scale, 1, '冲突时整次保存都不应落盘');
});

test('a change to a field the page never touched is not a conflict', async () => {
  const domain = memoryDomain({ scale: 1, vol: 0.9 });
  const store = new SettingsStore({ domains: { size: domain } });
  const openedAs = domain.read();
  domain.write({ ...domain.raw(), vol: 0.5 });
  const result = await store.save({ domain: 'size', changes: { scale: 1.2 }, base: openedAs });
  assert.equal(result.ok, true);
  assert.equal(domain.raw().scale, 1.2);
  assert.equal(domain.raw().vol, 0.5, '别人改的其它字段不能被这次保存覆盖');
});

test('force keeps the user edit and drops the other side', async () => {
  const domain = memoryDomain({ scale: 1, vol: 0.9 });
  const store = new SettingsStore({ domains: { size: domain } });
  const openedAs = domain.read();
  domain.write({ ...domain.raw(), vol: 0.5 });
  const result = await store.save({ domain: 'size', changes: { vol: 0.7 }, base: openedAs, force: true });
  assert.equal(result.ok, true);
  assert.equal(domain.raw().vol, 0.7, '选择「保留我的」后应写入用户改的值');
});

test('keep resolves a conflict in favour of the other side for that key only', async () => {
  const domain = memoryDomain({ scale: 1, vol: 0.9 });
  const store = new SettingsStore({ domains: { size: domain } });
  const openedAs = domain.read();
  domain.write({ ...domain.raw(), vol: 0.5 });
  const result = await store.save({ domain: 'size', changes: { scale: 1.2, vol: 0.7 }, base: openedAs, keep: ['vol'] });
  assert.equal(result.ok, true);
  assert.equal(domain.raw().vol, 0.5, '被保留的键应维持对方的值');
  assert.equal(domain.raw().scale, 1.2, '其余键仍应写入');
});

test('onChange reports which keys were written so other windows can refresh', async () => {
  const domain = memoryDomain({ scale: 1, vol: 0.9 });
  const seen = [];
  const store = new SettingsStore({ domains: { size: domain }, onChange: change => seen.push(change) });
  await store.save({ domain: 'size', changes: { scale: 1.3 } });
  assert.equal(seen.length, 1);
  assert.equal(seen[0].domain, 'size');
  assert.deepEqual(seen[0].keys, ['scale']);
  assert.equal(seen[0].values.vol, 0.9, '广播应带上合并后的完整值');
});

test('preview matches what save would write and never touches the domain', async () => {
  const domain = memoryDomain({ scale: 1, vol: 0.9 });
  const store = new SettingsStore({ domains: { size: domain } });
  const preview = await store.preview({ domain: 'size', changes: { scale: 2 } });
  assert.equal(preview.ok, true);
  assert.equal(preview.values.scale, 2);
  assert.equal(preview.values.vol, 0.9);
  assert.deepEqual(preview.changedKeys, ['scale']);
  assert.equal(domain.raw().scale, 1, '预览不得落盘');
});

test('preview reports no change when the draft equals the stored value', async () => {
  const domain = memoryDomain({ scale: 1 });
  const store = new SettingsStore({ domains: { size: domain } });
  assert.deepEqual((await store.preview({ domain: 'size', changes: { scale: 1 } })).changedKeys, []);
});

test('sameValue compares structurally, not by identity', () => {
  assert.equal(sameValue({ a: [1, { b: 2 }] }, { a: [1, { b: 2 }] }), true);
  assert.equal(sameValue({ a: 1 }, { a: 1, b: 2 }), false);
  assert.equal(sameValue([1, 2], [2, 1]), false);
  assert.equal(sameValue(null, undefined), false);
  assert.equal(sameValue(0, false), false, '0 与 false 是不同设置值');
});

// ── 回归：三个既有缺陷 ──────────────────────────────────────────────────────

const { WhaleService } = await import(pathToFileURL(path.join(root, 'runtime/service.mjs')));
const { ApiModelRegistry } = await import(pathToFileURL(path.join(root, 'runtime/api-models.mjs')));

// WhaleService needs a config carrying dataDir; resolve() is the only method the
// usage-settings read path touches.
const serviceFor = (dataDir, resolve) => new WhaleService({ config: { dataDir, resolve } });
const registryFor = dataDir => new ApiModelRegistry({ dataDir, env: {} });

// 主线的尺寸存储是 SizeSettingsStore（runtime/size-settings.mjs）：它自带
// 多候选文件选择、prepare 合并与损坏文件报错，取代来源分支在 widget-host
// 里的三处修复。这里按主线语义回归同一组行为。
const { SizeSettingsStore } = await import(pathToFileURL(path.join(root, 'runtime/size-settings.mjs')));

test('a partial size write no longer resets the fields it did not mention', () => {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'whale-size-store-'));
  const store = new SizeSettingsStore(dataDir);
  store.commit(store.prepare({ scale: 1.5, sound: true, vol: 0.9, soundSet: 'duck',
    bubbleOn: true, turnCostOn: true, turnCostCloseMs: 5000, scrollGapOn: true, scrollGapPx: 24, menuBtnHide: false }).document);

  // 只改 scale，其余字段应保持磁盘上的值。
  const snapshot = store.snapshot();
  const prepared = store.prepare({ scale: 1.2 }, { baseDocument: snapshot.document });
  store.commit(prepared.document);
  const after = store.read();
  assert.equal(after.scale, 1.2);
  assert.equal(after.scrollGapPx, 24, 'scrollGapPx 不应因部分写入被重置');
  assert.equal(after.scrollGapOn, true);
  assert.equal(after.vol, 0.9);
  assert.equal(after.soundSet, 'duck');
  assert.equal(after.menuBtnHide, false);
  assert.equal(after.turnCostCloseMs, 5000);
});

test('size settings keep working from whichever candidate file already exists', () => {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'whale-size-legacy-'));
  fs.mkdirSync(path.join(dataDir, 'profiles/web'), { recursive: true });
  fs.writeFileSync(path.join(dataDir, 'profiles/web/.dshw-size.json'), JSON.stringify({ scale: 1.3, vol: 0.4 }));

  const store = new SizeSettingsStore(dataDir);
  assert.equal(store.read().vol, 0.4, '应能读到旧路径的配置');
  // 主线策略：写入跟随已存在的候选文件，不强行搬家，也不产生第二份配置。
  const prepared = store.prepare({ scale: 1.3 }, { baseDocument: store.snapshot().document });
  store.commit(prepared.document);
  const migrated = JSON.parse(fs.readFileSync(path.join(dataDir, 'profiles/web/.dshw-size.json'), 'utf8'));
  assert.equal(migrated.vol, 0.4, '旧配置的其它字段不能丢');
  assert.equal(migrated.scale, 1.3);
  assert.equal(store.file(), path.join(dataDir, 'profiles/web/.dshw-size.json'));
});

test('a corrupt size file is reported instead of being silently replaced', () => {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'whale-size-corrupt-'));
  const file = path.join(dataDir, '.dshw-size.json');
  const corrupt = '{"scale": "not a number"}';
  fs.writeFileSync(file, corrupt);
  const store = new SizeSettingsStore(dataDir);
  assert.throws(() => store.snapshot(), /已损坏/, '损坏的配置必须报错');
  assert.equal(fs.readFileSync(file, 'utf8'), corrupt, '原文件必须保持原样');
  // 走完整保存链路同样不能静默覆盖。
  assert.throws(() => store.commit(store.prepare({ scale: 1.2 }).document), /已损坏|不可读/);
  assert.equal(fs.readFileSync(file, 'utf8'), corrupt);
});

test('reading usage settings survives an unresolvable config', () => {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'whale-usage-read-'));
  const service = serviceFor(dataDir, () => { throw new Error('密钥环境变量不存在'); });
  const settings = service.readUsageSettings();
  assert.ok(settings.alert, '应返回默认结构而不是抛错');
  assert.equal(settings.alert.below, 5);
  assert.equal(settings.alert.lines.at(-1).url, '/provider-dashboard', '解析失败时应保留默认占位链接');
});

test('an empty dashboard URL does not blank out the default alert link', () => {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'whale-usage-dash-'));
  const service = serviceFor(dataDir, () => ({ dashboardUrl: '' }));
  assert.equal(service.readUsageSettings().alert.lines.at(-1).url, '/provider-dashboard');
});

test('a user customised alert link is not overwritten on every read', () => {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'whale-usage-link-'));
  const lines = [{ type: 'text', text: '自定义', size: 5 }, { type: 'link', text: '去充值', url: 'https://example.com/pay' }];
  fs.writeFileSync(path.join(dataDir, 'usage-settings.json'), JSON.stringify({ alert: { lines } }));
  const service = serviceFor(dataDir, () => ({ dashboardUrl: 'https://billing.example.com' }));
  assert.equal(service.readUsageSettings().alert.lines.at(-1).url, 'https://example.com/pay');
  assert.equal(service.readUsageSettings().alert.lines.at(-1).url, 'https://example.com/pay', '用户自定义的链接必须稳定');
});

test('clearing a usage domain resets it to defaults instead of silently doing nothing', () => {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'whale-usage-reset-'));
  const service = serviceFor(dataDir, () => ({ dashboardUrl: '' }));
  service.writeUsageSettings({ budget: { amount: 99 } });
  assert.equal(service.readUsageSettings().budget.amount, 99);
  service.writeUsageSettings({ budget: null });
  assert.equal(service.readUsageSettings().budget.amount, 10, '置 null 应恢复该组默认值');
});

test('a falsy field inside a usage domain is still written', () => {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'whale-usage-falsy-'));
  const service = serviceFor(dataDir, () => ({ dashboardUrl: '' }));
  service.writeUsageSettings({ alert: { on: false, ttlSec: 0 } });
  const alert = service.readUsageSettings().alert;
  assert.equal(alert.on, false, 'false 必须被写入');
  assert.equal(alert.ttlSec, 0, '0 必须被写入');
});

test('a usage domain sent with a non-object value is rejected', () => {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'whale-usage-bad-'));
  const service = serviceFor(dataDir, () => ({ dashboardUrl: '' }));
  assert.throws(() => service.writeUsageSettings({ alert: 'nope' }), /格式无效/);
});

test('clearing a manual quota actually removes it', () => {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'whale-model-quota-'));
  const registry = registryFor(dataDir);
  const tomorrow = new Date(Date.now() + 86400000).toISOString();
  registry.save({ template: 'deepseek', name: '测试', manualQuota: { remaining: 10, total: 100, resetsAt: tomorrow, mode: 'manual', period: 'daily' } });

  const listed = registry.list().models.find(model => model.manualQuota);
  assert.ok(listed, '列表中应能看到手动额度');
  registry.save({ id: listed.id, template: listed.template, name: listed.name, manualQuota: null });
  const after = registry.list().models.find(model => model.id === listed.id);
  assert.equal(after.manualQuota, undefined, '置 null 后手动额度应被清除，而不是静默保留');
});

test('keeping a manual quota untouched does not drop it on an unrelated save', () => {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'whale-model-keep-'));
  const registry = registryFor(dataDir);
  const tomorrow = new Date(Date.now() + 86400000).toISOString();
  registry.save({ template: 'deepseek', name: '测试', manualQuota: { remaining: 10, total: 100, resetsAt: tomorrow, mode: 'manual', period: 'daily' } });
  const listed = registry.list().models.find(model => model.manualQuota);
  registry.save({ id: listed.id, template: listed.template, name: '改名了' });
  const after = registry.list().models.find(model => model.id === listed.id);
  assert.equal(after.name, '改名了');
  assert.ok(after.manualQuota, '没有提交 manualQuota 时不应被清空');
});
