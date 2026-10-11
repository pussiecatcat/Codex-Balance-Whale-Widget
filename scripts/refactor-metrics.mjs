import fs from 'node:fs';
import { dependencySyntax } from './dependency-syntax.mjs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export const SOUND_FRONTEND_MODULES = Object.freeze([
  'desktop/ui/services/request.js',
  'desktop/ui/services/sound-reference.js',
  'desktop/ui/features/sound-settings/model.js',
  'desktop/ui/features/sound-settings/controller.js',
  'desktop/ui/features/sound-settings/view.js',
]);

export const SOUND_RUNTIME_MODULES = Object.freeze([
  'runtime/size-settings.mjs',
  'runtime/sound-settings.mjs',
]);

const SOUND_BOUNDARY_FILES = Object.freeze([
  'desktop/ui/sound-settings.js',
  'desktop/ui/wait-notice.js',
  'desktop/ui/services/sound-reference.js',
  'desktop/ui/features/sound-settings/model.js',
  'desktop/ui/features/sound-settings/controller.js',
  'desktop/ui/features/sound-settings/view.js',
]);

// The application globals the widget still publishes on `window`. This list is
// a ceiling, not a contract: migrating a feature means its name leaves the list.
// A name appearing that is not here is a new compatibility surface, which is
// exactly what the dependency gate exists to stop.
export const GLOBAL_SURFACE = Object.freeze([
  'WhaleAccountView',
  'WhaleApiModels',
  'WhaleAudio',
  'WhaleFeedback',
  'WhaleFeedbackSources',
  'WhaleGesture',
  'WhaleLegacySoundUi',
  'WhaleLegacyUsage',
  'WhaleQuota',
  'WhaleRendering',
  'WhaleSelect',
]);

// Reads of those globals from modules that have already been extracted, with the
// count each one had when this gate was written. Dependency injection is the
// replacement, so these numbers only go down; an entry whose module stopped
// reading the global is reported as stale rather than failing, the way the line
// caps above work.
export const MODULE_GLOBAL_READS = Object.freeze({
  'desktop/ui/features/sound-settings/controller.js': { WhaleRendering: 1, WhaleSelect: 1 },
  'desktop/ui/features/bubble/bubble-content.js': { WhaleApiModels: 1, WhaleQuota: 1 },
  'desktop/ui/features/bubble/bubble-quick-editors.js': { WhaleApiModels: 2 },
  'desktop/ui/features/bubble/bubble-rows-view.js': { WhaleApiModels: 2, WhaleQuota: 2 },
  'desktop/ui/features/audio/task-end-sound.js': { WhaleFeedback: 4, WhaleFeedbackSources: 2 },
  'desktop/ui/features/usage/turn-notice-poller.js': { WhaleAccountView: 2, WhaleFeedback: 2, WhaleQuota: 1 },
  'desktop/ui/features/usage/usage-alerts.js': { WhaleAccountView: 1 },
  'desktop/ui/features/usage/usage-models-view.js': { WhaleApiModels: 4 },
});

export const MODULE_DIRECT_REQUESTS = Object.freeze({});

// The preload bridge is a deliberate platform contract rather than a leftover
// application global, so reaching for it by name stays allowed.
const ALLOWED_GLOBAL = 'whaleDesktop';
const MODULE_ROOTS = Object.freeze(['desktop/ui/features', 'desktop/ui/services', 'desktop/ui/components']);
const SHARED_REQUEST_CLIENT = 'desktop/ui/services/request.js';
const PUBLISH_ROOTS = Object.freeze(['desktop/ui', 'assets/whale-widget.js']);

// The shared request helper landed with the sound-settings work and enforces a
// timeout, abort propagation and one error shape. Everywhere else the renderer
// still calls fetch() itself, so those three things differ per call site. The
// sound boundary already forbids direct fetches; applying that to the whole
// renderer at once would change error handling across a dozen features in one
// step, so this holds the current count instead and stops it growing.
//
// Converting a call site to requestJson is the way to lower this number. Lower
// the budget with it — the point is that it only ever moves down. Extracted
// feature modules have a stricter syntax-based zero-network-call boundary.
export const RENDERER_DIRECT_FETCH_BUDGET = { total: 21 };

