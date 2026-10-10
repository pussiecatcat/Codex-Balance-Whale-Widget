import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const { normalizeHostState, parseInitialHostState } = createRequire(import.meta.url)('../desktop/host-state.cjs');

test('host adapter preserves native Windows following and bounds while rejecting invalid packets', () => {
  assert.equal(normalizeHostState({ hostAlive: 'true' }, { platform: 'win32' }), null);
  const state = normalizeHostState({ hostAlive: true, hostPid: 42, window: '123', visible: true,
    attached: true, nativeFollowing: true, visibilityRevision: 7,
    serial: 3, mode: 'follow-codex', hostSession: 'session', monitorExit: false,
    bounds: { x: 3, y: 4, width: 800, height: 600 }, visualDiagnostics: { aboveHost: true }, secret: 'drop-me' }, { platform: 'win32' });
  assert.equal(state.nativeFollowing, true);
  assert.equal(state.visibilityRevision, 7);
  assert.deepEqual(state.bounds, { x: 3, y: 4, width: 800, height: 600 });
  assert.deepEqual(state.visualDiagnostics, { aboveHost: true });
  assert.equal(state.serial, 3);
  assert.equal(state.mode, 'follow-codex');
  assert.equal('secret' in state, false);
});

test('host adapter keeps macOS polling semantics and treats malformed geometry as unavailable', () => {
  const state = normalizeHostState({ hostAlive: true, visible: true, attached: true,
    nativeFollowing: true, bounds: { x: 0, y: 0, width: -1, height: 500 } }, { platform: 'darwin' });
  assert.equal(state.nativeFollowing, false);
  assert.equal(state.followMode, 'macos-cgwindow-poll');
  assert.equal(state.attached, true);
  assert.equal(state.bounds, null);
  assert.equal(state.modal, false);
});

test('initial host packets use the same strict adapter before window geometry is chosen', () => {
  const state = parseInitialHostState(JSON.stringify({ hostAlive: true, visible: true,
    bounds: { x: 4, y: 5, width: 900, height: 700 }, extra: { credential: 'never-forward' } }), { platform: 'win32' });
  assert.deepEqual(state.bounds, { x: 4, y: 5, width: 900, height: 700 });
  assert.equal('extra' in state, false);
  assert.equal(parseInitialHostState('{bad json', { platform: 'win32' }), null);
});
