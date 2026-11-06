import test from 'node:test';
import assert from 'node:assert/strict';

import { createBubbleInteraction } from '../desktop/ui/features/widget/bubble-interaction.js';

function fixture({ scene = null, shown = false, notice = null, canAdvance = false, advanceOnCharacter } = {}) {
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
  });
  return { interaction, calls };
}

const idle = { refreshQuota: 0, startRound: 0, showNext: 0, closeBubble: 0, closeWait: [] };

test('a character click with no bubble open starts at the first bubble and refreshes subscription quota', () => {
  const fx = fixture();
  fx.interaction.whaleClick();
  assert.deepEqual(fx.calls, { ...idle, refreshQuota: 1, startRound: 1 });
});

test('clicking the pet never switches or closes an open bubble', () => {
  for (const canAdvance of [true, false]) {
    const fx = fixture({ shown: true, canAdvance });
    fx.interaction.whaleClick();
    assert.deepEqual(fx.calls, { ...idle, refreshQuota: 1 });
  }
});

test('wait, cost and alert scenes keep their existing character-click rules', () => {
  const waiting = fixture({ scene: { kind: 'wait' }, notice: { id: 'n1', closeOnRole: true } });
  waiting.interaction.whaleClick();
  assert.deepEqual(waiting.calls.closeWait, [[true, 'n1']]);

  for (const kind of ['cost', 'alert']) {
    const fx = fixture({ scene: { kind }, shown: true });
    fx.interaction.whaleClick();
    assert.deepEqual(fx.calls, idle);
  }
});

test('clicking the bubble itself still advances and closes ', () => {
  const middle = fixture({ shown: true, canAdvance: true });
  middle.interaction.bubbleNext();
  assert.equal(middle.calls.showNext, 1);

  const final = fixture({ shown: true, canAdvance: false });
  final.interaction.bubbleNext();
  assert.equal(final.calls.closeBubble, 1);
});
