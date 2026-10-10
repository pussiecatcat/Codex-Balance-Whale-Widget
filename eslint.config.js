// Static analysis for shipped source. The only rule enabled is no-undef: the
// widget monolith and its extracted modules are wired together by name, and a
// name that is neither defined nor imported stays invisible until a user clicks
// the feature that reaches it. Everything else the repo checks (architecture
// boundaries, package graph, privacy) lives in scripts/refactor-metrics.mjs and
// scripts/build-release.py.
import globals from 'globals';

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
    rules: { 'no-undef': 'error' },
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
