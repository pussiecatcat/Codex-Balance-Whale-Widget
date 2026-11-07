import test from 'node:test';
import assert from 'node:assert/strict';
import { createBubbleContent } from '../desktop/ui/features/widget/bubble-content.js';

function content(random = () => .5, state = { balance: null, todayUsage: null, currency: 'USD', status: 'loading' }, win = {}) {
  return createBubbleContent({
    window: win, getState: () => state,
    getLastTurnNotice: () => null, fmt: amount => `$${Number(amount).toFixed(2)}`,
    whaleMoneyTemplates: new WeakMap(), usageFillText: text => text,
    bubbleCloneModule: value => structuredClone(value), random,
    getMode: () => win.accountMode,
    getQuotaSource: () => win.WhaleQuota && win.WhaleQuota.sourceLine ? win.WhaleQuota.sourceLine() : '',
  });
}

test('bubble content keeps missing money unknown and formats token placeholders', () => {
  const builder = content();
  assert.equal(builder.tokenValue(1234.8), '1,234');
  assert.equal(builder.tokenValue(null), '暂无');
  assert.equal(builder.text({ type: 'turn', tpl: '{turn_tokens} tokens' }, '', { tokens: 1234 }), '1,234 tokens');
  const balance = builder.snapshot([{ type: 'balance', tpl: '{balance_api}' }], true);
  assert.equal(balance.rows.get(balance.modules[0]).txt, '加载中…');
});

test('bubble content remembers the previous random line across openings', () => {
  const choices = [.1, .9];
  const builder = content(() => choices.shift() ?? .9);
  const original = [{ type: 'random', lines: [{ t: 'A', w: 1 }, { t: 'B', w: 1 }] }];
  const first = builder.snapshot(original, true);
  const second = builder.snapshot(original, true);
  assert.equal(first.rows.get(first.modules[0]).txt, 'A');
  assert.equal(second.rows.get(second.modules[0]).txt, 'B');
  assert.equal(original[0]._lastPick, undefined);
});

test('API bubbles distinguish loading, missing data and a failed read from a cached value', () => {
  const unknown = content(undefined, { balance: null, todayUsage: null, currency: 'USD', status: 'error', code: 'AUTH' });
  const view = unknown.snapshot([{ type: 'balance', tpl: '{balance_api}' }], true);
  assert.equal(view.rows.get(view.modules[0]).txt, '密钥无权限');

  const cached = content(undefined, { balance: 12.5, todayUsage: 1.2, currency: 'USD', status: 'error', code: 'NETWORK' });
  const cachedView = cached.snapshot([{ type: 'balance', tpl: '{balance_api}' }, { type: 'today' }], true);
  assert.equal(cachedView.rows.get(cachedView.modules[0]).txt, '$12.50（上次数据）');
  assert.equal(cachedView.rows.get(cachedView.modules[1]).txt, '今日已观测 $1.20（上次数据）');

  const empty = content(undefined, { balance: null, todayUsage: null, currency: 'USD', status: 'ok' });
  const emptyView = empty.snapshot([{ type: 'today' }], true);
  assert.equal(emptyView.rows.get(emptyView.modules[0]).txt, '今日未观测');
});

test('the source module names the provider, the update time and stale data', () => {
  const at = Date.parse('2026-11-04T06:32:00Z');
  const api = content(undefined, { balance: 1, todayUsage: 0, currency: 'USD', status: 'ok', updatedAt: at });
  const view = api.snapshot([{ type: 'source', tpl: '{source_line}' }], true);
  assert.match(view.rows.get(view.modules[0]).txt, /服务商返回 · .*更新/);

  const stale = content(undefined, { balance: 1, currency: 'USD', status: 'ok', stale: true, updatedAt: at });
  const staleView = stale.snapshot([{ type: 'source', tpl: '{source_line}' }], true);
  assert.match(staleView.rows.get(staleView.modules[0]).txt, /上次数据/);

  const subscription = content(undefined, { balance: null, currency: 'USD' }, {
    accountMode: 'subscription',
    WhaleQuota: { sourceLine: () => 'Codex 官方 · 14:32 更新' },
  });
  const subView = subscription.snapshot([{ type: 'source', tpl: '{source_line}' }], true);
  assert.equal(subView.rows.get(subView.modules[0]).txt, 'Codex 官方 · 14:32 更新');
});

test('modules from the other mode are hidden instead of shown as zero', () => {
  const state = { balance: 1, todayUsage: 0, currency: 'USD', status: 'ok' };
  const subscription = content(undefined, state, { accountMode: 'subscription' });
  const sub = subscription.snapshot([{ type: 'balance' }, { type: 'quota' }, { type: 'source', tpl: '{source_line}' }], true);
  assert.deepEqual(sub.modules.map(module => module.type), ['quota', 'source']);

  const api = content(undefined, state, { accountMode: 'api' });
  const apiView = api.snapshot([{ type: 'quota' }, { type: 'balance' }], true);
  assert.deepEqual(apiView.modules.map(module => module.type), ['balance']);
});
