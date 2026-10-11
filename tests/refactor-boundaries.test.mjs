import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  SOUND_FRONTEND_MODULES,
  SOUND_RUNTIME_MODULES,
  assertRefactorBoundaries,
  collectDependencyMetrics,
  collectRefactorMetrics,
  dependencyErrors,
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

// A throwaway tree holding only the module files a case needs, so each check can
// be shown to bite without editing real source.
function fixture(t, files) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'whale-deps-'));
  for (const [relative, source] of Object.entries(files)) {
    const absolute = path.join(root, relative);
    fs.mkdirSync(path.dirname(absolute), { recursive: true });
    fs.writeFileSync(absolute, source);
  }
  t.after(() => {
    const resolved = path.resolve(root);
    assert.ok(resolved.startsWith(path.resolve(os.tmpdir()) + path.sep) && path.basename(resolved).startsWith('whale-deps-'));
    fs.rmSync(resolved, { recursive: true, force: true });
  });
  return root;
}

const evaluate = root => dependencyErrors(collectDependencyMetrics({ root }));

test('the dependency gate is clean on the tree as it stands, and its numbers are the frozen ones', () => {
  const metrics = collectDependencyMetrics({ root: ROOT });
  assert.deepEqual(dependencyErrors(metrics), []);
  assert.equal(metrics.publishedGlobals.length, 11, 'the window global surface is frozen at eleven names');
  assert.equal(Object.keys(metrics.moduleReads).length, 8, 'eight modules still reach for a global');
  assert.equal(Object.values(metrics.moduleReads).reduce((sum, reads) => sum + Object.values(reads).reduce((a, b) => a + b, 0), 0), 26);
  assert.equal(metrics.staleReads.length, 0, 'every frozen read is still present; a stale one means the baseline should be lowered');
  assert.equal(metrics.crossFeatureImports.length, 0);
  assert.equal(metrics.globalStorage.length, 0);
  assert.equal(metrics.directRequests.length, 2, 'the two role-manager fetches the next migration round removes');
});

test('an extracted module reaching for a leftover global is refused, and so is a wider read of a frozen one', t => {
  const fresh = fixture(t, {
    'desktop/ui/features/widget/fresh.js': 'export const label = () => window.WhaleQuota?.text();\n',
  });
  assert.match(evaluate(fresh).join('\n'), /fresh\.js reaches for window\.WhaleQuota/);

  const wider = fixture(t, {
    'desktop/ui/features/widget/usage-alerts.js': 'const a = window.WhaleAccountView?.mode;\nconst b = window.WhaleAccountView?.mode;\n',
  });
  assert.match(evaluate(wider).join('\n'), /usage-alerts\.js reads window\.WhaleAccountView 2 times, above the frozen 1/);
});

test('a module that stopped reading a global lowers the baseline instead of failing the gate', t => {
  const quiet = fixture(t, {
    'desktop/ui/features/widget/usage-alerts.js': 'export const mode = view => view.mode;\n',
  });
  const metrics = collectDependencyMetrics({ root: quiet });
  assert.deepEqual(dependencyErrors(metrics), [], 'migrating the last read is not a violation');
  assert.ok(metrics.staleReads.some(item => item.file.endsWith('usage-alerts.js') && item.global === 'WhaleAccountView'),
    'and the now-stale baseline entry is reported so it can be taken out');
});

test('one feature importing another is refused while the shared services direction stays open', t => {
  const crossed = fixture(t, {
    'desktop/ui/features/widget/a.js': "import { helper } from '../usage/helpers.js';\nexport const a = helper;\n",
    'desktop/ui/features/usage/helpers.js': 'export const helper = () => 1;\n',
  });
  assert.match(evaluate(crossed).join('\n'), /widget\/a\.js:1 imports .*features\/usage\/helpers\.js/);
  assert.match(evaluate(crossed).join('\n'), /one feature does not import another/);

  const shared = fixture(t, {
    'desktop/ui/features/widget/a.js': "import { requestJson } from '../../services/request.js';\nexport const a = requestJson;\n",
  });
  assert.deepEqual(evaluate(shared), []);
});

test('a module may only reach the network through the shared client, and only that one file may', t => {
  const direct = fixture(t, {
    'desktop/ui/features/widget/newthing.js': "export const go = () => fetch('/api/status');\n",
  });
  assert.match(evaluate(direct).join('\n'), /newthing\.js calls fetch directly/);

  const second = fixture(t, {
    'desktop/ui/services/other.js': "export const go = () => window.fetch('/api/status');\n",
  });
  assert.match(evaluate(second).join('\n'), /services\/other\.js calls fetch directly/);

  const shared = fixture(t, {
    'desktop/ui/services/request.js': "export const go = () => fetch('/api/status');\n",
  });
  assert.deepEqual(evaluate(shared), [], 'the shared client is the one place allowed to fetch');
});

test('the localStorage global is refused while the injected one stays the supported form', t => {
  const global = fixture(t, {
    'desktop/ui/features/widget/stored.js': "export const save = () => window.localStorage.setItem('k', 'v');\n",
  });
  assert.match(evaluate(global).join('\n'), /stored\.js:1 uses the localStorage global/);

  const injected = fixture(t, {
    'desktop/ui/features/widget/stored.js': 'export const create = ({ localStorage }) => localStorage.setItem("k", "v");\n',
  });
  assert.deepEqual(evaluate(injected), [], 'handed-in storage is the design, not a violation');
});

test('the preload bridge is allowed by name, a new window global is not', t => {
  const bridge = fixture(t, {
    'desktop/ui/features/widget/link.js': 'export const open = url => window.whaleDesktop && window.whaleDesktop.openExternal(url);\n',
  });
  assert.deepEqual(evaluate(bridge), [], 'the preload contract is deliberate');

  const published = fixture(t, {
    'desktop/ui/thing.js': 'window.WhaleNewThing = {};\n',
  });
  assert.match(evaluate(published).join('\n'), /never adds one/);
  assert.match(evaluate(published).join('\n'), /WhaleNewThing/);

  const known = fixture(t, {
    'desktop/ui/thing.js': 'window.WhaleGesture = window.WhaleGesture || {};\n',
  });
  assert.deepEqual(evaluate(known), [], 'republishing a name already on the surface is not a new edge');
});
