// Runtime pushes from the service: turn completion and pending-wait changes.
// The widget takes one snapshot at startup, then follows these events instead of
// polling the two JSON routes every second.
export function createRuntimeFeed({ bridge = null, scope = null } = {}) {
  const listeners = new Map();
  let unsubscribe = null;
  function subscribe(type, fn) {
    if (!listeners.has(type)) listeners.set(type, new Set());
    listeners.get(type).add(fn);
    return () => listeners.get(type)?.delete(fn);
  }
  function dispatch(event) {
    if (!event || !event.type) return;
    for (const fn of listeners.get(event.type) || []) {
      try { fn(event.payload); } catch (error) { console.error('[runtime-feed] subscriber failed', error); }
    }
  }
  function start() {
    if (unsubscribe || !bridge?.onRuntimeEvent) return;
    unsubscribe = bridge.onRuntimeEvent(dispatch);
  }
  start();
  scope?.add?.(() => { unsubscribe?.(); unsubscribe = null; });
  return { subscribe, dispatch, start };
}
