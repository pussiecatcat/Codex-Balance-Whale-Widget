import fs from 'node:fs';
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
  'desktop/ui/features/widget/wait-notice.js',
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
  'WhaleBubbleShape',
  'whaleToast',
]);

// Reads of those globals from modules that have already been extracted, with the
// count each one had when this gate was written. Dependency injection is the
// replacement, so these numbers only go down; an entry whose module stopped
// reading the global is reported as stale rather than failing, the way the line
// caps above work.
export const MODULE_GLOBAL_READS = Object.freeze({
  'desktop/ui/features/widget/asset-helpers.js': { whaleToast: 2 },
  'desktop/ui/features/widget/feedback.js': { whaleToast: 1 },
});

// Modules that still call fetch directly rather than going through the shared
// client. The role workflow is what the next migration round picks up, so this
// is frozen at what it had when the gate was added.
export const MODULE_DIRECT_REQUESTS = Object.freeze({
  'desktop/ui/features/widget/role-manager.js': 2,
});

// The preload bridge is a deliberate platform contract rather than a leftover
// application global, so reaching for it by name stays allowed.
const ALLOWED_GLOBAL = 'whaleDesktop';
const MODULE_ROOTS = Object.freeze(['desktop/ui/features', 'desktop/ui/services']);
const SHARED_REQUEST_CLIENT = 'desktop/ui/services/request.js';
const PUBLISH_ROOTS = Object.freeze(['desktop/ui', 'assets/whale-widget.js']);

// The modules above are gated one by one, which works because each is already a
// file of its own. assets/whale-widget.js and the classic scripts beside
// widget.html are each still a single file, where a per-module count would say
// nothing, so they get one ceiling instead. Like the frozen counts above it only
// moves down, and it is what stops the monolith's direct calls from growing
// while the extraction is still working through it.
export const LEGACY_DIRECT_FETCH_BUDGET = { total: 0 };

// Empty catch blocks are this codebase's idiom for best-effort cleanup, so the
// tree starts with a large count instead of failing lint wholesale. The number
// may only shrink: a new empty catch has to either handle the error or carry a
// comment explaining why swallowing it is deliberate.
export const EMPTY_CATCH_BUDGET = { total: 260 };

// The palette budget counts named root tokens; component hex literals are forbidden.
export const CSS_HEX_BUDGET = { total: 100 };
// Unowned resources are the other half of the dependency problem: a timer or a
// document listener nobody owns outlives the feature that created it. These
// counts only go down as modules move onto scope.
export const LIFECYCLE_BUDGET = { intervals: 10, documentListeners: 85, inlineStyles: 481 };
// scope.js implements the owned wrappers themselves; its setInterval is the API.
const LIFECYCLE_EXEMPT = new Set(['desktop/ui/services/scope.js']);

