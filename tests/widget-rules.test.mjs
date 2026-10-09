import test from 'node:test';
import assert from 'node:assert/strict';
import { bubbleDefaultQueue, bubbleDefaultSubscriptionQueue, bubbleStepToBubble } from '../desktop/ui/features/widget/default-content.js';
import { bubbleRowsOf, bubbleRowsCanon } from '../desktop/ui/features/widget/bubble-layout.js';
import { aggregateUsageModels } from '../desktop/ui/features/widget/usage-charts.js';
import { reorderBubbleStep, splitBubbleChoiceSide, pairBubbleSteps, replaceBubbleChoiceSide, moveBubbleStepToEnd, unpairBubbleStep } from '../desktop/ui/features/widget/bubble-editor-commands.js';

test('default bubble drafts are independent and subscription quota windows remain distinct', () => {
  const first = bubbleDefaultQueue(false);
  assert.ok(first.length > 0);
  first[0].kind = 'mutated';
  assert.notEqual(bubbleDefaultQueue(false)[0].kind, 'mutated');
  const subscription = bubbleDefaultSubscriptionQueue();
  assert.deepEqual(subscription[0].modules.filter(module => module.type === 'quota').map(module => module.windowDurationMins), [300, 10080]);
  const draft = bubbleStepToBubble({ kind: 'custom', modules: [{ type: 'text', text: 'original' }] });
  draft.modules[0].text = 'changed';
  assert.equal(bubbleStepToBubble({ kind: 'custom', modules: [{ type: 'text', text: 'original' }] }).modules[0].text, 'original');
});

test('bubble rows keep images isolated and canonicalize paired text without losing order', () => {
  const modules = [
    { type: 'text', text: 'left', row: 9 },
    { type: 'text', text: 'right', row: 9 },
    { type: 'image', imgId: 'bimg_sample', row: 9 },
    { type: 'text', text: 'tail' },
  ];
  assert.deepEqual(bubbleRowsOf(modules).map(row => row.map(module => module.text || module.type)), [
    ['left', 'right'], ['image'], ['tail'],
  ]);
  bubbleRowsCanon(modules);
  assert.deepEqual(modules.map(module => module.text || module.type), ['left', 'right', 'image', 'tail']);
  assert.equal(modules[0].row, 1);
  assert.equal(modules[1].row, 1);
  assert.equal(modules[2].row, undefined);
  assert.equal(modules[3].row, undefined);
});

test('usage model aggregation keeps decimal amounts and sorts by total cost', () => {
  assert.deepEqual(aggregateUsageModels([
    { models: [{ model: 'A', cost: 0.125 }, { model: 'B', cost: 2 }] },
    { models: [{ model: 'A', cost: 0.375 }, { model: 'B', cost: 1 }] },
  ]), [{ model: 'B', cost: 3 }, { model: 'A', cost: 0.5 }]);
});

test('bubble draft commands preserve order when pairing, splitting and replacing', () => {
  const draft = [
    { kind: 'normal' },
    { kind: 'custom', modules: [{ type: 'text', text: 'A' }] },
    { kind: 'custom', modules: [{ type: 'text', text: 'B' }] },
    { kind: 'custom', modules: [{ type: 'text', text: 'C' }] },
  ];
  assert.equal(pairBubbleSteps(draft, 1, 2, 'pairR'), true);
  assert.equal(draft[1].kind, 'choice');
  assert.deepEqual(draft[1].options.map(option => option.item.modules[0].text), ['B', 'A']);
  assert.deepEqual(pairBubbleSteps(draft, 2, 1, 'pairL'), { replaceSide: 0 });
  assert.equal(replaceBubbleChoiceSide(draft, 2, 1, 0), true);
  assert.deepEqual(draft[1].options.map(option => option.item.modules[0].text), ['C', 'A']);
  assert.equal(splitBubbleChoiceSide(draft, 1, 0, 1, 'before'), true);
  assert.deepEqual(draft.slice(1).map(step => step.modules[0].text), ['C', 'A']);
  assert.equal(reorderBubbleStep(draft, 1, 2, 'after'), true);
  assert.deepEqual(draft.slice(1).map(step => step.modules[0].text), ['A', 'C']);
  assert.equal(moveBubbleStepToEnd(draft, 1, -1), true);
  assert.deepEqual(draft.slice(1).map(step => step.modules[0].text), ['C', 'A']);
  assert.equal(pairBubbleSteps(draft, 1, 2, 'pairL'), true);
  assert.equal(unpairBubbleStep(draft, 1), true);
  assert.deepEqual(draft.slice(1).map(step => step.modules[0].text), ['C', 'A']);
});
