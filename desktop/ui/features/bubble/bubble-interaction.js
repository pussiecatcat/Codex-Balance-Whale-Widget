// Character clicks open a round; bubble clicks advance or dismiss the active scene.
export function createBubbleInteraction(deps) {
  const {
    isEnabled, getScene, isShown, getCurrentNotice, closeWait,
    isSubscription, refreshQuota, startRound, canAdvance, showNext,
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
      // Petting an already open character only plays press/release feedback.
      // The bubble remains the sole control that advances or closes its queue.
      if (isShown()) return;
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
