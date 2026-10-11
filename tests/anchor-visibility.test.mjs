import test from 'node:test';
import assert from 'node:assert/strict';
import { settlePosition } from '../desktop/ui/features/widget/anchors.js';

test('restoring a smaller host keeps old or negative saved anchors within the viewport', () => {
  for (const [h, v, hOff, vOff] of [['right','bottom',-2208,-918], ['left','top',2208,918], ['right','bottom',20,30]]) {
    const position = settlePosition({ h, v, hOff, vOff, left: 0, top: 0 }, { w: 400, h: 300 }, 120, 140);
    assert.ok(position.left >= 0 && position.left + 120 <= 400);
    assert.ok(position.top >= 0 && position.top + 140 <= 300);
    if(hOff===20){ assert.equal(position.left,260); assert.equal(position.top,130); }
  }
});
