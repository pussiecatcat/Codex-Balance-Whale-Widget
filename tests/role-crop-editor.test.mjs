import test from 'node:test';
import assert from 'node:assert/strict';
import { clampCropAngle, cropDisplaySize } from '../desktop/ui/features/widget/role-crop-editor.js';

test('crop angles clamp and the displayed size accounts for rotation', () => {
  assert.equal(clampCropAngle(400), 360);
  assert.equal(clampCropAngle(-999), -360);
  assert.equal(clampCropAngle('x'), 0);
  assert.equal(clampCropAngle(12.6), 13);

  const state = { img: { width: 100, height: 50 }, baseScale: 2, zoom: 1, rotation: 0 };
  assert.deepEqual(cropDisplaySize(state), { w: 200, h: 100, s: 2 });
  state.rotation = 90;
  const rotated = cropDisplaySize(state);
  assert.ok(Math.abs(rotated.w - 100) < 1e-9);
  assert.ok(Math.abs(rotated.h - 200) < 1e-9);
});
