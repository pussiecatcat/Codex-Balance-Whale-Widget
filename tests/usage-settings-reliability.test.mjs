import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { ConfigStore } from '../runtime/config.mjs';
import { WhaleService } from '../runtime/service.mjs';

function serviceFixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'whale-usage-reliable-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const config = new ConfigStore({ dataDir: path.join(root, 'data'), codexHome: root, env: {} });
  return { root, service: new WhaleService({ config }) };
}

test('usage settings read keeps a saved custom alert link and survives an unresolvable config', t => {
  const { root, service } = serviceFixture(t);
  const saved = service.readUsageSettings();
  saved.alert.lines[0].text = '自定义余额提醒';
  saved.alert.lines.push({ type: 'link', url: 'https://my-own-dashboard.example/balance', text: '我的面板' });
  service.writeUsageSettings(saved);
  const reread = service.readUsageSettings();
  const custom = reread.alert.lines.find(line => line.url === 'https://my-own-dashboard.example/balance');
  assert.ok(custom, '用户自定义提醒链接不能被默认面板地址覆盖');
  assert.equal(custom.text, '我的面板');
  assert.equal(reread.alert.lines[0].text, '自定义余额提醒');
  // 配置无法解析（例如域名切换校验失败）时读取仍然返回默认占位链接，不整体报错。
  const broken = new WhaleService({ config: { dataDir: path.join(root, 'data'),
    resolve: () => { throw new Error('更换 API 域名时必须使用对应服务专用的密钥环境变量'); } } });
  const fallback = broken.readUsageSettings();
  const link = fallback.alert.lines.find(line => line && line.type === 'link');
  assert.ok(link && typeof link.url === 'string' && link.url.length > 0, '配置未就绪时保留默认占位链接');
  fs.rmSync(path.join(root, 'data'), { recursive: true, force: true });
});

test('null restores exactly one usage settings domain; invalid input is rejected', t => {
  const { service } = serviceFixture(t);
  service.writeUsageSettings({ alert: { below: 12 }, budget: { amount: 30 } });
  const prepared = service.prepareUsageSettings({ alert: null, budget: { amount: 44 } });
  assert.equal(prepared.alert.below, service.resolveUsageSettings({}).alert.below, 'null 只重置目标域');
  assert.equal(prepared.budget.amount, 44, '其它域保持本次提交的值');
  assert.equal(prepared.below, undefined, '顶层字段不属于提醒域');
  assert.throws(() => service.prepareUsageSettings({ alert: 'bad' }), /提醒设置「alert」格式无效/);
  assert.throws(() => service.prepareUsageSettings({ events: 'bad' }), /提醒设置「events」格式无效/);
  // events 域同样支持 null 显式恢复默认，且不影响其它域。
  service.writeUsageSettings({ events: { press: { vol: 0.75 } } });
  const eventsReset = service.prepareUsageSettings({ events: null, alert: { below: 9 } });
  assert.equal(eventsReset.events.press.vol, service.resolveUsageSettings({}).events.press.vol);
  assert.equal(eventsReset.alert.below, 9);
  // writeUsageSettings 走同一 prepare/commit 链路，落盘回读一致。
  service.writeUsageSettings({ alert: null });
  const reread = service.readUsageSettings();
  assert.equal(reread.alert.below, service.resolveUsageSettings({}).alert.below);
});
