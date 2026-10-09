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
  'desktop/ui/sound-settings.js',
  'desktop/ui/wait-notice.js',
  'desktop/ui/services/sound-reference.js',
  'desktop/ui/features/sound-settings/model.js',
  'desktop/ui/features/sound-settings/controller.js',
  'desktop/ui/features/sound-settings/view.js',
]);

function read(root, relative) {
  return fs.readFileSync(path.join(root, relative), 'utf8');
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
  if (metrics.current.sourceSliceTestFileCount > metrics.baseline.sourceSliceTestFileCount) errors.push(`Source-slicing tests may not increase beyond the phase-0 baseline of ${metrics.baseline.sourceSliceTestFileCount} (found ${metrics.current.sourceSliceTestFileCount}).`);
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
      entryLines: metrics.sound.entryLines,
      moduleScripts: metrics.sound.moduleScripts,
      forbidden,
      combinedEndpointReferences: metrics.sound.combinedEndpointReferences.length,
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
