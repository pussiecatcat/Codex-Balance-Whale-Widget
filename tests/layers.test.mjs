import test from 'node:test';
import assert from 'node:assert/strict';
import { openOver, setLayer, layerValue } from '../desktop/ui/services/layers.js';

function fixture() {
  const elements = [];
  const document = { querySelectorAll: () => elements, documentElement: {}, defaultView: {
    getComputedStyle: element => ({ ...element.style, getPropertyValue: () => '20000' }),
  } };
  const create = (zIndex, display = 'flex') => {
    const element = { ownerDocument: document, style: { zIndex: String(zIndex), display }, dataset: {} };
    elements.push(element); return element;
  };
  return { create };
}

test('three nested dialogs are strictly above each parent', () => {
  const { create } = fixture();
  const parent = create(26000), child = create(20000), grandchild = create(20000), last = create(20000);
  openOver(parent, child); openOver(child, grandchild); openOver(grandchild, last);
  assert.ok(layerValue(parent) < layerValue(child));
  assert.ok(layerValue(child) < layerValue(grandchild));
  assert.ok(layerValue(grandchild) < layerValue(last));
});

test('automatic nesting skips hidden overlays and uses the highest visible parent', () => {
  const { create } = fixture();
  create(28000); create(90000, 'none'); const child = create(20000, 'none');
  assert.equal(openOver(null, child), 28010);
});

test('named layers reference the CSS table instead of duplicating numeric values', () => {
  const { create } = fixture(); const element = create(0);
  setLayer(element, 'popover');
  assert.equal(element.style.zIndex, 'var(--layer-popover)');
  assert.equal(element.dataset.whaleLayer, 'popover');
});
