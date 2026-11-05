import test from 'node:test';
import assert from 'node:assert/strict';
import { bubbleDefaultQueue, bubblePresetItems, bubbleDefaultCompanionQueue } from '../desktop/ui/features/widget/default-content.js';

const modulesOf = items => items.flatMap(item => (item.modules || []).map(module => module.type));

test('the API default second screen shows data, not a random joke', () => {
  const queue = bubbleDefaultQueue(false);
  assert.equal(queue.length, 2);
  assert.deepEqual(modulesOf([queue[1]]), ['text', 'turn', 'session', 'source']);
  assert.equal(modulesOf(queue).includes('random'), false);
});

test('the companion preset keeps the original random second screen', () => {
  const companion = bubbleDefaultCompanionQueue(false);
  assert.equal(JSON.stringify(companion[1]).includes('"type":"random"'), true);
  assert.deepEqual(bubblePresetItems('companion', false), companion);
});

test('the minimal preset keeps only the primary number and mode-specific presets stay separate', () => {
  assert.deepEqual(modulesOf(bubblePresetItems('minimal', false)), ['balance']);
  assert.deepEqual(modulesOf(bubblePresetItems('minimal', true)), ['quota']);
  const quota = bubblePresetItems('quota', true);
  assert.deepEqual(modulesOf(quota), ['text', 'quota', 'quota', 'source', 'text', 'quota', 'quota', 'source']);
  assert.deepEqual(modulesOf(bubblePresetItems('quota-cards', true)), ['plan', 'quota', 'quota']);
  assert.deepEqual(modulesOf([bubblePresetItems('quota', false).at(1)]), ['text', 'turn', 'session', 'source']);
});
