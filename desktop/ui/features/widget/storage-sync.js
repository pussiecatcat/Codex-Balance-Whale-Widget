// Send changed keys with an acknowledged baseline instead of whole snapshots.
export function createStorageSync({ initial = {}, read, write, reconcile }) {
  let acknowledged = { ...initial }, saving = null;
  function pending() {
    const current = read(), changes = {}, base = {};
    for (const key of new Set([...Object.keys(current), ...Object.keys(acknowledged)])) {
      const next = current[key] ?? null, previous = acknowledged[key] ?? null;
      if (next !== previous) { changes[key] = next; base[key] = previous; }
    }
    return { changes, base };
  }
  function save() {
    if (saving) return saving;
    const patch = pending();
    if (!Object.keys(patch.changes).length) return Promise.resolve();
    saving = Promise.resolve().then(() => write(patch)).then(result => {
      if (!result?.ok || !result.values) return;
      acknowledged = { ...result.values };
      const current = read();
      for (const key of Object.keys(patch.changes)) {
        const serverValue = acknowledged[key] ?? null;
        if ((current[key] ?? null) === patch.changes[key] && serverValue !== patch.changes[key]) reconcile(key, serverValue);
      }
    }).catch(() => {}).finally(() => { saving = null; });
    return saving;
  }
  return { pending, save };
}
