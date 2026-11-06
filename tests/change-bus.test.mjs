import test from 'node:test';
import assert from 'node:assert/strict';
import busModule from '../desktop/change-bus.cjs';

const { createChangeBus } = busModule;

const target = (alive = true) => {
  const sent = [];
  return {
    sent,
    isDestroyed: () => !alive,
    webContents: { isDestroyed: () => !alive, send: (_channel, message) => sent.push(message) },
  };
};

test('publish increments a revision and reaches every live window once', () => {
  const first = target(), second = target();
  const bus = createChangeBus({ targets: () => [first, second] });
  assert.equal(bus.publish({ domain: 'size' }), 1);
  assert.equal(bus.publish({ domain: 'bubble' }), 2);
  assert.deepEqual(first.sent.map(item => item.domain), ['size', 'bubble']);
  assert.equal(second.sent[1].revision, 2);
});

test('destroyed windows are skipped without consuming an error', () => {
  const live = target(), closed = target(false);
  const bus = createChangeBus({ targets: () => [closed, live] });
  assert.equal(bus.publish({ domain: 'media', kind: 'roles' }), 1);
  assert.equal(closed.sent.length, 0);
  assert.equal(live.sent[0].kind, 'roles');
});
