// Static analysis for shipped source. Three defect classes are covered: a name
// that is neither defined nor imported (no-undef), a name that is defined but
// no longer used (no-unused-vars), and a dependency wired by value before its
// initialiser runs (the rule below). Everything else the repo checks
// (architecture boundaries, package graph, privacy, release contents) lives in
// scripts/refactor-metrics.mjs and scripts/build-release.py.
import globals from 'globals';

// A dependency wired by value — `toggle: toggle` inside a createX({...}) call —
// reads the variable at that moment, while its `var toggle = ...` may sit
// hundreds of lines further down in the same function. The value passed is then
// undefined and the feature fails only when a user reaches it. no-undef cannot
// see this (the name is defined) and no-use-before-define is far too broad here
// (243 hits, almost all of them legal uses inside callbacks).
//
// The discriminator is whether the read executes eagerly: if the reference sits
// in the same function as the declaration, it runs at wiring time and the value
// really is undefined. If it is inside a nested function, that function runs
// later and the read is fine. Scope resolution also handles shadowing, so a
// parameter of the same name is never reported.
export const noEagerUseBeforeInit = {
  meta: {
    type: 'problem',
    docs: { description: 'disallow reading a variable before its initialiser in the same function' },
    schema: [],
    messages: {
      eager: "'{{name}}' is read here but initialised on line {{line}} of the same function, so this runs with undefined.",
    },
  },
  create(context) {
    const sourceCode = context.sourceCode;
    const enclosingFunction = scope => {
      let current = scope;
      while (current && !['function', 'module', 'global'].includes(current.type)) current = current.upper;
      return current;
    };
    return {
      'Program:exit'() {
        for (const scope of sourceCode.scopeManager.scopes) {
          for (const reference of scope.references) {
            const variable = reference.resolved;
            if (!variable || variable.defs.length !== 1) continue;
            const [def] = variable.defs;
            if (def.type !== 'Variable' || !def.node.init) continue;
            if (enclosingFunction(reference.from) !== enclosingFunction(variable.scope)) continue;
            if (def.node.range[0] <= reference.identifier.range[0]) continue;
            context.report({
              node: reference.identifier,
              messageId: 'eager',
              data: { name: reference.identifier.name, line: def.node.loc.start.line },
            });
          }
        }
      },
    };
  },
};

const localRules = { 'local/no-eager-use-before-init': 'error' };

// Cross-script globals the renderer creates at load time. The classic <script>
// widgets are UMD: they assign host.WhaleX = api, so the monolith — now an ES
// module — and the extracted feature modules read them as bare identifiers via
// the global object. Listing them here is deliberate: it makes the coupling
// explicit and reviewable, and a new one must be added before lint passes.
const appGlobals = Object.fromEntries([
  'WhaleAccountView', 'WhaleApiModels', 'WhaleAudio', 'WhaleDashboard',
  'WhaleFeedback', 'WhaleFeedbackSources', 'WhaleGesture', 'WhaleLegacySoundUi',
  'WhaleLegacyUsage', 'WhaleMediaGuard', 'WhaleMoney', 'WhaleQuota',
  'WhaleRendering', 'WhaleSelect', 'WhaleTurnNotice', 'whaleToast',
].map(name => [name, 'readonly']));

// Renderer code loaded with <script type="module"> or imported by the monolith.
const rendererModules = [
  'assets/whale-widget.js',
  'desktop/ui/input.js',
  'desktop/ui/sound-settings.js',
  'desktop/ui/wait-notice.js',
  'desktop/ui/features/**/*.js',
  'desktop/ui/services/**/*.js',
];

// The three ESM entries under desktop/ui/ are excluded from the classic block.
const classicEntries = ['desktop/ui/input.js', 'desktop/ui/sound-settings.js', 'desktop/ui/wait-notice.js'];

const browserGlobals = { ...globals.browser, ...appGlobals };

export default [
  {
    ignores: ['node_modules/**', 'vendor/**', 'archive/**', 'dist/**', 'packages/**', 'qa/**', 'qa-*/**'],
  },

  {
    files: ['**/*.js', '**/*.mjs', '**/*.cjs'],
    plugins: { local: { rules: { 'no-eager-use-before-init': noEagerUseBeforeInit } } },
    rules: {
      'no-undef': 'error',
      // Dead names: the extraction left behind hollowed wrappers, unused imports
      // and write-only state that nothing reads. Enabled after clearing all of
      // them, so the tree stays at zero.
      //
      // args: 'none' is deliberate. Checking trailing parameters would flag nine
      // callbacks today and then tax every `.map((item, index) => …)` written
      // from here on — recurring friction for a cosmetic win. caughtErrors:
      // 'none' because `catch (err) {}` is this codebase's idiom (242 sites).
      'no-unused-vars': ['error', { args: 'none', varsIgnorePattern: '^_', caughtErrors: 'none' }],
      ...localRules,
    },
  },

  {
    files: ['runtime/**/*.mjs', 'lib/**/*.mjs', 'scripts/**/*.mjs', 'tests/**/*.mjs', 'desktop/**/*.mjs', '*.mjs'],
    languageOptions: { ecmaVersion: 'latest', sourceType: 'module', globals: { ...globals.node } },
  },

  {
    files: ['desktop/**/*.cjs', 'tests/**/*.cjs'],
    languageOptions: { ecmaVersion: 'latest', sourceType: 'commonjs', globals: { ...globals.node } },
  },

  {
    // Preload runs in the renderer process before any page script: it sees both
    // the DOM globals and Node's.
    files: ['desktop/preload.cjs'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'commonjs',
      globals: { ...globals.browser, ...globals.node },
    },
  },

  {
    files: rendererModules,
    languageOptions: { ecmaVersion: 'latest', sourceType: 'module', globals: browserGlobals },
  },

  {
    // Classic <script src> widgets: top-level declarations are page globals, so
    // sourceType must stay "script" or every cross-file reference reads as
    // undefined. "module" covers the UMD branch that exposes these to Node tests.
    files: ['desktop/ui/*.js'],
    ignores: classicEntries,
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'script',
      globals: { ...browserGlobals, module: 'writable' },
    },
  },

  {
    files: ['desktop/ui/alpha-worker.js'],
    languageOptions: { ecmaVersion: 'latest', sourceType: 'script', globals: { ...globals.worker } },
  },
];
