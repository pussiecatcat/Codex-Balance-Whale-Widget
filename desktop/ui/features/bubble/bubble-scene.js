// Coordinates renderer transitions and TTL ownership. The caller supplies only
// content building and the effects that depend on account/menu state.
export function createBubbleSceneController({ frames, box, bindParts, beforeRender, afterCommit, onAutoClose, onSceneChange }) {
  let timer = null;
  const controller = {
    scene: null,
    shown: false,
    building: false,
    epoch: 0,
    clear() {
      ++controller.epoch;
      frames.cancel();
      if (timer) clearTimeout(timer);
      timer = null;
    },
    closeVisual() {
      frames.close();
      box.classList.remove('dshwv-pop-open');
    },
    dismiss() {
      controller.scene = null;
      controller.shown = false;
    },
    open(kind, render, ttlMs) {
      const wasOpen = controller.shown;
      const previousScene = controller.scene;
      controller.clear();
      const entry = controller.epoch;
      controller.scene = { kind, ttlMs: ttlMs || 0 };
      controller.shown = true;
      onSceneChange(kind);
      // Build once at entry. Data callbacks cannot repaint either live buffer.
      frames.open(parts => {
        controller.building = true;
        bindParts(parts);
        try { beforeRender(); render(); }
        finally { controller.building = false; bindParts(frames.front); }
      }, () => {
        box.classList.add('dshwv-pop-open');
        afterCommit();
      }).then(committed => {
        if (entry !== controller.epoch) return;
        bindParts(frames.front);
        if (!committed) {
          controller.scene = previousScene;
          controller.shown = wasOpen;
          onSceneChange(previousScene?.kind);
          if (!wasOpen) controller.closeVisual();
          return;
        }
        afterCommit(true);
        if (ttlMs > 0) timer = setTimeout(onAutoClose, ttlMs);
      });
    },
    timerFired() { timer = null; },
    resetTtl() {
      if (timer) clearTimeout(timer);
      timer = null;
      if (controller.scene?.ttlMs > 0) timer = setTimeout(onAutoClose, controller.scene.ttlMs);
    },
  };
  return controller;
}
