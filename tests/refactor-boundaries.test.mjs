import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  SOUND_FRONTEND_MODULES,
  SOUND_RUNTIME_MODULES,
  EMPTY_CATCH_BUDGET,
  CSS_HEX_BUDGET,
  GLOBAL_SURFACE,
  lifecycleMetrics,
  MODULE_GLOBAL_READS,
  assertRefactorBoundaries,
  collectDependencyMetrics,
  collectRefactorMetrics,
  dependencyErrors,
  refactorBoundaryErrors,
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
  assert.deepEqual(metrics.publishedGlobals, [...GLOBAL_SURFACE].sort(), 'remove retired globals from the frozen surface');
  assert.deepEqual(metrics.moduleReads, MODULE_GLOBAL_READS, 'lower each frozen module count after migrating a global read');
  assert.equal(metrics.staleReads.length, 0, 'every frozen read is still present; a stale one means the baseline should be lowered');
  assert.equal(metrics.crossFeatureImports.length, 0);
  assert.equal(metrics.globalStorage.length, 0);
  assert.equal(metrics.directRequests.length, 2, 'the two role-manager fetches the next migration round removes');
});

test('an extracted module reaching for a leftover global is refused, and so is a wider read of a frozen one', t => {
  const fresh = fixture(t, {
    'desktop/ui/features/widget/fresh.js': 'export const label = () => window.WhaleWorkshopOpen?.call(null);\n',
  });
  assert.match(evaluate(fresh).join('\n'), /fresh\.js reaches for window\.WhaleWorkshopOpen/);

  const wider = fixture(t, {
    'desktop/ui/features/widget/feedback.js': 'const a = window.whaleToast;\nconst b = window.whaleToast;\n',
  });
  assert.match(evaluate(wider).join('\n'), /feedback\.js reads window\.whaleToast 2 times, above the frozen 1/);
});

test('a module that stopped reading a global lowers the baseline instead of failing the gate', t => {
  const quiet = fixture(t, {
    'desktop/ui/features/widget/feedback.js': 'export const mode = view => view.mode;\n',
  });
  const metrics = collectDependencyMetrics({ root: quiet });
  assert.deepEqual(dependencyErrors(metrics), [], 'migrating the last read is not a violation');
  assert.ok(metrics.staleReads.some(item => item.file.endsWith('feedback.js') && item.global === 'whaleToast'),
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
    'desktop/ui/thing.js': 'window.WhaleWorkshopOpen = window.WhaleWorkshopOpen || {};\n',
  });
  assert.deepEqual(evaluate(known), [], 'republishing a name already on the surface is not a new edge');
});

// The per-module rule above only reaches files that are already a module of their
// own. The monolith and the classic scripts beside widget.html are still single
// files, so they are held to one ceiling instead — without it the largest
// concentration of direct calls in the project would be the one nothing counts.
test('the renderer that has not been split yet is held to a single fetch ceiling', t => {
  const metrics = collectDependencyMetrics({ root: ROOT });
  assert.equal(metrics.legacyDirectRequests.length, 0,
    'every renderer request goes through the shared client');
  assert.equal(metrics.directRequests.length + metrics.legacyDirectRequests.length, 2,
    'the only direct calls left are the two inside the shared module rule for role-manager');
  assert.ok(!metrics.legacyDirectRequests.some(item => item.file.endsWith('alpha-worker.js')),
    'a worker has no module graph to import the shared client from');

  const loud = fixture(t, {
    'desktop/ui/loud.js': Array.from({ length: 30 }, (_, n) => `fetch('/x${n}')`).join(';\n') + ';\n',
  });
  assert.match(evaluate(loud).join('\n'), /must not exceed the existing budget of 0/);
  assert.match(evaluate(loud).join('\n'), /loud\.js:30/, 'the report names which file to convert first');
});