export function lifecycleMetrics(root = ROOT) {
  const files = [...new Set(['desktop/ui', 'assets/whale-widget.js'].flatMap(entry => listJavaScript(root, entry)))].sort();
  const rows = { intervals: [], documentListeners: [], inlineStyles: [] };
  for (const relative of files) {
    if (LIFECYCLE_EXEMPT.has(relative)) continue;
    const source = stripCommentsAndStrings(read(root, relative));
    for (const match of source.matchAll(/\bsetInterval\s*\(/g)) rows.intervals.push({ file: relative, line: lineOf(source, match.index) });
    for (const match of source.matchAll(/\b(?:document|window)\s*\.\s*addEventListener\s*\(/g)) rows.documentListeners.push({ file: relative, line: lineOf(source, match.index) });
    for (const match of source.matchAll(/\.style\.[A-Za-z_$][\w$]*\s*=(?!=)/g)) rows.inlineStyles.push({ file: relative, line: lineOf(source, match.index) });
  }
  return {
    intervals: rows.intervals.length,
    documentListeners: rows.documentListeners.length,
    inlineStyles: rows.inlineStyles.length,
    rows,
  };
}

const CSS_HEX_FILES = ['desktop/ui/whale-widget.css', 'desktop/ui/ui.css', 'assets/whale-widget.js'];
function cssHexMetrics(root) {
  const tokens = new Set(), raw = [];
  for (const relative of CSS_HEX_FILES) {
    let source; try { source = fs.readFileSync(path.join(root, relative), 'utf8'); } catch { continue; }
    for (const match of source.matchAll(/(--color-[\w-]+)\s*:/g)) tokens.add(match[1]);
    // ui.css declarations are the palette's only allowed literal values.
    if (relative.endsWith('.css')) {
      const components = source.replace(/--color-[\w-]+\s*:\s*#[0-9a-fA-F]{3,8}\b\s*;/g, '');
      for (const match of components.matchAll(/#[0-9a-fA-F]{3,8}\b/g)) raw.push({ file: relative, value: match[0] });
    }
  }
  return { total: tokens.size, values: [...tokens].sort(), raw };
}

// The shared client is the module this whole gate funnels callers into, and
// alpha-worker.js runs off the module graph in a Worker, where it is unreachable.
const LEGACY_REQUEST_EXEMPT = new Set(['desktop/ui/services/request.js', 'desktop/ui/alpha-worker.js']);

// desktop/ui/<name>.js — the classic scripts, not the extracted modules beneath.
function legacySources(root) {
  return listJavaScript(root, 'desktop/ui')
    .filter(relative => relative.split('/').length === 3 && !LEGACY_REQUEST_EXEMPT.has(relative))
    .concat(listJavaScript(root, 'assets/whale-widget.js'));
}

const DIRECT_REQUEST_PATTERNS = [/\bfetch\s*\(/g, /\bXMLHttpRequest\b/g];

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
      else if (/\.(?:js|mjs|cjs)$/.test(entry.name)) found.push(path.relative(root, child).split(path.sep).join('/'));
    }
  };
  walk(absolute);
  return found.sort();
}

// Remove comments and string/template literals but keep line breaks, so a name
// inside a comment or a message never counts as a dependency.
function stripCommentsAndStrings(source) {
  let out = '', i = 0;
  const n = source.length;
  while (i < n) {
    const ch = source[i], next = source[i + 1];
    if (ch === '/' && next === '/') {
      while (i < n && source[i] !== '\n') { out += ' '; i++; }
      continue;
    }
    if (ch === '/' && next === '*') {
      out += '  '; i += 2;
      while (i < n && !(source[i] === '*' && source[i + 1] === '/')) { out += source[i] === '\n' ? '\n' : ' '; i++; }
      if (i < n) { out += '  '; i += 2; }
      continue;
    }
    if (ch === "'" || ch === '"' || ch === '`') {
      const quote = ch; out += ' '; i++;
      while (i < n && source[i] !== quote) {
        if (source[i] === '\\') { out += '  '; i += 2; continue; }
        out += source[i] === '\n' ? '\n' : ' '; i++;
      }
      if (i < n) { out += ' '; i++; }
      continue;
    }
    out += ch; i++;
  }
  return out;
}

const isBusinessGlobal = name => name === 'whaleToast' || /^Whale[\w$]*$/.test(name);

// A read is a `window.Name`, `globalThis.Name`, `host.Name`, or a bare `Name`
// from the frozen surface. The bare form is what the classic scripts actually
// use, and it was invisible to the old gate.
function globalReads(source, names = GLOBAL_SURFACE) {
  const counts = {};
  const stripped = stripCommentsAndStrings(source);
  const lines = stripped.split('\n');
  const lineOfIndex = index => lines[(stripped.slice(0, index).match(/\n/g) || []).length] || '';
  for (const name of names) {
    const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    let total = 0;
    for (const _match of stripped.matchAll(new RegExp('\\b(?:window|globalThis|host)\\s*\\.\\s*' + escaped + '\\b', 'g'))) total++;
    for (const match of stripped.matchAll(new RegExp('\\b' + escaped + '\\b', 'g'))) {
      const before = stripped.slice(Math.max(0, match.index - 1), match.index);
      if (before === '.') continue;
      if (/^\s*import\b/.test(lineOfIndex(match.index))) continue;
      if (/(?:const|let|var|function|class)\s+$/.test(stripped.slice(Math.max(0, match.index - 40), match.index))) continue;
      total++;
    }
    if (total) counts[name] = total;
  }
  return counts;
}

function specifiers(source) {
  return [...source.matchAll(/\bfrom\s*['"]([^'"]+)['"]/g)]
    .map(match => ({ spec: match[1], index: match.index }));
}

function publishedNames(source) {
  const stripped = stripCommentsAndStrings(source);
  const names = new Set();
  for (const match of stripped.matchAll(/\b(?:window|globalThis|host)\s*\.\s*([A-Za-z_$][\w$]*)\s*=(?!=)/g)) {
    if (isBusinessGlobal(match[1]) || match[1] === ALLOWED_GLOBAL) names.add(match[1]);
  }
  for (const match of stripped.matchAll(/Object\s*\.\s*assign\s*\(\s*(?:window|globalThis|host)\s*,\s*\{([^}]*)\}/g)) {
    for (const key of match[1].matchAll(/([A-Za-z_$][\w$]*)\s*:/g)) if (isBusinessGlobal(key[1])) names.add(key[1]);
  }
  return [...names];
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

const SHARED_ROOT = 'desktop/ui/shared';
const SHARED_FORBIDDEN = [
  [/\bwindow\s*\./g, 'window'],
  [/\bdocument\s*\./g, 'document'],
  [/\blocalStorage\b/g, 'localStorage'],
  [/\bfetch\s*\(/g, 'fetch'],
];

function sharedPurityViolations(root) {
  const rows = [];
  for (const relative of listJavaScript(root, SHARED_ROOT)) {
    const source = stripCommentsAndStrings(read(root, relative));
    for (const [pattern, name] of SHARED_FORBIDDEN) {
      for (const match of source.matchAll(pattern)) rows.push({ file: relative, line: lineOf(source, match.index), name });
    }
  }
  return rows;
}

function reverseDependencies(root) {
  const rows = [];
  for (const relative of ['lib', 'runtime'].flatMap(entry => listJavaScript(root, entry))) {
    const source = read(root, relative);
    for (const { spec, index } of specifiers(source)) {
      const target = spec.startsWith('/')
        ? path.posix.normalize('desktop/ui' + spec)
        : path.posix.normalize(path.posix.join(path.posix.dirname(relative), spec));
      if (target.startsWith('desktop/ui/') && !target.startsWith(SHARED_ROOT + '/')) {
        rows.push({ file: relative, line: lineOf(source, index), target });
      }
    }
  }
  return rows;
}

export function collectDependencyMetrics({ root = ROOT } = {}) {
  const modules = [...new Set(MODULE_ROOTS.flatMap(directory => listJavaScript(root, directory)))].sort();
  const moduleReads = {};
  const crossFeatureImports = [];
  const directRequests = [];
  const globalStorage = [];
  for (const relative of modules) {
    const source = read(root, relative);
    const reads = globalReads(source);
    if (Object.keys(reads).length) moduleReads[relative] = reads;
    if (relative.startsWith('desktop/ui/features/')) {
      const owner = relative.slice('desktop/ui/features/'.length).split('/')[0];
      for (const { spec, index } of specifiers(source)) {
        const target = spec.startsWith('/')
          ? path.posix.normalize('desktop/ui' + spec)
          : path.posix.normalize(path.posix.join(path.posix.dirname(relative), spec));
        if (!target.startsWith('desktop/ui/features/')) continue;
        if (target.slice('desktop/ui/features/'.length).split('/')[0] !== owner) {
          crossFeatureImports.push({ file: relative, line: lineOf(source, index), target });
        }
      }
    }
    if (relative !== SHARED_REQUEST_CLIENT) {
      directRequests.push(...findings(relative, source, 'module-direct-request', DIRECT_REQUEST_PATTERNS));
    }
    globalStorage.push(...findings(relative, source, 'module-global-storage', [
      /\bwindow\s*\.\s*localStorage\b/g,
      /\bglobalThis\s*\.\s*localStorage\b/g,
    ]));
  }
  const publishedGlobals = [];
  for (const relative of PUBLISH_ROOTS.flatMap(entry => listJavaScript(root, entry))) {
    for (const name of publishedNames(read(root, relative))) {
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
  const legacyRequests = legacySources(root)
    .flatMap(relative => findings(relative, read(root, relative), 'legacy-direct-request', DIRECT_REQUEST_PATTERNS));
  return {
    modules,
    publishedGlobals,
    moduleReads,
    staleReads,
    crossFeatureImports,
    directRequests,
    directRequestsByFile: countByFile(directRequests),
    legacyDirectRequests: legacyRequests,
    legacyDirectRequestsByFile: countByFile(legacyRequests),
    globalStorage,
    sharedViolations: sharedPurityViolations(root),
    reverseDependencies: reverseDependencies(root),
  };
}

const EMPTY_CATCH_ROOTS = ['runtime', 'lib', 'desktop', 'assets', 'scripts'];
function emptyCatchMetrics(root) {
  const byFile = {}, rows = [];
  const walk = directory => {
    let entries;
    try { entries = fs.readdirSync(directory, { withFileTypes: true }); } catch { return; }
    for (const entry of entries) {
      const file = path.join(directory, entry.name);
      if (entry.isDirectory()) walk(file);
      else if (/\.(?:mjs|cjs|js)$/.test(entry.name)) {
        const count = (fs.readFileSync(file, 'utf8').match(/catch\s*(?:\([^)]*\))?\s*\{\s*\}/g) || []).length;
        if (!count) continue;
        const relative = path.relative(root, file).replaceAll('\\', '/');
        byFile[relative] = count;
        rows.push({ file: relative, count });
      }
    }
  };
  for (const directory of EMPTY_CATCH_ROOTS) walk(path.join(root, directory));
  return { total: rows.reduce((sum, row) => sum + row.count, 0), byFile, rows };
}

export function dependencyErrors(dependency) {  const errors = [];
  if (dependency.sharedViolations?.length) {
    errors.push('desktop/ui/shared must stay pure (no window/document/localStorage/fetch): ' + dependency.sharedViolations.map(row => `${row.file}:${row.line} ${row.name}`).join(', '));
  }
  if (dependency.reverseDependencies?.length) {
    errors.push('lib/ and runtime/ may only import desktop/ui/shared: ' + dependency.reverseDependencies.map(row => `${row.file}:${row.line} -> ${row.target}`).join(', '));
  }
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
  // A ceiling rather than a per-file freeze, because the files it covers have not
  // been split yet; the per-module rule above takes over as each one is.
  const legacy = dependency.legacyDirectRequests;
  if (legacy.length > LEGACY_DIRECT_FETCH_BUDGET.total) {
    const perFile = Object.entries(dependency.legacyDirectRequestsByFile)
      .sort((a, b) => b[1] - a[1]).map(([file, count]) => `${file}:${count}`).join(', ');
    errors.push(`Direct fetch() calls in the renderer that has not been split yet must not exceed the existing budget of ${LEGACY_DIRECT_FETCH_BUDGET.total} (found ${legacy.length}). Use ${SHARED_REQUEST_CLIENT}, and lower the budget as call sites are converted. By file — ${perFile}`);
  }
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
  const entryImports = source => widget.includes("import '/" + source + "'") || widget.includes("from '/" + source + "'");
  const html = read(root, 'desktop/ui/widget.html');
  const sourceSlices = sourceSliceTests(root);
  return {
    baseline: {
      commit: 'c799866d38392e52cd464156cfaaa69cce16e4b2',
      classicScriptTags: 19,
      whaleWidgetLines: 12189,
      soundForbidden: { domTextQueries: 2, simulatedClicks: 1, mutationObservers: 1, directFetches: 1, legacyMultiWriteEndpoints: 2 },
      sourceSliceTestFileCount: 7,
    },
    current: {
      classicScriptTags: (html.match(/<script\s+src=/g) || []).length,
      whaleWidgetLines: lineCount(widget),
      sourceSliceTestFiles: sourceSlices,
      sourceSliceTestFileCount: sourceSlices.length,
    },
    sound: {
      requiredModules: required,
      missingModules,
      boundaryFiles: presentBoundaryFiles,
      moduleScripts: {
        soundSettings: entryImports('features/sound-settings/controller.js'),
        waitNotice: entryImports('features/widget/wait-notice.js'),
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
    emptyCatch: emptyCatchMetrics(root),
    cssHex: cssHexMetrics(root),
    lifecycle: lifecycleMetrics(root),
  };
}

export function refactorBoundaryErrors(metrics) {
  const errors = [];
  if (metrics.sound.missingModules.length) errors.push('Missing refactor modules: ' + metrics.sound.missingModules.join(', '));
  for (const [name, found] of Object.entries(metrics.sound.forbidden)) {
    if (found.length) errors.push(`${name} must be 0, found ${found.length}: ` + found.map(item => `${item.file}:${item.line}`).join(', '));
  }
  if (!metrics.sound.combinedEndpointReferences.length) errors.push('The sound feature must use GET/PUT /api/sound-settings.');
  if (!metrics.sound.moduleScripts.soundSettings || !metrics.sound.moduleScripts.waitNotice) errors.push('The widget entry must import the sound controller and the wait notice.');
  if (metrics.current.whaleWidgetLines > 3100) errors.push(`assets/whale-widget.js must stay within the phase-4 maintenance cap of 3100 lines (found ${metrics.current.whaleWidgetLines}).`);
  if (metrics.current.classicScriptTags > 15) errors.push(`Classic script tags must stay within the phase-4 maintenance cap of 15 (found ${metrics.current.classicScriptTags}).`);
  if (metrics.current.sourceSliceTestFileCount > 3) errors.push(`Source-slicing test files must stay within the phase-4 maintenance cap of 3 (found ${metrics.current.sourceSliceTestFileCount}).`);
  errors.push(...dependencyErrors(metrics.dependency));
  if (metrics.emptyCatch.total > EMPTY_CATCH_BUDGET.total) {
    const perFile = Object.entries(metrics.emptyCatch.byFile).sort((a, b) => b[1] - a[1])
      .map(([file, count]) => `${file}:${count}`).join(', ');
    errors.push(`Empty catch blocks must not exceed the existing budget of ${EMPTY_CATCH_BUDGET.total} (found ${metrics.emptyCatch.total}). Handle the error or add a comment explaining a deliberate best-effort catch, and lower the budget as sites are cleaned. By file — ${perFile}`);
  }
  if (metrics.cssHex.total > CSS_HEX_BUDGET.total) {
    errors.push(`CSS color tokens must not exceed the existing budget of ${CSS_HEX_BUDGET.total} (found ${metrics.cssHex.total}). Use a design token instead, and lower the budget as surfaces are migrated.`);
  }
  if (metrics.cssHex.raw?.length) errors.push('Component CSS must use --color-* tokens instead of hex literals.');
  for (const [key, budget] of Object.entries(LIFECYCLE_BUDGET)) {
    if (metrics.lifecycle[key] > budget) {
      const rows = metrics.lifecycle.rows[key].slice(0, 12).map(row => `${row.file}:${row.line}`).join(', ');
      errors.push(`Unowned ${key} must not exceed the frozen budget of ${budget} (found ${metrics.lifecycle[key]}): ${rows}`);
    }
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
    },
    sound: {
      missingModules: metrics.sound.missingModules,
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
      legacyDirectRequests: metrics.dependency.legacyDirectRequests.length,
      legacyDirectFetchBudget: LEGACY_DIRECT_FETCH_BUDGET.total,
      crossFeatureImports: metrics.dependency.crossFeatureImports.length,
      globalStorage: metrics.dependency.globalStorage.length,
    },
    quality: {
      emptyCatches: metrics.emptyCatch.total,
      emptyCatchBudget: EMPTY_CATCH_BUDGET.total,
      cssHexValues: metrics.cssHex.total,
      cssHexBudget: CSS_HEX_BUDGET.total,
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
