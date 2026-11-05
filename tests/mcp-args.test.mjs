import test from 'node:test';
import assert from 'node:assert/strict';
import { desktopModeArg } from '../runtime/mcp-args.mjs';

test('whale_open maps desktop:false to follow-codex and an omitted flag to no change', () => {
  assert.deepEqual(desktopModeArg({}), {}, 'omitted desktop must not change the mode');
  assert.deepEqual(desktopModeArg(undefined), {});
  assert.deepEqual(desktopModeArg({ desktop: true }), { mode: 'standalone' });
  assert.deepEqual(desktopModeArg({ desktop: false }), { mode: 'follow-codex' });
  assert.deepEqual(desktopModeArg({ desktop: 'no' }), {}, 'non-boolean values must not guess a mode');
});
