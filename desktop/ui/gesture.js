(() => {
  'use strict';
  const presets = Object.freeze({ crisp: { press: 65, release: 125, squash: .90 }, soft: { press: 85, release: 155, squash: .86 }, balanced: { press: 75, release: 140, squash: .88 } });
  // Each press leans the opposite way, so repeated presses read as kneading.
  const motion = new WeakMap();
  function apply(body, down, name = 'balanced') {
    const p = presets[name] || presets.balanced;
    const state = motion.get(body) || { side: 1, settle: null };
    motion.set(body, state);
    const calm = !body.animate || globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (down) {
      state.settle?.cancel();
      state.side = -state.side;
    }
    body.style.transition = `transform ${down ? p.press : p.release}ms cubic-bezier(.2,.8,.3,1.15)`;
    const lean = down && !calm ? `rotate(${state.side * 3}deg) ` : '';
    body.style.transform = down ? `${lean}scaleY(${p.squash}) scaleX(1.05)` : 'scaleY(1) scaleX(1)';
    if (down || calm) return;
    const s = state.side;
    state.settle = body.animate([
      { transform: `rotate(${s * 3}deg) scaleY(${p.squash}) scaleX(1.05)` },
      { transform: `rotate(${-s * 2}deg) scaleY(1.03) scaleX(.985)` },
      { transform: `rotate(${s}deg) scaleY(.99) scaleX(1.01)` },
      { transform: 'rotate(0deg) scaleY(1) scaleX(1)' },
    ], { duration: 380, easing: 'ease-out' });
  }
  window.WhaleGesture = Object.freeze({ presets, apply });
})();
