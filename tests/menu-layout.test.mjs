import test from 'node:test';
import assert from 'node:assert/strict';
import { MENU_LAYOUT, mountMenu } from '../desktop/ui/features/widget/menu-layout.js';

function element() {
  return { dataset: {}, children: [], replaceChildren(...children) { this.children = children; }, remove() {} };
}

test('compact menu mounts the required rows in product order regardless of registration or text', () => {
  const containers = { view: element(), navigation: element(), footer: element() };
  const controller = mountMenu(MENU_LAYOUT, new Map(), 'api', containers);
  const ids = ['role', 'size', 'dataSource', 'displayMode', 'sound', 'bubble', 'ledger', 'advanced'];
  for (const id of [...ids].reverse()) controller.register({ id, element: { ...element(), textContent: 'renamed: ' + id } });
  const mounted = () => Object.values(containers).flatMap(slot => slot.children.map(row => row.dataset.menuId));
  assert.deepEqual(mounted(), ids);
  controller.applyMode('subscription');
  assert.deepEqual(mounted(), ids.filter(id => id !== 'ledger'));
  controller.applyMode('api');
  assert.deepEqual(mounted(), ids);
  assert.throws(() => controller.register({ id: 'legacySound', element: element() }), /Unknown/);
});

test('late registration and disposal preserve another owner replacing a menu row', () => {
  const containers = { view: element(), navigation: element(), footer: element() };
  const controller = mountMenu(MENU_LAYOUT, new Map(), 'api', containers);
  const release = controller.register({ id: 'sound', element: element() });
  const replacement = element();
  const remove = controller.register({ id: 'sound', element: replacement });
  release();
  assert.deepEqual(containers.view.children, [replacement]);
  remove();
  assert.deepEqual(containers.view.children, []);
});
