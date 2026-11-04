import test from 'node:test';
import assert from 'node:assert/strict';
import { bubbleFontFloor } from '../desktop/ui/features/widget/bubble-rows-view.js';

test('primary bubble values and secondary lines keep a readable floor', () => {
  assert.equal(bubbleFontFloor(20), 12);
  assert.equal(bubbleFontFloor(12), 12);
  assert.equal(bubbleFontFloor(4), 10);
  assert.equal(bubbleFontFloor(1), 10);
});
