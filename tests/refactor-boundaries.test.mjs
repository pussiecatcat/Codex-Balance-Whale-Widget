import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  SOUND_FRONTEND_MODULES,
  SOUND_RUNTIME_MODULES,
  assertRefactorBoundaries,
  collectRefactorMetrics,
} from '../scripts/refactor-metrics.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

test('sound refactor has one explicit boundary and no renderer backchannels', () => {
  const metrics = assertRefactorBoundaries(collectRefactorMetrics({ root: ROOT }));
  assert.equal(metrics.sound.forbidden.domTextQueries.length, 0);
  assert.equal(metrics.sound.forbidden.simulatedClicks.length, 0);
  assert.equal(metrics.sound.forbidden.mutationObservers.length, 0);
  assert.equal(metrics.sound.forbidden.directFetches.length, 0);
  assert.equal(metrics.sound.forbidden.legacyMultiWriteEndpoints.length, 0);
  assert.ok(metrics.sound.combinedEndpointReferences.length >= 1);
});

test('package scripts retain the default test contract and expose explicit verification entrypoints', () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
  assert.equal(manifest.scripts.test, 'node --test tests/*.test.mjs');
  for (const name of ['test:unit', 'test:desktop', 'check:package', 'check:architecture', 'verify']) {
    assert.equal(typeof manifest.scripts[name], 'string', `missing npm script: ${name}`);
    assert.ok(manifest.scripts[name].trim(), `empty npm script: ${name}`);
  }
});

test('package dependency check includes every new sound module', () => {
  const source = fs.readFileSync(path.join(ROOT, 'scripts', 'check-package.mjs'), 'utf8').replaceAll('\\', '/');
  for (const relative of [...SOUND_FRONTEND_MODULES, ...SOUND_RUNTIME_MODULES]) {
    assert.ok(source.includes('../' + relative), `package check omits ${relative}`);
  }
});
