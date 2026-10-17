import test from 'node:test';
import assert from 'node:assert/strict';

import { createBubbleInteraction } from '../desktop/ui/features/widget/bubble-interaction.js';

function fixture({ scene = null, shown = false, notice = null, canAdvance = false, tapAdvance } = {}) {
  const calls = { refreshQuota: 0, startRound: 0, showNext: 0, closeBubble: 0, closeWait: [] };
  const interaction = createBubbleInteraction({
    isEnabled: () => true,
    getScene: () => scene,
    isShown: () => shown,
    getCurrentNotice: () => notice,
    closeWait: (clear, id) => calls.closeWait.push([clear, id]),
    isSubscription: () => true,
    refreshQuota: () => { calls.refreshQuota++; },
    startRound: () => { calls.startRound++; },
    canAdvance: () => canAdvance,
    showNext: () => { calls.showNext++; },
    closeCost: () => {},
    closeAlert: () => {},
    closeBubble: () => { calls.closeBubble++; },
    ...(tapAdvance === undefined ? {} : { tapAdvance }),
  });
  return { interaction, calls };
}

const idle = { refreshQuota: 0, startRound: 0, showNext: 0, closeBubble: 0, closeWait: [] };

test('a character click with no bubble open starts a round and refreshes the quota', () => {
  const { interaction, calls } = fixture();
  interaction.whaleClick();
  assert.deepEqual(calls, { ...idle, refreshQuota: 1, startRound: 1 });
});

// Off - the default, and what a caller that never wired the option gets - a click on
// the character goes back to the first bubble of the round. That is upstream's rule
// and what the option's own sentence describes.
test('with the option off, petting an open bubble goes back to the first one', () => {
  const off = fixture({ shown: true, canAdvance: true, tapAdvance: () => false });
  off.interaction.whaleClick();
  assert.deepEqual(off.calls, { ...idle, startRound: 1 });

  const absent = fixture({ shown: true, canAdvance: true });
  absent.interaction.whaleClick();
  assert.deepEqual(absent.calls, { ...idle, startRound: 1 }, 'a caller that never wired the option gets upstream behaviour');
});

test('with the option on, one click advances one bubble and the last one closes it', () => {
  const advancing = fixture({ shown: true, canAdvance: true, tapAdvance: () => true });
  advancing.interaction.whaleClick();
  assert.equal(advancing.calls.showNext, 1);
  assert.equal(advancing.calls.closeBubble, 0);
  assert.equal(advancing.calls.startRound, 0, 'an already open round is advanced, not restarted');

  const last = fixture({ shown: true, canAdvance: false, tapAdvance: () => true });
  last.interaction.whaleClick();
  assert.equal(last.calls.closeBubble, 1, 'petting the last bubble puts it away');
  assert.equal(last.calls.showNext, 0);
});

test('the notice, cost and alert scenes keep their own click behaviour', () => {
  const waiting = fixture({ scene: { kind: 'wait' }, notice: { id: 'n1', closeOnRole: true }, tapAdvance: () => true });
  waiting.interaction.whaleClick();
  assert.deepEqual(waiting.calls.closeWait, [[true, 'n1']], 'the option never overrides closing a wait notice');

  for (const kind of ['cost', 'alert']) {
    const other = fixture({ scene: { kind }, shown: true, tapAdvance: () => true });
    other.interaction.whaleClick();
    assert.deepEqual(other.calls, idle, kind + ' scenes are left to their own controls');
  }
});

test('a bubble click still advances and closes on its own', () => {
  const advancing = fixture({ shown: true, canAdvance: true });
  advancing.interaction.bubbleNext();
  assert.equal(advancing.calls.showNext, 1);

  const last = fixture({ shown: true, canAdvance: false });
  last.interaction.bubbleNext();
  assert.equal(last.calls.closeBubble, 1);
});
