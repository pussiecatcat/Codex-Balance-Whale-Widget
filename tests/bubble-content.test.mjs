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

// A window's label, value and countdown used to each carry the same stale suffix,
// so a two-window bubble said "（上次数据，待同步）" six times. The bubble now names
// one line as the carrier; tests/quota-diy.test.mjs pins what the carrier and the
// quiet lines do with it.
test('a bubble names exactly one quota line to carry its staleness marker', () => {
  const builder = content();
  const snapshot = builder.snapshot([
    { type: 'plan', tpl: '{plan_name}' },
    { type: 'quota', windowDurationMins: 300, tpl: '5 小时' },
    { type: 'quota', windowDurationMins: 300, tpl: '{quota_left_round}' },
    { type: 'quota', windowDurationMins: 300, tpl: '距离重置 {quota_reset_short}' },
    { type: 'quota', windowDurationMins: 10080, tpl: '每周' },
  ], false);
  assert.deepEqual(snapshot.modules.map(mod => mod._staleOwner), [undefined, true, false, false, false]);
  assert.equal(snapshot.modules[0]._staleOwner, undefined, 'a line that reports no quota is left alone');
});

test('a bubble with no quota line stamps nothing, leaving every caller as it was', () => {
  const builder = content();
  const snapshot = builder.snapshot([{ type: 'balance', tpl: '{balance_api}' }], false);
  assert.equal(snapshot.modules[0]._staleOwner, undefined);
});
