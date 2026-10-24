import test from 'node:test';
import assert from 'node:assert/strict';
import { createTurnNoticePoller } from '../desktop/ui/features/usage/turn-notice-poller.js';

test('disposing a poll aborts transport and ignores a late response or late JSON body', async () => {
  for (const phase of ['response', 'body']) {
    let finish, signal, calls = 0;
    const updates = [], writes = [];
    const delayed = new Promise(resolve => { finish = resolve; });
    const poller = createTurnNoticePoller({
      fetch: (_url, options) => {
        calls++; signal = options.signal;
        return phase === 'response' ? delayed : Promise.resolve({ json: () => delayed });
      },
      window: { dispatchEvent: event => updates.push(event) },
      localStorage: { getItem: () => null, setItem: (...args) => writes.push(args) },
      WhaleTurnNotice: { shouldNotify: () => true, snapshot: record => record },
      getCurrency: () => 'USD', setLastTurnNotice: value => updates.push(value),
      playTaskEndSound: () => updates.push('sound'), showCostBubble: () => updates.push('bubble'),
    });
    const pending = poller.poll();
    await Promise.resolve();
    poller.dispose(); poller.dispose();
    assert.equal(signal.aborted, true);
    const data = { ok: true, seq: 1, id: 'new', completionKind: 'success' };
    finish(phase === 'response' ? { json: async () => data } : data);
    await pending;
    poller.poll();
    assert.equal(calls, 1); assert.deepEqual(updates, []); assert.deepEqual(writes, []);
  }
});

test('notice routing uses current subscription state and injected feedback operations', async () => {
  const events = [], notices = [], sounds = [], settled = [];
  let subscription = false, seq = 0;
  const poller = createTurnNoticePoller({
    fetch: async () => ({ json: async () => ({ ok: true, seq: ++seq, id: String(seq), amount: 0, completionKind: 'cancelled' }) }),
    window: { dispatchEvent: value => events.push(value) },
    CustomEvent: class { constructor(type, options) { this.type = type; this.detail = options.detail; } },
    localStorage: { getItem() {}, setItem() {} },
    WhaleTurnNotice: { shouldNotify: () => true, snapshot: value => value },
    getCurrency: () => 'USD', setLastTurnNotice() {}, getFeedbackVolume: () => .4,
    playFeedback: (...args) => sounds.push(args), showCostBubble() {},
    isSubscription: () => subscription, showSubscriptionNotice: notice => notices.push(notice),
    notifyQuotaSettled: () => settled.push(true),
  });
  await poller.poll(); subscription = true; await poller.poll(); poller.dispose();
  assert.equal(events.length, 2); assert.equal(notices.length, 1); assert.equal(notices[0].seq, 2);
  assert.deepEqual(settled, [true]);
  assert.deepEqual(sounds, [['cancelled', '', .4], ['cancelled', '', .4]]);
});
