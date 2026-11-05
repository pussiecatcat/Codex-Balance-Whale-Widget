// Polling policy for DIY providers. A model without a bubble binding or an
// alert has nothing to update on screen, so it should not hit the network in
// the background. Alert models keep polling while the widget is hidden, but a
// failing provider backs off instead of being retried every minute.
export const ALERT_KEYS = Object.freeze(['balanceBelow', 'dailyTokens', 'dailyBudget', 'quotaRemainingBelow']);

export function hasModelAlert(model) {
  const alerts = model?.alerts || {};
  return ALERT_KEYS.some(key => alerts[key] !== null && alerts[key] !== undefined && alerts[key] !== '' && Number.isFinite(Number(alerts[key])));
}

export function needsModelPolling(model, { bound = false, visible = true } = {}) {
  if (hasModelAlert(model)) return true;
  return visible && bound;
}

export function nextPollDelay(failures) {
  const count = Math.max(1, Number(failures) || 1);
  return Math.min(300000, 60000 * 2 ** Math.min(count - 1, 3));
}
