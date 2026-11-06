import test from 'node:test';
import assert from 'node:assert/strict';
import { createScope } from '../desktop/ui/services/scope.js';

function target() {
  const listeners = new Map();
  return {
    listeners,
    addEventListener(type, fn) { if (!listeners.has(type)) listeners.set(type, new Set()); listeners.get(type).add(fn); },
    removeEventListener(type, fn) { listeners.get(type)?.delete(fn); },
  };
}

test('dispose removes listeners, clears timers and aborts requests', async () => {
  const scope = createScope('test');
  const node = target();
  let clicked = 0, ticked = 0, timed = 0;
  scope.on(node, 'click', () => { clicked++; });
  scope.interval(() => { ticked++; }, 5);
  scope.timeout(() => { timed++; }, 5);
  const signal = scope.abortSignal();
  node.listeners.get('click').forEach(fn => fn());
  assert.equal(clicked, 1);
  scope.dispose();
  assert.equal(scope.disposed, true);
  assert.equal(node.listeners.get('click').size, 0);
  assert.equal(signal.aborted, true);
  await new Promise(resolve => setTimeout(resolve, 30));
  assert.equal(ticked, 0);
  assert.equal(timed, 0);
});

test('a child scope is disposed with its parent, and a failing disposer does not stop the rest', () => {
  const scope = createScope('root');
  const child = scope.child('child');
  let childCleaned = 0, siblingCleaned = 0;
  child.add(() => { childCleaned++; });
  scope.add(() => { throw new Error('boom'); });
  scope.add(() => { siblingCleaned++; });
  scope.dispose();
  assert.equal(child.disposed, true);
  assert.equal(childCleaned, 1);
  assert.equal(siblingCleaned, 1);
  scope.dispose();
  assert.equal(siblingCleaned, 1, 'a second dispose is a no-op');
});