// Renderer sources that must not call fetch() directly. services/request.js is
// the helper itself, and alpha-worker.js runs off the module graph in a Worker,
// where the helper is not reachable.
const RENDERER_EXEMPT = new Set(['desktop/ui/services/request.js', 'desktop/ui/alpha-worker.js']);

function rendererSources(root) {
  const files = ['assets/whale-widget.js'];
  const walk = relative => {
    const absolute = path.join(root, relative);
    if (!fs.existsSync(absolute)) return;
    for (const entry of fs.readdirSync(absolute, { withFileTypes: true })) {
      const child = relative + '/' + entry.name;
      if (entry.isDirectory()) walk(child);
      else if (entry.name.endsWith('.js')) files.push(child);
    }
  };
  walk('desktop/ui');
  return files.filter(file => !RENDERER_EXEMPT.has(file));
}

function read(root, relative) {
  return fs.readFileSync(path.join(root, relative), 'utf8');
}

function lineOf(source, index) {
  return source.slice(0, index).split(/\r?\n/).length;
}

function listJavaScript(root, relative) {
  const absolute = path.join(root, relative);
  if (!fs.existsSync(absolute)) return [];
  if (fs.statSync(absolute).isFile()) return [relative.split(path.sep).join('/')];
  const found = [];
  const walk = directory => {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const child = path.join(directory, entry.name);
      if (entry.isDirectory()) walk(child);
      else if (entry.name.endsWith('.js')) found.push(path.relative(root, child).split(path.sep).join('/'));
    }
  };
  walk(absolute);
  return found.sort();
}

function countByFile(found) {
  const counts = {};
  for (const item of found) counts[item.file] = (counts[item.file] || 0) + 1;
  return counts;
}

function lineCount(source) {
  return source ? source.split(/\r?\n/).length : 0;
}

function findings(relative, source, rule, patterns) {
  const found = [];
  for (const pattern of patterns) {
    pattern.lastIndex = 0;
    for (const match of source.matchAll(pattern)) {
      const line = source.slice(0, match.index).split(/\r?\n/).length;
      const key = relative + ':' + line + ':' + rule;
      if (!found.some(item => item.key === key)) {
        found.push({ key, file: relative, line, rule, sample: match[0].replace(/\s+/g, ' ').slice(0, 140) });
      }
    }
  }
  return found;
}

function scanFiles(root, relatives, rule, patterns) {
  return relatives.flatMap(relative => {
    const absolute = path.join(root, relative);
    return fs.existsSync(absolute) ? findings(relative, fs.readFileSync(absolute, 'utf8'), rule, patterns) : [];
  });
}

