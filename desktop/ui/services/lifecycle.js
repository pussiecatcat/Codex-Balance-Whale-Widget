// A feature owns every effect it starts. Guards also prevent already-resolved
// asynchronous work from mutating the UI after disposal.
export function createLifecycle() {
  const controller = new AbortController(), cleanup = new Set();
  let disposed = false;
  const guard = fn => function (...args) { if (!disposed) return fn.apply(this, args); };
  const add = release => {
    if (typeof release !== 'function') return () => {};
    let released = false;
    const once = () => { if (released) return; released = true; cleanup.delete(once); release(); };
    if (disposed) once(); else cleanup.add(once);
    return once;
  };
  return {
    get disposed() { return disposed; }, signal: controller.signal, guard, add,
    listen(target, name, fn, options) {
      const handler = guard(fn); target.addEventListener(name, handler, options);
      return add(() => target.removeEventListener?.(name, handler, options));
    },
    timeout(fn, delay) {
      let release;
      const id = setTimeout(() => { cleanup.delete(release); if (!disposed) fn(); }, delay);
      release = add(() => clearTimeout(id)); return id;
    },
    frame(fn) {
      let release;
      const id = requestAnimationFrame(() => { cleanup.delete(release); if (!disposed) fn(); });
      release = add(() => cancelAnimationFrame(id)); return id;
    },
    dispose() {
      if (disposed) return;
      disposed = true; controller.abort();
      for (const release of cleanup) { try { release(); } catch {} }
      cleanup.clear();
    },
  };
}
