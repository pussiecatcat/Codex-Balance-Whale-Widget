import { createInputHitTester, createRoleHitPreparer, pointerPressAccepted } from '/features/widget/input-policy.js';

(() => {
  'use strict';
  function initialize() {
  const bridge = window.whaleDesktop, rendering = window.WhaleRendering;
  if (!bridge || !rendering) return;
  const pet = document.querySelector('.dshwv-img'), root = document.querySelector('.dshwv-root');
  if (!pet || !root) return;
  let pointerEventAt=0;
  let point = { x: -1, y: -1 }, heldPointer = null, releaseEpoch = 0, interactive = false, keyboardFocus = false, lastStorage = '', externalDrag = false;
  const keyboardSurfaces = 'dialog[open],.dshwv-menu-open,.dshwv-rolelist,.dshwv-audiolist,[class*="mask"],.dshwv-qedit,.dshwv-usagepanel,.dshwv-custmenu,.dshwv-fx-info';
  const { hit } = createInputHitTester({ document, pet, root, rendering, getComputedStyle,
    viewport: () => ({ width: innerWidth, height: innerHeight }) });
  function update() {
    const next = heldPointer !== null || !externalDrag && hit(point);
    if (next !== interactive) { interactive = next; bridge.interactive(next); }
  }
  function updateKeyboardFocus() {
    // Menu fades start at opacity 0 and end without a DOM mutation. Use whether
    // the surface accepts input, so keyboard activation follows open/close now.
    const next = [...document.querySelectorAll(keyboardSurfaces)].some(el =>
      el.checkVisibility({ visibilityProperty: true }) && getComputedStyle(el).pointerEvents !== 'none');
    if (next !== keyboardFocus) { keyboardFocus = next; bridge.keyboardFocus(next); }
  }
  function track(e) { pointerEventAt=Date.now(); point = { x: e.clientX, y: e.clientY }; externalDrag = heldPointer === null && Number(e.buttons) > 0; update(); }
  // Real movement events are handled while interactive. Ignored Windows areas
  // use bridge.onCursor below and do not forward host mouse events to Chromium.
  document.addEventListener('mousemove', track, true);
  document.addEventListener('pointermove', track, true);
  document.addEventListener('pointerdown', e => {
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
    requestAnimationFrame(() => { if (epoch === releaseEpoch) { heldPointer = null; update(); } });
  }
  document.addEventListener('pointerup', release, true);
  document.addEventListener('pointercancel', release, true);
  document.addEventListener('lostpointercapture', release, true);
  window.addEventListener('blur', () => { ++releaseEpoch; heldPointer = null; point = { x: -1, y: -1 }; update(); });
  bridge.onCursor(p => {
    // Preserve the real pointer during a captured drag; native fallback only discovers hover.
    if (heldPointer === null) {
      if (typeof p.buttons === 'number' && (!p.sampledAt || p.sampledAt>=pointerEventAt)) externalDrag = p.buttons > 0;
      point = p; update();
      window.dispatchEvent(new CustomEvent('whale-hover', { detail: externalDrag ? {x:-1,y:-1} : p }));
    }
  });
  window.addEventListener('whale-mode-changing', () => { ++releaseEpoch; heldPointer=null; externalDrag=false; point={x:-1,y:-1}; update(); });
  rendering.onFrame(update);
  if(bridge.testMode)window.__whaleInputTest={hit};
  const request = () => { updateKeyboardFocus(); rendering.presentFor(); };
  new MutationObserver(request).observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['style', 'class', 'src', 'open', 'hidden', 'inert'] });
  document.addEventListener('transitionrun', e => {
    if (e.target.closest('.dshwv-root,.dshwv-position')) rendering.presentFor(600);
  }, true);
  window.addEventListener('resize', () => rendering.presentFor(220));
  const roleHit = createRoleHitPreparer({
    pet, rendering, bridge, window, CustomEvent, document, request,
    toast: message => window.whaleToast?.(message),
  });
  pet.addEventListener('load', roleHit.prepare);
  pet.addEventListener('error', roleHit.fallback);
  roleHit.prepare();
  function save() {
    const values = Object.fromEntries(Object.keys(localStorage).filter(k => /^dshw[-v]/.test(k)).map(k => [k, localStorage.getItem(k)]));
    const encoded = JSON.stringify(values);
    if (encoded !== lastStorage) { lastStorage = encoded; bridge.save(values); }
  }
  // A hidden companion has no editable surfaces. Keep the last snapshot rather
  // than repeatedly serializing localStorage while Codex is minimized.
  setInterval(() => { if (!document.hidden) save(); }, 800);
  document.addEventListener('visibilitychange', save);
  window.addEventListener('beforeunload', save);
  request();
  }
  if (document.querySelector('.dshwv-img')) initialize();
  else window.addEventListener('whale-widget-ready', initialize, { once: true });
})();