function sourceSliceTests(root) {
  const directory = path.join(root, 'tests');
  if (!fs.existsSync(directory)) return [];
  return fs.readdirSync(directory)
    .filter(name => name.endsWith('.test.mjs'))
    .filter(name => /source\.slice\s*\(/.test(fs.readFileSync(path.join(directory, name), 'utf8')))
    .map(name => 'tests/' + name)
    .sort();
}

function moduleScript(html, source) {
  return (html.match(/<script\b[^>]*>/g) || []).some(tag =>
    new RegExp(`\\bsrc=["']/${source.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}["']`).test(tag)
      && /\btype=["']module["']/.test(tag));
}

export function collectDependencyMetrics({ root = ROOT } = {}) {
  const modules = [...new Set(MODULE_ROOTS.flatMap(directory => listJavaScript(root, directory)))].sort();
  const moduleReads = {};
  const crossFeatureImports = [];
  const directRequests = [];
  const globalStorage = [];
  for (const relative of modules) {
    const source = read(root, relative);
    const syntax = dependencySyntax(source);
    const reads = syntax.globals;
    if (Object.keys(reads).length) moduleReads[relative] = reads;
    {
      const owner = relative.startsWith('desktop/ui/features/') ? relative.slice('desktop/ui/features/'.length).split('/')[0] : null;
      for (const { spec, index } of syntax.imports) {
        if (!spec.startsWith('.') && !spec.startsWith('/')) continue;
        const target = spec.startsWith('/') ? 'desktop/ui' + spec : path.posix.normalize(path.posix.join(path.posix.dirname(relative), spec));
        if (!target.startsWith('desktop/ui/features/')) continue;
        if (target.slice('desktop/ui/features/'.length).split('/')[0] !== owner) {
          crossFeatureImports.push({ file: relative, line: lineOf(source, index), target });
        }
      }
    }
    if (relative !== SHARED_REQUEST_CLIENT) directRequests.push(...syntax.requests.map(item => ({ file: relative, ...item })));
    globalStorage.push(...syntax.storage.map(item => ({ file: relative, ...item })));
  }
  const publishedGlobals = [];
  for (const relative of PUBLISH_ROOTS.flatMap(entry => listJavaScript(root, entry))) {
    for (const name of dependencySyntax(read(root, relative)).published) {
      if (!publishedGlobals.includes(name)) publishedGlobals.push(name);
    }
  }
  publishedGlobals.sort();
  const staleReads = [];
  for (const [relative, frozen] of Object.entries(MODULE_GLOBAL_READS)) {
    for (const [name, count] of Object.entries(frozen)) {
      const actual = (moduleReads[relative] || {})[name] || 0;
      if (actual < count) staleReads.push({ file: relative, global: name, frozen: count, actual });
    }
  }
  return {
    modules,
    publishedGlobals,
    moduleReads,
    staleReads,
    crossFeatureImports,
    directRequests,
    directRequestsByFile: countByFile(directRequests),
    globalStorage,
  };
}

export function dependencyErrors(dependency) {
  const errors = [];
  const newGlobals = dependency.publishedGlobals.filter(name => !GLOBAL_SURFACE.includes(name));
  if (newGlobals.length) errors.push('Migrating a feature removes window globals, it never adds one; new: ' + newGlobals.join(', '));
  for (const [relative, reads] of Object.entries(dependency.moduleReads)) {
    const frozen = MODULE_GLOBAL_READS[relative] || {};
    for (const [name, count] of Object.entries(reads)) {
      if (!(name in frozen)) errors.push(`${relative} reaches for window.${name}; an extracted module takes its dependencies injected (only window.${ALLOWED_GLOBAL} is allowed by name).`);
      else if (count > frozen[name]) errors.push(`${relative} reads window.${name} ${count} times, above the frozen ${frozen[name]}.`);
    }
  }
  for (const [relative, count] of Object.entries(dependency.directRequestsByFile)) {
    const frozen = MODULE_DIRECT_REQUESTS[relative];
    if (frozen === undefined) errors.push(`${relative} calls fetch directly; ${SHARED_REQUEST_CLIENT} is the one place that may.`);
    else if (count > frozen) errors.push(`${relative} calls fetch ${count} times, above the frozen ${frozen}.`);
  }
  for (const item of dependency.crossFeatureImports) errors.push(`${item.file}:${item.line} imports ${item.target}: one feature does not import another, shared code belongs in desktop/ui/services/.`);
  for (const item of dependency.globalStorage) errors.push(`${item.file}:${item.line} uses the localStorage global; the storage a module writes is injected.`);
  return errors;
}

export function collectRefactorMetrics({ root = ROOT } = {}) {
  const required = [...SOUND_FRONTEND_MODULES, ...SOUND_RUNTIME_MODULES];
  const missingModules = required.filter(relative => !fs.existsSync(path.join(root, relative)));
  const presentBoundaryFiles = SOUND_BOUNDARY_FILES.filter(relative => fs.existsSync(path.join(root, relative)));
  const domTextQueries = scanFiles(root, presentBoundaryFiles, 'dom-text-query', [
    /\bquerySelector(?:All)?\s*\([^\n)]*[\u3400-\u9fff][^\n)]*\)/g,
    /\bquerySelector(?:All)?\s*\([^\n)]*\btitle\s*[*^$|~]?=/g,
    /\.find\s*\([^;\n]{0,240}\btextContent\b[^;\n]{0,240}\)/g,
    /\btextContent\b[^;\n]{0,120}\.(?:includes|startsWith|endsWith)\s*\(/g,
  ]);
  const simulatedClicks = scanFiles(root, presentBoundaryFiles, 'simulated-click', [/\.click\s*\(/g]);
  const mutationObservers = scanFiles(root, presentBoundaryFiles, 'mutation-observer', [/\bMutationObserver\b/g]);
  const directFetches = scanFiles(root, presentBoundaryFiles, 'direct-fetch', [/\bfetch\s*\(/g]);
  const legacyMultiWriteEndpoints = scanFiles(root, presentBoundaryFiles, 'legacy-multi-write-endpoint', [
    /\/dsh-whale\/(?:size|usage-settings)\.json/g,
  ]);
  const combinedEndpoint = scanFiles(root, presentBoundaryFiles, 'combined-sound-settings-endpoint', [
    /\/api\/sound-settings\b/g,
  ]);
  const widget = read(root, 'assets/whale-widget.js');
  const soundEntry = read(root, 'desktop/ui/sound-settings.js');
  const html = read(root, 'desktop/ui/widget.html');
  const sourceSlices = sourceSliceTests(root);
  const rendererFetches = scanFiles(root, rendererSources(root), 'renderer-direct-fetch', [/\bfetch\s*\(/g]);
  return {
    baseline: {
      commit: 'c799866d38392e52cd464156cfaaa69cce16e4b2',
      classicScriptTags: 19,
      whaleWidgetLines: 12189,
      soundEntryLines: 306,
      soundForbidden: { domTextQueries: 2, simulatedClicks: 1, mutationObservers: 1, directFetches: 1, legacyMultiWriteEndpoints: 2 },
      sourceSliceTestFileCount: 7,
    },
    current: {
      classicScriptTags: (html.match(/<script\s+src=/g) || []).length,
      whaleWidgetLines: lineCount(widget),
      sourceSliceTestFiles: sourceSlices,
      sourceSliceTestFileCount: sourceSlices.length,
    },
    renderer: {
      directFetches: rendererFetches,
      directFetchCount: rendererFetches.length,
      directFetchBudget: RENDERER_DIRECT_FETCH_BUDGET,
    },
    sound: {
      requiredModules: required,
      missingModules,
      boundaryFiles: presentBoundaryFiles,
      entryLines: lineCount(soundEntry),
      moduleScripts: {
        soundSettings: moduleScript(html, 'sound-settings.js'),
        waitNotice: moduleScript(html, 'wait-notice.js'),
      },
      forbidden: {
        domTextQueries,
        simulatedClicks,
        mutationObservers,
        directFetches,
        legacyMultiWriteEndpoints,
      },
      combinedEndpointReferences: combinedEndpoint,
    },
    dependency: collectDependencyMetrics({ root }),
  };
}

export function refactorBoundaryErrors(metrics) {
  const errors = [];
  if (metrics.sound.missingModules.length) errors.push('Missing refactor modules: ' + metrics.sound.missingModules.join(', '));
  for (const [name, found] of Object.entries(metrics.sound.forbidden)) {
    if (found.length) errors.push(`${name} must be 0, found ${found.length}: ` + found.map(item => `${item.file}:${item.line}`).join(', '));
  }
  if (!metrics.sound.combinedEndpointReferences.length) errors.push('The sound feature must use GET/PUT /api/sound-settings.');
  if (!metrics.sound.moduleScripts.soundSettings || !metrics.sound.moduleScripts.waitNotice) errors.push('sound-settings.js and wait-notice.js must load as ES modules.');
  if (metrics.sound.entryLines > 80) errors.push(`desktop/ui/sound-settings.js must remain a thin entry (<= 80 lines, found ${metrics.sound.entryLines}).`);
  if (metrics.current.whaleWidgetLines > 3000) errors.push(`assets/whale-widget.js must stay within the composition maintenance cap of 3000 lines (found ${metrics.current.whaleWidgetLines}).`);
  if (metrics.current.classicScriptTags > 15) errors.push(`Classic script tags must stay within the phase-4 maintenance cap of 15 (found ${metrics.current.classicScriptTags}).`);
  if (metrics.current.sourceSliceTestFileCount > 3) errors.push(`Source-slicing test files must stay within the phase-4 maintenance cap of 3 (found ${metrics.current.sourceSliceTestFileCount}).`);
  errors.push(...dependencyErrors(metrics.dependency));

  // A ceiling rather than a target: it exists so the number cannot grow while
  // the migration to requestJson is done feature by feature.
  if (metrics.renderer.directFetchCount > metrics.renderer.directFetchBudget.total) {
    const perFile = Object.entries(metrics.renderer.directFetches.reduce((counts, item) => (counts[item.file] = (counts[item.file] || 0) + 1, counts), {}))
      .sort((a, b) => b[1] - a[1]).map(([file, count]) => `${file}:${count}`).join(', ');
    errors.push(`Direct fetch() calls in the renderer must not exceed the existing budget of ${metrics.renderer.directFetchBudget.total} (found ${metrics.renderer.directFetchCount}). Use requestJson from desktop/ui/services/request.js in new code, and lower the budget as call sites are converted. By file — ${perFile}`);
  }
  return errors;
}

export function assertRefactorBoundaries(metrics = collectRefactorMetrics()) {
  const errors = refactorBoundaryErrors(metrics);
  if (errors.length) throw new Error(errors.join('\n'));
  return metrics;
}

function summary(metrics) {
  const forbidden = Object.fromEntries(Object.entries(metrics.sound.forbidden).map(([name, found]) => [name, found.length]));
  return {
    baseline: {
      classicScriptTags: metrics.baseline.classicScriptTags,
      whaleWidgetLines: metrics.baseline.whaleWidgetLines,
      sourceSliceTestFileCount: metrics.baseline.sourceSliceTestFileCount,
      soundEntryLines: metrics.baseline.soundEntryLines,
      soundForbidden: metrics.baseline.soundForbidden,
    },
    current: {
      classicScriptTags: metrics.current.classicScriptTags,
      whaleWidgetLines: metrics.current.whaleWidgetLines,
      sourceSliceTestFileCount: metrics.current.sourceSliceTestFileCount,
      rendererDirectFetches: metrics.renderer.directFetchCount,
      rendererDirectFetchBudget: metrics.renderer.directFetchBudget.total,
    },
    sound: {
      missingModules: metrics.sound.missingModules,
      entryLines: metrics.sound.entryLines,
      moduleScripts: metrics.sound.moduleScripts,
      forbidden,
      combinedEndpointReferences: metrics.sound.combinedEndpointReferences.length,
    },
    dependency: {
      modules: metrics.dependency.modules.length,
      publishedGlobals: metrics.dependency.publishedGlobals.length,
      moduleGlobalReads: Object.values(metrics.dependency.moduleReads).reduce((sum, reads) => sum + Object.values(reads).reduce((a, b) => a + b, 0), 0),
      staleReads: metrics.dependency.staleReads.length,
      directRequests: metrics.dependency.directRequests.length,
      crossFeatureImports: metrics.dependency.crossFeatureImports.length,
      globalStorage: metrics.dependency.globalStorage.length,
    },
  };
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const metrics = collectRefactorMetrics();
  if (process.argv.includes('--json')) process.stdout.write(JSON.stringify(metrics, null, 2) + '\n');
  else process.stdout.write(JSON.stringify(summary(metrics), null, 2) + '\n');
  if (process.argv.includes('--check')) {
    const errors = refactorBoundaryErrors(metrics);
    if (errors.length) {
      for (const error of errors) process.stderr.write(error + '\n');
      process.exitCode = 1;
    } else process.stdout.write('Refactor architecture boundaries passed.\n');
  }
}
