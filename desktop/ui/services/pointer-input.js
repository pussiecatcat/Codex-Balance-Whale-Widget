import { createInputHitTester, createRoleHitPreparer, pointerPressAccepted } from '../features/widget/input-policy.js';
import { createStorageSync } from '../features/widget/storage-sync.js';

// The pointer layer decides whether the native window accepts clicks at the
// cursor, mirrors keyboard focus, and keeps widget-local storage in sync. It was
// a classic script; the entry now constructs it with the widget's bridge.
export function createPointerInput({ window: win, document: doc, bridge, rendering, storage, toast = () => {}, scope = null }) {
  const listen = (target, type, fn, options) => scope ? scope.on(target, type, fn, options) : target.addEventListener(type, fn, options);
  function initialize() {
    if (!bridge || !rendering) return null;
    const pet = doc.querySelector('.dshwv-img'), root = doc.querySelector('.dshwv-root');
    if (!pet || !root) return null;
    let pointerEventAt = 0;
    let point = { x: -1, y: -1 }, heldPointer = null, releaseEpoch = 0, interactive = false, keyboardFocus = false, externalDrag = false;
    const keyboardSurfaces = 'dialog[open],.dshwv-menu-open,.dshwv-rolelist,.dshwv-audiolist,[class*="mask"],.dshwv-qedit,.dshwv-usagepanel,.dshwv-custmenu,.dshwv-fx-info';
    const { hit } = createInputHitTester({ document: doc, pet, root, rendering, getComputedStyle: win.getComputedStyle,
      viewport: () => ({ width: win.innerWidth, height: win.innerHeight }) });
    function update() {
      const next = heldPointer !== null || !externalDrag && hit(point);
      if (next !== interactive) { interactive = next; bridge.interactive(next); }
    }
    function updateKeyboardFocus() {
      // Menu fades start at opacity 0 and end without a DOM mutation. Use whether
      // the surface accepts input, so keyboard activation follows open/close now.
      const next = [...doc.querySelectorAll(keyboardSurfaces)].some(el =>
        el.checkVisibility({ visibilityProperty: true }) && win.getComputedStyle(el).pointerEvents !== 'none');
      if (next !== keyboardFocus) { keyboardFocus = next; bridge.keyboardFocus(next); }
    }
    function track(e) { pointerEventAt = Date.now(); point = { x: e.clientX, y: e.clientY }; externalDrag = heldPointer === null && Number(e.buttons) > 0; update(); }
    // Real movement events are handled while interactive. Ignored Windows areas
    // use bridge.onCursor below and do not forward host mouse events to Chromium.
    listen(doc, 'mousemove', track, true);
    listen(doc, 'pointermove', track, true);
    listen(doc, 'pointerdown', e => {
      externalDrag = false;
      ++releaseEpoch;
      point = { x: e.clientX, y: e.clientY };
      // The widget's earlier capture listener may already accept this press and
      // start the squish animation. Its pending pointer capture is authoritative:
      // testing the now-moving alpha again must not discard the accepted gesture.
      if (pointerPressAccepted(root, e, hit, point)) heldPointer = e.pointerId;
      update();
    }, true);
    function release(e) {
      externalDrag = false;
      if (e?.clientX !== undefined) point = { x: e.clientX, y: e.clientY };
      const epoch = ++releaseEpoch;
      // Finish the application's pointerup/capture handlers before changing the
      // native window's input flags. A pressed/turning sprite may miss this pixel.
      win.requestAnimationFrame(() => { if (epoch === releaseEpoch) { heldPointer = null; update(); } });
    }
    listen(doc, 'pointerup', release, true);
    listen(doc, 'pointercancel', release, true);
    listen(doc, 'lostpointercapture', release, true);
    listen(win, 'blur', () => { ++releaseEpoch; heldPointer = null; point = { x: -1, y: -1 }; update(); });
    bridge.onCursor(p => {
      // Preserve the real pointer during a captured drag; native fallback only discovers hover.
      if (heldPointer === null) {
        if (typeof p.buttons === 'number' && (!p.sampledAt || p.sampledAt >= pointerEventAt)) externalDrag = p.buttons > 0;
        point = p; update();
        win.dispatchEvent(new win.CustomEvent('whale-hover', { detail: externalDrag ? { x: -1, y: -1 } : p }));
      }
    });
    listen(win, 'whale-mode-changing', () => { ++releaseEpoch; heldPointer = null; externalDrag = false; point = { x: -1, y: -1 }; update(); });
    rendering.onFrame(update);
    if (bridge.testMode) win.__whaleInputTest = { hit };
    const request = () => { updateKeyboardFocus(); rendering.presentFor(); };
    const observer = new win.MutationObserver(request);
    observer.observe(doc.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['style', 'class', 'src', 'open', 'hidden', 'inert'] });
    scope?.add(() => observer.disconnect());
    listen(doc, 'transitionrun', e => {
      if (e.target.closest('.dshwv-root,.dshwv-position')) rendering.presentFor(600);
    }, true);
    listen(win, 'resize', () => rendering.presentFor(220));
    const roleHit = createRoleHitPreparer({
      pet, rendering, bridge, window: win, CustomEvent: win.CustomEvent, document: doc, request, toast,
    });
    pet.addEventListener('load', roleHit.prepare);
    pet.addEventListener('error', roleHit.fallback);
    roleHit.prepare();
    const storageSync = createStorageSync({ initial: bridge.storage,
      read: () => Object.fromEntries(Object.keys(storage).filter(key => /^dshw[-v]/.test(key)).map(key => [key, storage.getItem(key)])),
      write: patch => bridge.save(patch),
      reconcile: (key, value) => {
        if (value === null) storage.removeItem(key); else storage.setItem(key, value);
        win.dispatchEvent(new win.Event('whale-storage-reconciled'));
      },
    });
    // The main process reads this contract while shutting down; it is the only
    // remaining renderer-to-main global the architecture allows.
    win.__whaleShutdown = { pendingStorage: storageSync.pending };
    const save = () => storageSync.save();
    // A hidden companion has no editable surfaces. Keep the last snapshot rather
    // than repeatedly serializing storage while Codex is minimized.
    if (scope) scope.interval(() => { if (!doc.hidden) save(); }, 800);
    else setInterval(() => { if (!doc.hidden) save(); }, 800);
    listen(doc, 'visibilitychange', save);
    listen(win, 'beforeunload', save);
    request();
    return { storageSync };
  }
  return { initialize };
}
