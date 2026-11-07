// Show and recovery for the widget renderer. The timers and the attempt count
// live in the state object main.cjs hands over, so tests exercise the same code
// without cutting the source into a sandbox.
function createRendererLifecycle({ getWindow, getQuitting, state, visibilityController, diagnose, hideManuallyOff = () => {}, recoveryDelayMs = 500, maxAttempts = 3, setTimeout: setTimer = setTimeout }) {
  function show() {
    hideManuallyOff();
    // Showing during normal startup must not restart an already loading page.
    if (!state.ready && !state.readyTimer && !state.recoveryTimer) {
      const window = getWindow();
      if (window && !window.isDestroyed() && !window.webContents.isLoading()) {
        state.attempts = 0; recoverRenderer('manual-recovery');
      }
    }
    visibilityController.requestRecovery();
  }
  function recoverRenderer(reason) {
    diagnose(reason);
    const window = getWindow();
    if (getQuitting() || state.recoveryTimer || state.attempts >= maxAttempts || !window || window.isDestroyed()) return;
    state.attempts++;
    state.recoveryTimer = setTimer(() => {
      state.recoveryTimer = null;
      if (!getQuitting() && !state.ready && !window.isDestroyed()) window.webContents.reload();
    }, recoveryDelayMs * state.attempts);
  }
  return { show, recoverRenderer };
}
module.exports = { createRendererLifecycle };
