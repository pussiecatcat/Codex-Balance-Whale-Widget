// Character clicks open a round; bubble clicks advance or dismiss the active scene.
// The editor's "clicking the character advances the queue" option moves the advance
// onto the character as well, one bubble per click, and closes the bubble when the
// last one is showing. Off by default: petting then only plays press/release
// feedback and the bubble stays the sole control over its own queue.
export function createBubbleInteraction(deps) {
  const {
    isEnabled, getScene, isShown, getCurrentNotice, closeWait,
    isSubscription, refreshQuota, startRound, canAdvance, showNext,
    closeCost, closeAlert, closeBubble, tapAdvance,
  } = deps;

  function whaleClick() {
    try {
      if (!isEnabled()) return;
      const scene = getScene();
      if (scene?.kind === 'wait') {
        const notice = getCurrentNotice();
        if (notice?.closeOnRole) closeWait(true, notice.id);
        return;
      }
      if (scene?.kind === 'cost' || scene?.kind === 'alert') return;
      if (isShown()) {
        if (tapAdvance && tapAdvance()) bubbleNext();
        return;
      }
      if (isSubscription()) refreshQuota();
      startRound();
    } catch (error) {}
  }

  function bubbleNext() {
    try {
      if (!isShown()) return;
      const scene = getScene();
      if (scene?.kind === 'cost') {
        closeCost();
        return;
      }
      if (scene?.kind === 'alert') {
        closeAlert();
        return;
      }
      if (scene?.kind === 'wait') {
        closeWait(true, getCurrentNotice()?.id);
        return;
      }
      if (canAdvance()) {
        showNext();
        return;
      }
      closeBubble();
    } catch (error) {}
  }

  return Object.freeze({ whaleClick, bubbleNext });
}
