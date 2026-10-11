import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { VERSION, ROOT } from '../runtime/paths.mjs';

// runtime/paths.mjs used to carry its own `VERSION` literal next to the one in
// package.json and the one in the release manifest, so a release could be built
// with a plugin.json the runtime disagreed with. The runtime now derives its
// version from the manifest; this keeps package.json honest about it too.
const readJson = file => JSON.parse(fs.readFileSync(path.join(ROOT, file), 'utf8').replace(/^\uFEFF/, ''));

test('the shipped version has one source and the other copies agree with it', () => {
  const manifest = String(readJson('.codex-plugin/plugin.json').version || '');
  assert.match(manifest, /^\d+\.\d+\.\d+/, 'the release manifest must carry a semver base version');
  assert.equal(VERSION, manifest.split('+')[0], 'runtime VERSION must be the manifest base version');
  assert.equal(readJson('package.json').version, VERSION, 'package.json must not drift from the manifest base version');
});
