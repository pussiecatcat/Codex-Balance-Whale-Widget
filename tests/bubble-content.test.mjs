import test from 'node:test';
import assert from 'node:assert/strict';
import { createBubbleContent } from '../desktop/ui/features/bubble/bubble-content.js';

function content(random = () => .5, ports = {}) {
  return createBubbleContent({
    window: {}, getState: () => ({ balance: null, todayUsage: null, currency: 'USD' }),
    getLastTurnNotice: () => null, fmt: amount => `$${Number(amount).toFixed(2)}`,
    whaleMoneyTemplates: new WeakMap(), usageFillText: text => text,
    bubbleCloneModule: value => structuredClone(value), random, ...ports,
  });
}

test('bubble content keeps missing money unknown and formats token placeholders', () => {
  const builder = content();
  assert.equal(builder.tokenValue(1234.8), '1,234');
  assert.equal(builder.tokenValue(null), '暂无');
  assert.equal(builder.text({ type: 'turn', tpl: '{turn_tokens} tokens' }, '', { tokens: 1234 }), '1,234 tokens');
  const balance = builder.snapshot([{ type: 'balance', tpl: '{balance_api}' }], true);
  assert.equal(balance.rows.get(balance.modules[0]).txt, '…');
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

test('bubble content obtains model and quota text from injected live readers', () => {
  let quota = '剩余 75%', model = 'USD 5.00';
  const builder = content(() => .5, { modelText: () => model, quotaText: () => quota });
  const result = builder.snapshot([{ type: 'balance', apiModelId: 'a' }, { type: 'quota' }], true);
  const [modelRow, quotaRow] = result.modules.map(mod => result.rows.get(mod));
  assert.equal(modelRow.txt, model); assert.equal(quotaRow.txt, quota);
  quota = '剩余 50%'; model = 'USD 4.00';
  assert.equal(modelRow.apiModelText(), model); assert.equal(quotaRow.quotaText(), quota);
});
