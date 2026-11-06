// Settings client shared by both windows. The main process owns the store; this
// is only a mirror plus a subscription so a change made in one window reaches
// the other without either side polling.
export function createSettingsClient({ bridge, scope }) {
  const mirrors = new Map(), listeners = new Map();
  const unsubscribe = bridge.onSettingsChanged(change => {
    if (change?.values) mirrors.set(change.domain, { ...mirrors.get(change.domain), ...change.values });
    for (const fn of listeners.get(change.domain) || []) fn(change);
  });
  scope?.add?.(unsubscribe);
  return {
    async read(domains) {
      const result = await bridge.readSettings(domains);
      if (result?.ok) for (const [domain, values] of Object.entries(result.values || {})) mirrors.set(domain, values);
      return result;
    },
    write: request => bridge.writeSettings(request),
    preview: request => bridge.previewSettings(request),
    current: domain => mirrors.get(domain),
    subscribe(domain, fn) {
      if (!listeners.has(domain)) listeners.set(domain, new Set());
      listeners.get(domain).add(fn);
      return () => listeners.get(domain)?.delete(fn);
    },
  };
}
