// The original press: squash, then spring back with a small overshoot, no
// sideways motion. `balanced` is the original's 220 ms spring and 0.88 squash.
export const GESTURE_PRESETS = Object.freeze({
  crisp: { press: 65, release: 125, squash: .90 },
  soft: { press: 85, release: 155, squash: .86 },
  balanced: { press: 220, release: 220, squash: .88 },
});
const SPRING = 'cubic-bezier(.34,1.56,.64,1)';
const TAP_MS = 32;
const pressedAt = new WeakMap();
const now = () => globalThis.performance?.now?.() ?? Date.now();

export function applyGesture(body, down, name = 'balanced') {
  const preset = GESTURE_PRESETS[name] || GESTURE_PRESETS.balanced;
  const squash = `scaleY(${preset.squash}) scaleX(1.05)`;
  if (down) {
    pressedAt.set(body, now());
    body.style.transition = `transform ${preset.press}ms ${SPRING}`;
    body.style.transform = squash;
    return;
  }
  if (now() - (pressedAt.get(body) ?? -Infinity) < TAP_MS) {
    body.style.transition = 'none';
    body.style.transform = squash;
    void body.offsetWidth;
  }
  body.style.transition = `transform ${preset.release}ms ${SPRING}`;
  body.style.transform = 'scaleY(1) scaleX(1)';
}
