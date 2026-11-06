(() => {
  'use strict';
  // The original press: squash, then spring back with a small overshoot, no sideways
  // motion. `balanced` is the original's 220 ms spring and 0.88 squash.
  const presets = Object.freeze({ crisp: { press: 65, release: 125, squash: .90 }, soft: { press: 85, release: 155, squash: .86 }, balanced: { press: 220, release: 220, squash: .88 } });
  const SPRING = 'cubic-bezier(.34,1.56,.64,1)';
  // A tap released within this many milliseconds still shows the squash before rebounding.
  const TAP_MS = 32;
  const pressedAt = new WeakMap();
  const now = () => globalThis.performance?.now?.() ?? Date.now();
  function apply(body, down, name = 'balanced') {
    const p = presets[name] || presets.balanced;
    const squash = `scaleY(${p.squash}) scaleX(1.05)`;
    if (down) {
      pressedAt.set(body, now());
      body.style.transition = `transform ${p.press}ms ${SPRING}`;
      body.style.transform = squash;
      return;
    }
    if (now() - (pressedAt.get(body) ?? -Infinity) < TAP_MS) {
      body.style.transition = 'none';
      body.style.transform = squash;
      void body.offsetWidth;
    }
    body.style.transition = `transform ${p.release}ms ${SPRING}`;
    body.style.transform = 'scaleY(1) scaleX(1)';
  }
  window.WhaleGesture = Object.freeze({ presets, apply });
})();
