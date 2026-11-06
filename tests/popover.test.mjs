import test from 'node:test';
import assert from 'node:assert/strict';
import { createScope } from '../desktop/ui/services/scope.js';
import { createPopoverManager } from '../desktop/ui/services/popover.js';

function fixture() {
  const document = {
    listeners: new Map(),
    addEventListener(type, fn) { this.listeners.set(type, fn); },
    removeEventListener(type) { this.listeners.delete(type); },
  };
  const scope = createScope('popover');
  const manager = createPopoverManager({ document, scope });
  const node = () => ({ contains: target => ['inner', 'anchor'].includes(target) });
  return { document, scope, manager, node };
}

test('Escape closes only the top popover and closes its children with it', () => {
  const { document, manager, node } = fixture();
  let closedA = 0, closedB = 0;
  manager.open({ element: node(), anchor: node(), onClose: () => { closedA++; } });
  manager.open({ element: node(), anchor: node(), onClose: () => { closedB++; } });
  document.listeners.get('keydown')({ key: 'Escape', stopPropagation() {} });
  assert.equal(closedB, 1);
  assert.equal(closedA, 0);
  document.listeners.get('keydown')({ key: 'Escape', stopPropagation() {} });
  assert.equal(closedA, 1);
});

test('a click inside the popover or on its anchor keeps it open', () => {
  const { document, manager, node } = fixture();
  let closed = 0;
  manager.open({ element: node(), anchor: node(), onClose: () => { closed++; } });
  document.listeners.get('pointerdown')({ target: 'inner' });
  document.listeners.get('pointerdown')({ target: 'anchor' });
  assert.equal(closed, 0);
  document.listeners.get('pointerdown')({ target: 'outside' });
  assert.equal(closed, 1);
});

test('disposing the scope removes the document listeners', () => {
  const { document, scope } = fixture();
  scope.dispose();
  assert.equal(document.listeners.size, 0);
});
