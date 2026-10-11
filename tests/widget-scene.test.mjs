import test from 'node:test';
import assert from 'node:assert/strict';
import { createBubbleSceneController } from '../desktop/ui/features/widget/bubble-scene.js';
import { createBubbleNoticeQueue } from '../desktop/ui/features/widget/bubble-notice-queue.js';

test('scene ignores a stale transition after a rapid reopen', async () => {
  const commits = [];
  const classes = new Set();
  const frames = {
    front: { name: 'front' }, cancel() {}, close() {},
    open(render, ready) {
      render({ name: 'back' });
      ready();
      return new Promise(resolve => commits.push(resolve));
    },
  };
  const kinds = [];
  const scene = createBubbleSceneController({
    frames, box: { classList: { add: value => classes.add(value), remove: value => classes.delete(value) } },
    bindParts() {}, beforeRender() {}, afterCommit() {}, onAutoClose() {}, onSceneChange: kind => kinds.push(kind),
  });
  scene.open('normal', () => {}, 0);
  scene.open('cost', () => {}, 0);
  commits[0](false);
  await Promise.resolve();
  assert.equal(scene.scene.kind, 'cost');
  assert.equal(scene.shown, true);
  commits[1](true);
  await Promise.resolve();
  assert.equal(scene.epoch, 2);
  assert.deepEqual(kinds, ['normal', 'cost']);
  scene.clear();
  scene.dismiss();
  assert.equal(scene.shown, false);
  assert.equal(classes.has('dshwv-pop-open'), true);
  scene.closeVisual();
  assert.equal(classes.has('dshwv-pop-open'), false);
});

test('notice queue replaces waits and serves queued items by priority', async () => {
  const shown = [];
  const queue = createBubbleNoticeQueue({
    canShow: () => true, isBlocked: () => false, rejectWithoutCurrent: () => false,
    isVisible: () => true, showItem: item => shown.push(item.id),
  });
  queue.push({ kind: 'wait', id: 'wait-1' });
  queue.push({ kind: 'wait', id: 'wait-2' });
  assert.equal(queue.current.id, 'wait-2');
  queue.push({ kind: 'cost', id: 'cost', rank: 3 });
  queue.push({ kind: 'alert', id: 'alert', rank: 2 });
  assert.equal(queue.swapNext(), true);
  assert.equal(queue.current.id, 'alert');
  queue.done();
  assert.equal(queue.current.id, 'cost');
  assert.deepEqual(shown, ['wait-1', 'wait-2', 'alert', 'cost']);
  queue.clear();
  await new Promise(resolve => setTimeout(resolve, 40));
  assert.equal(queue.current, null);
});
