import test from 'node:test';
import assert from 'node:assert/strict';
import { createBubbleContent } from '../desktop/ui/features/widget/bubble-content.js';

function content(random = () => .5) {
  return createBubbleContent({
    window: {}, getState: () => ({ balance: null, todayUsage: null, currency: 'USD' }),
    getLastTurnNotice: () => null, fmt: amount => `$${Number(amount).toFixed(2)}`,
    whaleMoneyTemplates: new WeakMap(), usageFillText: text => text,
    bubbleCloneModule: value => structuredClone(value), random,
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
