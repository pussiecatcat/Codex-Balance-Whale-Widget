const path = require('node:path');

// Desktop/follow mode owns the host snapshot and the two transitions. It used
// to live inside main.cjs, where tests had to cut the source into a vm sandbox;
// the controller now takes every collaborator as a dependency.
function createModeController({
  getWindow,
  getQuitting,
  initialHost = null,
  initialMode = 'follow-codex',
  dataDir,
  normalizedHost = host => host,
  platform = process.platform,
  usesWindowShape = platform === 'win32',
  harnessEnabled = false,
  read = () => ({}),
  save = () => {},
  screen,
  toDipRect = rect => rect,
  sendCursor = () => {},
  updateTray = () => {},
  markStartup = () => {},
  diagnose = () => {},
  visibility = () => {},
  show = () => {},
  syncNativeViewport = () => '',
  visibilityController = { observeNativeVisibility: () => false },
  diagnostics = { sample() {} },
  quit = () => {},
  hideManuallyOff = () => {},
}) {
  const isMac = platform === 'darwin';
  const state = {
    desktopMode: initialMode,
    desktopBoundsApplied: false,
    modePending: false,
    appliedBounds: '',
    appliedNativeSize: '',
    hostSequence: -1,
    hostHeartbeat: 0,
    lastHost: initialHost,
  };
  const win = () => getWindow();

  async function setHost(host) {
    host = normalizedHost(host, { platform });
    if (!host) return;
    if (Number.isSafeInteger(host.serial)) { if (host.serial <= state.hostSequence) return; state.hostSequence = host.serial; }
    state.hostHeartbeat = Date.now(); state.lastHost = host;
    // Record the observed state before any lifecycle recovery can change it.
    if (usesWindowShape) { try { diagnostics.sample(); } catch { /* diagnostics never blocks a host update */ } }
    if (host.monitorExit) { quit(); return; }
    sendCursor();
    if (state.modePending) {
      if (host.mode !== state.desktopMode || (state.desktopMode === 'standalone' ? host.nativeFollowing || host.attached : host.hostAlive && !host.attached)) return;
      state.modePending = false;
      win().setAlwaysOnTop(state.desktopMode === 'standalone' || isMac, 'floating');
      win().webContents.send('whale-desktop-mode', state.desktopMode);
      updateTray();
    } else if (!isMac && !harnessEnabled && host.mode && host.mode !== state.desktopMode) return;
    if (state.desktopMode === 'standalone') {
      // macOS may move an overlay while restoring windows or switching Spaces.
      // Desktop mode owns its geometry even when Codex is still observable.
      if (win() && !host.nativeFollowing) {
        const target = screen.getPrimaryDisplay().workArea;
        const current = win().getBounds();
        const boundsDrifted = ['x', 'y', 'width', 'height'].some(key => Math.abs(current[key] - target[key]) >= 1);
        if (boundsDrifted) win().setBounds(target);
        if (boundsDrifted || !state.desktopBoundsApplied) {
          win().setAlwaysOnTop(true, 'floating');
          state.desktopBoundsApplied = true;
        }
      }
      visibility(); return;
    }
    if (!host.hostAlive) { if (win()) quit(); return; }
    if (!win()) return;
    if (host.attached) markStartup('attached');
    // Native events own position. Only Electron may resize its non-resizable
    // viewport; it updates the corresponding native min/max tracking sizes.
    state.appliedNativeSize = syncNativeViewport(host, win(), screen, state.appliedNativeSize);
    // Stale coordinates never go through setBounds while native following runs.
    if (!host.nativeFollowing && host.visible && host.bounds && [host.bounds.x, host.bounds.y, host.bounds.width, host.bounds.height].every(Number.isFinite)) {
      const rect = toDipRect(host.bounds);
      const key = JSON.stringify(rect);
      if (rect.width > 10 && rect.height > 10 && state.appliedBounds !== key) {
        const current = win().getBounds();
        if (rect.width !== current.width || rect.height !== current.height) win().setBounds(rect);
        else win().setPosition(rect.x, rect.y);
        state.appliedBounds = key; sendCursor(true);
      }
    }
    visibility();
    if (visibilityController.observeNativeVisibility()) diagnose('native-window-hidden');
  }

  function setMode(mode) {
    if (getQuitting() || !win() || win().isDestroyed()) return false;
    if (!['standalone', 'follow-codex'].includes(mode)) return false;
    if (state.desktopMode === mode) { win().webContents.send(state.modePending ? 'whale-desktop-mode-changing' : 'whale-desktop-mode', mode); return true; }
    win().webContents.send('whale-desktop-mode-changing', mode);
    save(path.join(dataDir, 'follow-config.json'), { ...read(path.join(dataDir, 'follow-config.json')), mode });
    state.desktopMode = mode; state.desktopBoundsApplied = false;
    state.appliedBounds = ''; state.appliedNativeSize = '';
    if (!isMac && !harnessEnabled) {
      // Native ownership must finish changing before Electron changes geometry.
      state.modePending = true; hideManuallyOff(); visibility(); return true;
    }
    if (mode === 'standalone') { win().setBounds(screen.getPrimaryDisplay().workArea); win().setAlwaysOnTop(true, 'floating'); }
    else { win().setAlwaysOnTop(isMac, 'floating'); if (state.lastHost) void setHost({ ...state.lastHost, serial: undefined }); }
    win().webContents.send('whale-desktop-mode', mode); show(); updateTray(); return true;
  }

  return { state, setHost, setMode };
}

module.exports = { createModeController };
