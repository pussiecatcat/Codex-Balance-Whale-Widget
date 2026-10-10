import test from 'node:test';
import assert from 'node:assert/strict';
import { createUsageOverviewView } from '../desktop/ui/features/widget/usage-overview-view.js';

test('usage overview preserves unknown money and two decimal display precision', () => {
  const view = createUsageOverviewView({
    document: {}, WhaleMoney: {
      symbol: () => '$', formatMoney: amount => `$ ${Number(amount).toFixed(2)}`,
    },
    getCurrency: () => 'USD', getMain: () => null, getPanel: () => null,
    openRecords: () => {},
  });
  assert.equal(view.money(null), '—');
  assert.equal(view.money(0), '$\u00a00.00');
  assert.equal(view.money(1.234), '$\u00a01.23');
  assert.equal(view.moneyText(2)(), '$\u00a02.00');
});
