import test from 'node:test';
import assert from 'node:assert/strict';
import { createVisibilityRow, createVisibilityState } from '../desktop/ui/features/widget/visibility-controls.js';

test('hiding and restoring preserves the recovery control', () => {
  const classes = new Set();
  const root = { classList: { add: x => classes.add(x), remove: x => classes.delete(x) } };
  const button = {};
  const state = createVisibilityState(root, button);
  assert.equal(state.restore(), false);
  state.hide();
  assert.equal(classes.has('dshwv-whale-hidden'), true);
  assert.equal(button.title, '恢复大肥鱼');
  assert.equal(state.restore(), true);
  assert.equal(classes.size, 0);
  assert.equal(button.title, '菜单');
});

test('close requires confirmation while hide acts immediately', () => {
  const document = { createElement: () => ({ addEventListener(_name, fn) { this.click = fn; } }) };
  const row = { append(...items) { this.items = items; } };
  let hidden = 0, stopped = 0, confirmStop;
  createVisibilityRow({ document, row, hide: () => hidden++, stop: () => stopped++, confirm: (_message, fn) => { confirmStop = fn; } });
  row.items[0].click();
  row.items[1].click();
  assert.equal(hidden, 1);
  assert.equal(stopped, 0);
  confirmStop();
  assert.equal(stopped, 1);
});
