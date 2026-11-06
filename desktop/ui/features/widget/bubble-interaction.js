// Character clicks either restart or advance a round; bubble clicks always
// advance or dismiss the active scene.
export function createBubbleInteraction(deps) {
  const {
    isEnabled, getScene, isShown, getCurrentNotice, closeWait,
    isSubscription, refreshQuota, startRound, isAtRoundStart, shouldAdvanceOnCharacter, canAdvance, showNext,
    closeCost, closeAlert, closeBubble,
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
      if (isSubscription()) refreshQuota();
      if (isShown() && shouldAdvanceOnCharacter?.() === true) {
        if (canAdvance()) showNext();
        else closeBubble();
        return;
      }
      // With the option off, a character click returns to the first item, and
      // the bubble remains the way to move forward. Already on the first item,
      // only the character reacts: repainting the same content looks like a jump.
      if (isShown() && isAtRoundStart?.() === true) return;
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
