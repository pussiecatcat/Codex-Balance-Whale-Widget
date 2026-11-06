import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawnSync } from 'node:child_process';
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

test('no runtime or installer file repeats the release version as a literal', () => {
  const literal = new RegExp('\\b' + VERSION.replace(/\./g, '\\.') + '\\b');
  for (const file of ['scripts/install-package.ps1', 'scripts/build-release.py',
    'runtime/providers.mjs', 'runtime/codex-rate-limits.mjs']) {
    const text = fs.readFileSync(path.join(ROOT, file), 'utf8');
    assert.equal(literal.test(text), false, file + ' must read the version from the manifest');
  }
});

test('candidate builds generate a package-only identity and releases retain the source version', t => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'whale-build-version-'));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const before = fs.readFileSync(path.join(ROOT, '.codex-plugin/plugin.json'), 'utf8');
  const base = readJson('.codex-plugin/plugin.json').version;
  function build(folder, extra = []) {
    const output = path.join(directory, folder);
    const result = spawnSync('python', ['scripts/build-release.py', '--output', output, ...extra], { cwd: ROOT, encoding: 'utf8', timeout: 60000 });
    assert.equal(result.status, 0, result.stderr || result.stdout);
    return JSON.parse(fs.readFileSync(path.join(output, 'release-manifest.json'), 'utf8'));
  }
  const candidate = build('candidate');
  assert.match(candidate.internalVersion, /^\d+\.\d+\.\d+\+codex\.\d{8}-[A-Za-z0-9.-]+\.[a-f0-9]{12}$/);
  assert.equal(candidate.sourceVersion, base);
  assert.equal(candidate.status, 'local-test-candidate-awaiting-user-acceptance');
  const released = build('release', ['--release-tag', 'v' + VERSION]);
  assert.equal(released.internalVersion, base);
  assert.equal(released.status, 'release-build');
  assert.equal(fs.readFileSync(path.join(ROOT, '.codex-plugin/plugin.json'), 'utf8'), before, 'building must not edit the tracked manifest');
});
