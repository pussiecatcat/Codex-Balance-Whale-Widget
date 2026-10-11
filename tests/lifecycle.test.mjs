import test from 'node:test';
import assert from 'node:assert/strict';
import { createLifecycle } from '../desktop/ui/services/lifecycle.js';

test('a disposed feature releases effects once and rejects late asynchronous UI callbacks', async () => {
  const scope = createLifecycle(), target = new EventTarget();
  let calls = 0, releases = 0;
  scope.listen(target, 'change', () => calls++);
  target.dispatchEvent(new Event('change'));
  const release = scope.add(() => releases++);
  release(); release();
  const late = Promise.resolve().then(scope.guard(() => calls++));
  scope.timeout(() => calls++, 1);
  scope.dispose(); scope.dispose();
  target.dispatchEvent(new Event('change'));
  await late;
  await new Promise(resolve => setTimeout(resolve, 10));
  assert.equal(calls, 1);
  assert.equal(releases, 1);
  assert.equal(scope.signal.aborted, true);
  const next = createLifecycle();
  next.listen(target, 'change', () => calls++);
  target.dispatchEvent(new Event('change'));
  assert.equal(calls, 2);
  next.dispose();
});
