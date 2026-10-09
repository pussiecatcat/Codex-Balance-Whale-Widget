import test from 'node:test';
import assert from 'node:assert/strict';
import { artCenterAt, clampToViewport, restoreAnchor, snapZones } from '../desktop/ui/features/widget/anchors.js';

test('drag positions and saved anchors stay visible when the host shrinks', () => {
  const viewport = { w: 90, h: 80 };
  assert.deepEqual(clampToViewport(1000, -10, 60, 50, viewport), { left: 30, top: 0 });
  assert.deepEqual(restoreAnchor({ v: 2, hAnchor: 'right', hDist: 100, vAnchor: 'bottom', vDist: 100 }, viewport, 60, 50, 12),
    { left: 0, top: 0, h: 'right', hOff: 100, v: 'bottom', vOff: 100 });
  assert.equal(restoreAnchor({ v: 2, hAnchor: 'left', hDist: -1, vAnchor: 'top', vDist: 0 }, viewport, 60, 50), null);
});

test('snap zones use image center and preserve the left-facing rule', () => {
  const config = { mode: 'ratio', ratio: { L: 10, T: 10, R: 10, B: 10, F: 50 } };
  const viewport = { w: 100, h: 100 };
  assert.deepEqual(snapZones(config, 5, 5, 40, viewport), { zH: 'left', zV: 'top', flip: true });
  assert.deepEqual(snapZones(config, 95, 40, 95, viewport), { zH: 'right', zV: 'bottom', flip: false });
  const center = artCenterAt(10, 20, 100, 100, true);
  assert.equal(center.cx < 60, true);
});
