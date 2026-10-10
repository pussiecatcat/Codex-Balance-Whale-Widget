import test from 'node:test';
import assert from 'node:assert/strict';
import { createUsageModelsView } from '../desktop/ui/features/widget/usage-models-view.js';

const view = createUsageModelsView({
  document: {}, window: {}, WhaleMoney: { formatMoney: (amount, currency) => `${currency} ${amount}` },
  getPanel: () => null, now: () => 1000,
});

test('usage model summary keeps missing and expired quotas distinct from live balance', () => {
  const model = { kind: 'quota', currency: 'USD' };
  assert.equal(view.summary(model, null), '加载中…');
  assert.equal(view.summary(model, { windows: [{ usedPercent: 75, resetsAt: 2000 }] }), '剩余 25.0%');
  assert.equal(view.summary(model, { windows: [{ usedPercent: 75, resetsAt: 500 }] }), '额度（未观测）');
  assert.equal(view.summary({ kind: 'balance', currency: 'CNY' }, { balance: 0 }), '余额 CNY 0');
  assert.equal(view.summary({ kind: 'balance' }, { noBalanceApi: true }), '余额（无接口）');
});
