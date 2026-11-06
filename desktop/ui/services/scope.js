// Owns every resource a feature creates. A disposed scope removes listeners,
// clears timers, aborts requests and releases child scopes.
export function createScope(name = 'scope') {
  const disposers = [];
  let disposed = false;
  const add = fn => {
    if (disposed) { fn(); return () => {}; }
    disposers.push(fn);
    return () => { const i = disposers.indexOf(fn); if (i >= 0) disposers.splice(i, 1); };
  };
  return {
    name,
    get disposed() { return disposed; },
    add,
    on(target, type, listener, options) {
      target.addEventListener(type, listener, options);
      return add(() => target.removeEventListener(type, listener, options));
    },
    interval(fn, ms) { const id = setInterval(fn, ms); return add(() => clearInterval(id)); },
    timeout(fn, ms) { const id = setTimeout(() => { remove(); fn(); }, ms); const remove = add(() => clearTimeout(id)); return remove; },
    abortSignal() { const controller = new AbortController(); add(() => controller.abort()); return controller.signal; },
    child(childName) { const child = createScope(name + '/' + childName); add(() => child.dispose()); return child; },
    dispose() {
      if (disposed) return;
      disposed = true;
      for (const fn of disposers.splice(0).reverse()) {
        try { fn(); } catch (error) { console.error('[scope]', name, error); }
      }
    },
  };
}
