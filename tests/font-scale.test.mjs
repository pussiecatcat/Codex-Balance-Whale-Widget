import test from 'node:test';
import assert from 'node:assert/strict';
import { fontUnits, displayLevel, upgradeFontScale, setFontLevel, legacyLevelToFine, FINE_FONT_SCALE } from '../desktop/ui/features/widget/font-scale.js';

test('the fine map is smaller than the legacy map at both ends', () => {
  assert.equal(fontUnits(1, {}), 40);
  assert.equal(fontUnits(50, {}), 240);
  const fine = { fontScale: FINE_FONT_SCALE };
  assert.equal(fontUnits(1, fine), 24);
  assert.equal(fontUnits(50, fine), 200);
  for (let level = 1; level <= 50; level++) assert.ok(fontUnits(level, fine) < fontUnits(level, {}), `level ${level}`);
});

test('a legacy module shows the fine level that looks the same', () => {
  // 30 is the default hero size; its fine level must render within one step.
  for (const level of [1, 2, 4, 6, 11, 20, 30]) {
    const fine = legacyLevelToFine(level);
    const step = 176 / 49;
    assert.ok(Math.abs(fontUnits(fine, { fontScale: 2 }) - fontUnits(level, {})) <= step / 2 + 1, `legacy ${level} → fine ${fine}`);
  }
  assert.equal(displayLevel({ size: 30 }), legacyLevelToFine(30));
  assert.equal(displayLevel({ size: 30, fontScale: 2 }), 30);
});

test('levels the fine map cannot reach clamp to its maximum', () => {
  assert.equal(legacyLevelToFine(50), 50);
  assert.equal(legacyLevelToFine(45), 50);
});

test('moving a slider converts the whole module, then sets only the edited size', () => {
  const module = { type: 'random', size: 6, lines: [{ t: 'a', size: 22 }, { t: 'b' }, { t: 'c', size: 11 }] };
  setFontLevel(module, 9, module.lines[0]);
  assert.equal(module.fontScale, FINE_FONT_SCALE);
  assert.equal(module.lines[0].size, 9);
  assert.equal(module.lines[1].size, undefined, 'a line without its own size keeps following the module');
  assert.equal(module.lines[2].size, legacyLevelToFine(11));
  assert.equal(module.size, legacyLevelToFine(6));
});

test('upgrading is idempotent and keeps a missing module size readable', () => {
  const module = { type: 'text', text: 'x' };
  upgradeFontScale(module);
  assert.equal(module.size, legacyLevelToFine(6));
  const snapshot = JSON.stringify(module);
  upgradeFontScale(module);
  assert.equal(JSON.stringify(module), snapshot);
});
