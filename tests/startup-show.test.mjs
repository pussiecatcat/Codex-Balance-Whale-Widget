import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const { createRendererLifecycle } = createRequire(import.meta.url)('../desktop/renderer-lifecycle.cjs');

function fixture(overrides = {}) {
  const s = {
    manuallyHidden: true, loading: true, quitting: false, reloads: 0, shows: 0,
    state: { ready: false, readyTimer: 1, recoveryTimer: null, attempts: 0 },
    pending: undefined,
    window: { isDestroyed: () => false, webContents: { isLoading: () => s.loading, reload() { s.reloads++; } } },
  };
  s.lifecycle = createRendererLifecycle({
    getWindow: () => s.window, getQuitting: () => s.quitting, state: s.state,
    visibilityController: { requestRecovery() { s.shows++; } },
    diagnose() {}, hideManuallyOff: () => { s.manuallyHidden = false; },
    setTimeout(fn) { s.pending = fn; return 2; },
    ...overrides,
  });
  return s;
}

test('repeated show during startup never schedules a page reload', () => {
  const s = fixture(); for (let i = 0; i < 20; i++) s.lifecycle.show();
  assert.equal(s.state.attempts, 0); assert.equal(s.pending, undefined); assert.equal(s.manuallyHidden, false);
});
test('a pending recovery cannot reload a page that became ready', () => {
  const s = fixture({}); s.state.readyTimer = null; s.loading = false; s.lifecycle.show();
  assert.equal(s.state.attempts, 1); s.state.ready = true; s.pending(); assert.equal(s.reloads, 0);
});
test('a genuinely unready idle renderer still permits one bounded manual recovery', () => {
  const s = fixture({}); s.state.readyTimer = null; s.loading = false; s.lifecycle.show(); s.lifecycle.show();
  assert.equal(s.state.attempts, 1); s.pending(); assert.equal(s.reloads, 1);
});
