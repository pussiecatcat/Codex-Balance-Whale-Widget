import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const { normalizeHostState } = createRequire(import.meta.url)('../desktop/host-state.cjs');

test('host adapter preserves native Windows following and bounds while rejecting invalid packets', () => {
  assert.equal(normalizeHostState({ hostAlive: 'true' }, { platform: 'win32' }), null);
  const state = normalizeHostState({ hostAlive: true, hostPid: 42, window: '123', visible: true,
    attached: true, nativeFollowing: true, visibilityRevision: 7,
    bounds: { x: 3, y: 4, width: 800, height: 600 }, visualDiagnostics: { aboveHost: true } }, { platform: 'win32' });
  assert.equal(state.nativeFollowing, true);
  assert.equal(state.visibilityRevision, 7);
  assert.deepEqual(state.bounds, { x: 3, y: 4, width: 800, height: 600 });
  assert.deepEqual(state.visualDiagnostics, { aboveHost: true });
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
