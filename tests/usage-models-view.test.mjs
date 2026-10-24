import test from 'node:test';
import assert from 'node:assert/strict';
import { createUsageModelsView } from '../desktop/ui/features/usage/usage-models-view.js';

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

test('model list loads and edits through supplied operations without a browser global', async () => {
  const created = [], requests = [], edited = [];
  function element() {
    const node = { children: [], handlers: {}, dataset: {}, appendChild(child) { this.children.push(child); },
      set innerHTML(_value) { this.children = []; }, addEventListener(type, fn) { this.handlers[type] = fn; } };
    created.push(node); return node;
  }
  const panel = element();
  const models = createUsageModelsView({
    document: { createElement: element }, getPanel: () => panel,
    WhaleMoney: { formatMoney: value => '$' + value },
    loadModels: async force => { requests.push(['list', force]); return { models: [{ id: 'a', name: 'A', kind: 'balance' }] }; },
    refreshModel: async (id, force) => { requests.push([id, force]); return { balance: 3 }; },
    editModel: id => edited.push(id),
  });
  models.build();
  await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(requests, [['list', false], ['a', false]]);
  assert.equal(created.find(node => node.className === 'dshwv-book-model-value').textContent, '余额 $3');
  created.find(node => node.className === 'dshwv-roleimport dshwv-book-model-setting').handlers.click({ stopPropagation() {} });
  created.find(node => node.className === 'dshwv-usage-more dshwv-book-add').handlers.click({ stopPropagation() {} });
  assert.deepEqual(edited, ['a', null]);
});