test('the empty-catch ratchet counts this tree and rejects a new site', () => {
  const metrics = collectRefactorMetrics({ root: ROOT });
  assert.equal(metrics.emptyCatch.total, EMPTY_CATCH_BUDGET.total,
    'clean a site and lower EMPTY_CATCH_BUDGET rather than leaving slack');
  assert.ok(metrics.emptyCatch.total > 0);
  const over = { ...metrics, emptyCatch: { total: EMPTY_CATCH_BUDGET.total + 1, byFile: { 'runtime/loud.mjs': 1 }, rows: [] } };
  const errors = refactorBoundaryErrors(over);
  assert.match(errors.join('\n'), /Empty catch blocks must not exceed/);
  assert.match(errors.join('\n'), /runtime\/loud\.mjs:1/, 'the report names which file to clean first');
});

test('the CSS palette ratchet counts this tree and rejects a new color token', () => {
  const metrics = collectRefactorMetrics({ root: ROOT });
  assert.ok(metrics.cssHex.total <= CSS_HEX_BUDGET.total,
    'reuse a design token and lower CSS_HEX_BUDGET after consolidating colors');
  const over = { ...metrics, cssHex: { total: CSS_HEX_BUDGET.total + 1, values: [] } };
  assert.match(refactorBoundaryErrors(over).join('\n'), /CSS color tokens must not exceed/);
});

test('the gate sees bare identifier reads and host publications', t => {
  const bare = fixture(t, {
    'desktop/ui/features/widget/bare.js': 'export const text = () => WhaleWorkshopOpen?.call(null);\n',
  });
  assert.match(evaluate(bare).join('\n'), /bare\.js reaches for .*WhaleWorkshopOpen/);

  const host = fixture(t, {
    'desktop/ui/new-global.js': "(function (host) { host.WhaleNewSurface = {}; })(window);\n",
  });
  assert.match(evaluate(host).join('\n'), /new: WhaleNewSurface/);
});

test('absolute import specifiers cannot hide a cross-feature dependency', t => {
  const crossed = fixture(t, {
    'desktop/ui/features/widget/a.js': "import { helper } from '/features/usage/helpers.js';\nexport const a = helper;\n",
    'desktop/ui/features/usage/helpers.js': 'export const helper = () => 1;\n',
  });
  assert.match(evaluate(crossed).join('\n'), /one feature does not import another/);
});

test('a name in a comment or a string is not a dependency read', t => {
  const quiet = fixture(t, {
    'desktop/ui/features/widget/quiet.js': "// WhaleQuota and WhaleApiModels are mentioned here\nexport const text = 'WhaleApiModels';\n",
  });
  assert.deepEqual(evaluate(quiet), []);
});

test('the lifecycle gate counts unowned timers, listeners and inline style writes', t => {
  const root = fixture(t, {
    'desktop/ui/features/widget/owned.js': [
      'export function wire(scope, document, element) {',
      "  scope.interval(() => {}, 1000);",
      "  scope.on(document, 'click', () => {});",
      "  setInterval(() => {}, 500);",
      "  document.addEventListener('keydown', () => {});",
      "  element.style.color = 'red';",
      "  // setInterval(() => {}) and document.addEventListener() in a comment do not count",
      "  const text = 'setInterval(';",
      '  return text;',
      '}',
    ].join('\n'),
  });
  const metrics = lifecycleMetrics(root);
  assert.equal(metrics.intervals, 1);
  assert.equal(metrics.documentListeners, 1);
  assert.equal(metrics.inlineStyles, 1);
});

test('shared stays pure and the server layers do not reach back into features', t => {
  const impure = fixture(t, {
    'desktop/ui/shared/bad.js': "export const el = () => document.createElement('div');\n",
  });
  assert.match(evaluate(impure).join('\n'), /desktop\/ui\/shared must stay pure/);

  const reverse = fixture(t, {
    'lib/bad.mjs': "import { x } from '../desktop/ui/features/widget/x.js';\nexport const y = x;\n",
  });
  assert.match(evaluate(reverse).join('\n'), /may only import desktop\/ui\/shared/);

  const allowed = fixture(t, {
    'lib/good.mjs': "import { x } from '../desktop/ui/shared/x.js';\nexport const y = x;\n",
  });
  assert.deepEqual(evaluate(allowed), []);
});
