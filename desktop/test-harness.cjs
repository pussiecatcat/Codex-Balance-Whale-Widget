'use strict';
const path = require('node:path');
const { pathToFileURL } = require('node:url');

// Everything that exists only so the Electron tests can drive the real window.
//
// These branches used to sit inline in main.cjs — the fixture module import, the
// renderer error collector, the hand-placed cursor, the opened-link recorder and
// the verify driver — interleaved with window creation and the host state
// machine. Reading what the harness did to production behaviour meant reading
// all of it.
//
// main.cjs now calls these unconditionally; every method is a no-op unless the
// harness is enabled. The only thing callers still branch on is `enabled`, and
// those places are production behaviours the harness suppresses (the overlay
// handle on stdout, the diagnostic shortcut, native mode ownership), not test
// code.
//
// The three fixture modules live in tests/ and this cannot be required without
// WHALE_DESKTOP_TEST, so nothing here loads in a normal run.
function createTestHarness({ enabled = process.env.WHALE_DESKTOP_TEST === '1', root, env = process.env } = {}) {
  const errors = [];
  const openedLinks = [];
  let cursor = null;

  return {
    enabled,
    errors: () => errors.slice(),
    openedLinks: () => openedLinks.slice(),

    // A cursor the test placed by hand wins over the real pointer position.
    cursorPoint: computed => (enabled && cursor ? cursor : computed),

    // Answers whether it took the point, so the caller knows to resend.
    setCursor(point) {
      if (!enabled) return false;
      cursor = point;
      return true;
    },

    extraArguments: () => (enabled ? ['--whale-render-test'] : []),

    // True when the harness took the link instead of the shell opening it.
    captureOpenedLink(url) {
      if (!enabled) return false;
      openedLinks.push(url);
      return true;
    },

    // Options the fixture contributes to createDispatcher. The fixture module is
    // imported by path so tests/ stays out of the packaged graph.
    async load(dataDir) {
      if (!enabled) return {};
      const { makeFixture } = await import(pathToFileURL(path.join(root, 'tests', 'desktop-fixture.mjs')));
      return makeFixture(dataDir);
    },

    // Collect renderer console errors. A renderer that fails to decode its art
    // logs and keeps going, so without this a broken image is invisible.
    watchRenderer(window) {
      if (!enabled) return;
      window.webContents.on('console-message', (_event, ...args) => {
        const detail = args[0];
        if (typeof detail === 'object' ? detail.level === 'error' : detail === 3) {
          errors.push(typeof detail === 'object'
            ? detail.message + (detail.sourceId ? ` @ ${detail.sourceId}:${detail.lineNumber || 0}` : '')
            : args[1] + (args[3] ? ` @ ${args[3]}:${args[2] || 0}` : ''));
        }
      });
    },

    // Drive the fixture. It owns the process from here: it asserts against the
    // live window and exits the app when it is done.
    async run(context) {
      if (!enabled) return;
      // macOS Electron has no screen.dipToScreenRect/screenToDipRect: native
      // bounds are already DIP there. Fixtures are written against the Windows
      // conversions, so give them identity ones instead of branching per call.
      if (context.screen && !context.screen.dipToScreenRect) {
        const identity = (_display, rect) => ({ ...rect });
        context = { ...context, screen: Object.create(context.screen, {
          dipToScreenRect: { value: identity },
          screenToDipRect: { value: identity },
        }) };
      }
      const module = env.WHALE_VISIBILITY_STRESS === '1' ? 'visibility-stress-fixture.mjs'
        : env.WHALE_DESKTOP_AUDIT === '1' ? 'desktop-audit-fixture.mjs'
        : env.WHALE_BUBBLE_VISUAL === '1' ? 'bubble-visual-fixture.mjs'
        : env.WHALE_SETTINGS_FIXTURE === '1' ? 'settings-fixture.mjs'
        : 'desktop-fixture.mjs';
      const loaded = await import(pathToFileURL(path.join(root, 'tests', module)));
      if (env.WHALE_BUBBLE_VISUAL === '1') return loaded.renderBubbleVisual({ ...context, errors });
      if (env.WHALE_SETTINGS_FIXTURE === '1') {
        const report = await loaded.verifySettingsWindow({ ...context, errors, output: env.WHALE_DESKTOP_VERIFY_DIR || null });
        // 夹具拥有进程：写完报告退出，不进入正常的挂件生命周期。
        const fs = require('node:fs');
        fs.writeFileSync(path.join(env.WHALE_DESKTOP_VERIFY_DIR || context.dataDir, 'settings-window.json'), JSON.stringify(report, null, 2));
        context.app.quit();
        return report;
      }
      await loaded.verifyDesktop({ ...context, errors, openedLinks });
    },
  };
}

module.exports = { createTestHarness };
