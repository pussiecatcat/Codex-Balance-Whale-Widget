const { app, BrowserWindow, Tray, Menu, nativeImage, screen, ipcMain, globalShortcut, shell, protocol, session, net, dialog } = require('electron');
const path = require('node:path');
const fs = require('node:fs');
const { UiStateStore } = require('./ui-state-store.cjs');
// The host shares the service layer's atomic write instead of keeping a second
// one. Electron is installed at a pinned version (install-desktop.mjs asks for
// 44.3.0), whose Node can require an ES module by path.
const { writeFileAtomicSync } = require('../lib/atomic-write.mjs');
const { shutdownCompanion } = require('./lifecycle.cjs');
const { externalWebUrl } = require('./external-links.cjs');
const { syncNativeViewport } = require('./native-viewport.cjs');
const { createHeartbeatMonitor } = require('./heartbeat.cjs');
const { registerIpcHandlers } = require('./ipc-handlers.cjs');
const { SettingsStore, createSoundSettingsDomains } = require('./settings-store.cjs');
const { createChangeBus } = require('./change-bus.cjs');
const { createTestHarness } = require('./test-harness.cjs');
const { validateWindowShape, EMPTY_SHAPE } = require('./window-shape.cjs');
const { createVisibilityController } = require('./visibility.cjs');
const { createModeController } = require('./mode-controller.cjs');
const { createSettingsWindowManager } = require('./settings-window.cjs');
const { createLegacyStorageImporter } = require('./legacy-storage-import.cjs');
const { createTrayController } = require('./tray.cjs');
const { createSettingsDomains } = require('./settings-domains.cjs');
const { createAppActions } = require('./app-actions.cjs');
const { createRendererLifecycle } = require('./renderer-lifecycle.cjs');
const { applyChromiumSwitches } = require('./chromium-switches.cjs');
const { registerShortcuts } = require('./shortcuts.cjs');
const { normalizeHostState, parseInitialHostState } = require('./host-state.cjs');
const { createDiagnostics } = require('./diagnostics.cjs');
const { pathToFileURL } = require('node:url');
const root = path.resolve(__dirname, '..');
const dataDir = process.argv.find(a => a.startsWith('--whale-data='))?.slice(13);
// Inert unless WHALE_DESKTOP_TEST is set. Every fixture-only branch lives in
// test-harness.cjs, so the calls below read the same in both modes and the only
// thing that changes here is which production behaviours it suppresses.
const harness = createTestHarness({ root });
const initialHost = parseInitialHostState(process.env.WHALE_INITIAL_HOST, { platform: process.platform });
const startupAt = Date.now();
const startup = { revision: 'complete-audit-v1', requestedAt: Number(process.env.WHALE_LAUNCH_TIME) || startupAt, mainAt: startupAt, phases: {} };
const markStartup = phase => { if (startup.phases[phase] == null) startup.phases[phase] = Date.now() - startup.requestedAt; };
markStartup('main');
const isMac = process.platform === 'darwin';
const usesWindowShape = process.platform === 'win32';
let windowShape = null, windowShapeError = null;
const toDipRect = rect => isMac ? rect : screen.screenToDipRect(null, rect);
const { softwareRendering, nativeOcclusionDisabled } = applyChromiumSwitches({ app });
if (!dataDir || !path.isAbsolute(dataDir) || (!harness.enabled && !process.argv.includes('--supervised'))) app.exit(1);
protocol.registerSchemesAsPrivileged([{ scheme: 'whale', privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true, stream: true } }]);
fs.mkdirSync(path.join(dataDir, 'desktop-profile'), { recursive: true });
app.setPath('userData', path.join(dataDir, 'desktop-profile'));
const lock = app.requestSingleInstanceLock();
let window, dispatcher, bridge, quitting = false, manuallyHidden = false;
const renderer = { ready: false, readyTimer: null, recoveryTimer: null, attempts: 0 };
let settingsStore = null;
let uiOrigin = 'whale://widget';
const stateFile = path.join(dataDir, 'ui-state.json');
const read = (f, fallback = {}) => { try { return JSON.parse(fs.readFileSync(f, 'utf8').replace(/^\uFEFF/, '')); } catch { return fallback; } };
// Same atomic primitive the service uses. This used to be a weaker local copy
// (fixed temp name, no exclusive create, no retry), which is the wrong trade for
// the state files that have to survive a crash.
const save = (file, value) => writeFileAtomicSync(file, JSON.stringify(value, null, 2));
let diagnosticShortcutRegistered = false;
let toggleShortcutRegistered = false;
const diagnostics = createDiagnostics({
  dataDir, save,
  // Every field belongs to this process's live state, so the main process hands
  // diagnostics a snapshot rather than the other way round.
  snapshot: () => {
    const live = !!window && !window.isDestroyed() && !window.webContents.isDestroyed();
    return {
      // Null when there is no window to sample; `entry` is written either way.
      record: live ? {
        ready: renderer.ready, visible: window.isVisible(), manuallyHidden, desktopMode: mode.state.desktopMode,
        hostAlive: !!mode.state.lastHost?.hostAlive, hostVisible: !!mode.state.lastHost?.visible, modal: !!mode.state.lastHost?.modal,
        native: mode.state.lastHost?.visualDiagnostics || null, bounds: window.getBounds(),
        shape: windowShape, shapeError: !!windowShapeError, inputEnabled,
        visibility: visibilityController.snapshot(), attempts: renderer.attempts, presents, nativeOcclusionDisabled,
      } : null,
      entry: {
        desktopMode: mode.state.desktopMode, ready: renderer.ready, manuallyHidden, attempts: renderer.attempts,
        hostAlive: !!mode.state.lastHost?.hostAlive, hostVisible: !!mode.state.lastHost?.visible, modal: !!mode.state.lastHost?.modal,
        attached: !!mode.state.lastHost?.attached, shapeCount: windowShape?.length || 0,
      },
    };
  },
});
const diagnose = diagnostics.diagnose;
const reportVisibility = diagnostics.report;
const uiStore = new UiStateStore(stateFile);
const values = () => uiStore.get();
const storeValues = input => uiStore.set(input);
let gpuStatus = null, inputEnabled = false, keyboardFocus = false, lastCursor = '', presents = 0;
const pendingCommands = [];
let trustedGestureAt = 0;
app.on('gpu-info-update', () => {
  gpuStatus = { requestedMode: softwareRendering ? 'software' : 'hardware-auto', nativeOcclusionDisabled, hardwareAcceleration: app.isHardwareAccelerationEnabled(), features: app.getGPUFeatureStatus(), electron: process.versions.electron, chromium: process.versions.chrome };
  fs.promises.writeFile(path.join(dataDir, 'render-status.json'), JSON.stringify(gpuStatus, null, 2)).catch(() => {});
});
function invalidate() { if (window && !window.isDestroyed()) { presents++; window.webContents.invalidate(); } }
function applyWindowShape(rects) {
  if (!usesWindowShape || quitting || !window || window.isDestroyed() || window.webContents.isDestroyed()) return false;
  const shape = validateWindowShape(rects, window.getContentBounds());
  if (!shape) return false;
  try {
    window.setShape(shape);
    const recovering = !!windowShapeError;
    windowShape = shape; windowShapeError = null;
    // Changing a native region also changes which transparent compositor pixels
    // may be presented. Submit the existing frame once; never hide/reload it.
    invalidate();
    if (recovering) visibility();
    return true;
  } catch (error) {
    windowShapeError = String(error?.message || error).slice(0, 350);
    diagnose('window-shape-failed');
    // Keep the last successful region. If even the initial shape failed, stay
    // hidden instead of exposing a full-client-area surface or reload looping.
    if (!windowShape) { inputEnabled = false; window.setIgnoreMouseEvents(true, { forward: !usesWindowShape }); window.hide(); }
    return false;
  }
}
function setKeyboardFocus(editing) {
  if (!window || window.isDestroyed() || keyboardFocus === editing) return;
  keyboardFocus = editing;
  if (editing) window.focus();
}
let cursorPoll = null;
function stopCursorPoll() { if (cursorPoll) { clearInterval(cursorPoll); cursorPoll = null; } }
function ensureCursorPoll() {
  if (cursorPoll || !window || window.isDestroyed() || !window.isVisible()) return;
  cursorPoll = setInterval(sendCursor, usesWindowShape ? 16 : 50);
  cursorPoll.unref?.();
}
function sendCursor(force = false) {
  if (!window || window.isDestroyed() || !renderer.ready || !window.isVisible()) { stopCursorPoll(); return; }
  const bounds = window.getContentBounds(), cursor = screen.getCursorScreenPoint();
  const point = { ...harness.cursorPoint({ x: cursor.x - bounds.x, y: cursor.y - bounds.y }), buttons: mode.state.lastHost?.mouseButtons || 0, sampledAt: mode.state.lastHost?.mouseSampleAt || 0 };
  const encoded = point.x + ',' + point.y + ',' + point.buttons;
  if (force || encoded !== lastCursor) { lastCursor = encoded; window.webContents.send('whale-cursor', point); }
}
function setTestCursor(point) { if (harness.setCursor(point)) sendCursor(true); }
const visibilityController = createVisibilityController({
  getWindow: () => window,
  getState: () => ({ ready: renderer.ready && !mode.state.modePending && (!usesWindowShape || !!windowShape), host: mode.state.lastHost, standalone: mode.state.desktopMode === 'standalone', fixture: harness.enabled, manuallyHidden, quitting }),
  onShown: () => {
    if (startup.phases.interactive == null) {
      markStartup('interactive');
      fs.promises.writeFile(path.join(dataDir, 'startup-timings.json'), JSON.stringify(startup, null, 2)).catch(() => {});
    }
  },
});
function visibility() {
  visibilityController.update();
}
const rendererLifecycle = createRendererLifecycle({
  getWindow: () => window, getQuitting: () => quitting, state: renderer,
  visibilityController, diagnose: reason => diagnose(reason),
  hideManuallyOff: () => { manuallyHidden = false; },
});
const mode = createModeController({
  getWindow: () => window, getQuitting: () => quitting,
  initialHost, initialMode: read(path.join(dataDir, 'follow-config.json')).mode === 'standalone' ? 'standalone' : 'follow-codex',
  dataDir, normalizedHost: normalizeHostState, usesWindowShape, harnessEnabled: harness.enabled,
  read, save, screen, toDipRect,
  sendCursor: (...args) => sendCursor(...args), markStartup,
  diagnose: reason => diagnose(reason), visibility: () => visibility(), show: () => rendererLifecycle.show(),
  syncNativeViewport, visibilityController, diagnostics, quit: () => app.quit(),
  hideManuallyOff: () => { manuallyHidden = false; },
  updateTray: () => trayController.update(),
});
const appActions = createAppActions({
  app, dialog, getWindow: () => window, dataDir, save, mode,
  getRendererReady: () => renderer.ready, getRecoveryAttempts: () => renderer.attempts,
});
const trayController = createTrayController({
  Tray, Menu, nativeImage, iconPath: path.join(root, 'assets', 'DSniang1.png'),
  actions: {
    toggle: () => toggle(), show: () => rendererLifecycle.show(), resetPosition: () => resetPosition(),
    setMode: value => mode.setMode(value), getMode: () => mode.state.desktopMode,
    sendCommand: command => sendCommand(command), openSettings: () => settings.open(),
    showStatusDialog: () => appActions.showStatusDialog(), pauseAndQuit: () => appActions.pauseAndQuit(),
  },
});
function toggle() { if (manuallyHidden) rendererLifecycle.show(); else { manuallyHidden = true; visibility(); } }
// Renderer finished loading its images and input bindings: clear the recovery
// timers it may have raced, then hand it the mode it should be showing.
function markRendererReady() {
  markStartup('imageAndInputReady');
  try { fs.rmSync(path.join(dataDir, 'desktop-error.json'), { force: true }); } catch {}
  clearTimeout(renderer.readyTimer); renderer.readyTimer = null;
  clearTimeout(renderer.recoveryTimer); renderer.recoveryTimer = null;
  renderer.ready = true;
  diagnose('ready');
  window.webContents.send('whale-desktop-mode', mode.state.desktopMode);
  visibility(); flushCommands(); invalidate(); sendCursor(true);
}
function setInteractive(enabled) {
  // A region-clipped window has no shape to hit-test against until the renderer
  // has sent one, so it stays non-interactive regardless of what it asks for.
  if ((usesWindowShape && !windowShape) || enabled === inputEnabled) return;
  inputEnabled = enabled;
  window.setIgnoreMouseEvents(!enabled, { forward: !usesWindowShape });
}
function sendCommand(command, payload) {
  if (!window || window.isDestroyed() || !command) return false;
  rendererLifecycle.show();
  if (renderer.ready) window.webContents.send('whale-command', command, payload);
  else if (!pendingCommands.some(entry => entry[0] === command)) pendingCommands.push([command, payload]);
  return true;
}
function flushCommands() {
  if (!renderer.ready || !window || window.isDestroyed()) return;
  for (const [command, payload] of pendingCommands.splice(0)) window.webContents.send('whale-command', command, payload);
}
async function openWebLink(value, gestureRequired = true) {
  if (gestureRequired && (!trustedGestureAt || Date.now() - trustedGestureAt > 1000)) return false;
  trustedGestureAt = 0;
  let target = value;
  if (value === 'whale://widget/provider-dashboard') {
    try { target = dispatcher.whale.config.resolve().dashboardUrl; } catch { return false; }
  }
  const url = externalWebUrl(target);
  if (!url) return false;
  try {
    // The harness records the link instead of opening it, so an audit never
    // launches a real browser.
    if (!harness.captureOpenedLink(url)) await shell.openExternal(url);
    return true;
  } catch { return false; }
}

// 角色化判定在 desktop/ipc-handlers.cjs 里按通道完成；这里只提供窗口表。
const windows = () => ({ widget: window, settings: settings.get() });


const importLegacyStorage = createLegacyStorageImporter({
  dataDir, BrowserWindow, session, harnessEnabled: harness.enabled,
  storeValues, values, save: (file, value) => save(file, value),
});

const settings = createSettingsWindowManager({
  BrowserWindow, screen, dialog, harness, get uiOrigin() { return uiOrigin; },
  openWebLink, getSettingsStore: () => settingsStore, isQuitting: () => quitting,
  showWidget: () => rendererLifecycle.show(), getWidgetWindow: () => window,
  sendCommand: (...args) => sendCommand(...args),
});

// What desktop/ipc-handlers.cjs is allowed to reach. Listing it here keeps the
// IPC surface auditable in one place instead of implicit in the closures of nine
// inline handlers.
const ipcHost = {
  window: () => window,
  windows,
  quitting: () => quitting,
  storage: () => values(),
  storeStorage: input => uiStore.applyPatch(input),
  markGesture: () => { trustedGestureAt = Date.now(); },
  gestureFresh: () => !!trustedGestureAt && Date.now() - trustedGestureAt <= 1000,
  applyShape: rects => applyWindowShape(rects),
  rendererReady: markRendererReady,
  setInteractive,
  setKeyboardFocus,
  openExternal: url => openWebLink(url),
  setMode: mode.setMode,
  desktopMode: () => mode.state.desktopMode,
  show: rendererLifecycle.show,
  showStatusDialog: appActions.showStatusDialog,
  pauseAndQuit: appActions.pauseAndQuit,
  relaunch: appActions.relaunchApp,
  resetPosition: () => resetPosition(),
  openDiagnostics: () => openDiagnosticsFolder(),
  sendCommand,
  openSettings: page => !!settings.open(page),
  openEditorFromSettings: settings.openEditor,
  previewSettings: settings.preview,
  settingsStore: () => settingsStore,
};

if (!lock) app.quit();
else {
  app.on('second-instance', () => rendererLifecycle.show());
  app.whenReady().then(async () => {
    markStartup('appReady');
    const { createDispatcher, UI_ORIGIN } = await import(pathToFileURL(path.join(root, 'runtime', 'dispatcher.mjs')));
    uiOrigin = UI_ORIGIN;
    const { startBridge } = await import(pathToFileURL(path.join(root, 'runtime', 'bridge.mjs')));
    const testOptions = await harness.load(dataDir);
    const changeBus = createChangeBus({ targets: () => [window, settings.get()] });
    dispatcher = createDispatcher({ dataDir, onChange: change => changeBus.publish(change), fetchImpl: (url, options) => net.fetch(url, options), onStop: appActions.pauseAndQuit, onShow: () => rendererLifecycle.show(),
      onRuntimeEvent: event => {
        if (!window || window.isDestroyed() || window.webContents.isDestroyed()) return;
        window.webContents.send('whale-runtime-event', event);
      },
      statusInfo: () => ({ followCodex: mode.state.desktopMode !== 'standalone', desktopMode: mode.state.desktopMode, ready: renderer.ready, recoveryAttempts: renderer.attempts, manuallyHidden, platform: process.platform, followMode: mode.state.lastHost?.followMode || null, hostPid: mode.state.lastHost?.hostPid || null, visible: !!window?.isVisible(), modePending: mode.state.modePending, windowShape, windowShapeError, windowBounds: window?.getBounds(), visibility: visibilityController.snapshot(), nativeFollowing: !!mode.state.lastHost?.nativeFollowing, mouseRouting: { forwardedMouseMoves: !usesWindowShape, cursorPollMs: usesWindowShape ? 16 : 50 }, diagnostics: { shortcutRegistered: diagnosticShortcutRegistered, toggleShortcutRegistered, lastReport: diagnostics.lastReport(), native: mode.state.lastHost?.visualDiagnostics || null }, startup, rendering: gpuStatus }), ...testOptions });
    markStartup('dispatcherReady');
    // 小龙娘设置的唯一写入者。size/usage 经 SoundSettingsService 的同一事务落盘
    // （journal + 失败恢复），ui 走 UiStateStore 的按键合并，displayMode 走现有路由；
    // 这里只做域适配，不建立第二套写入者。
    settingsStore = new SettingsStore({
      domains: createSettingsDomains({ dispatcher, values, uiStore, read, save, dataDir, createSoundSettingsDomains }),
      onChange: change => changeBus.publish(change),
    });
    await importLegacyStorage();
    session.defaultSession.protocol.handle('whale', async request => {
      const url = new URL(request.url);
      if (url.host !== 'widget') return new Response('', { status: 403 });
      const result = await dispatcher.dispatch(url.pathname + url.search, { method: request.method, body: ['GET', 'HEAD'].includes(request.method) ? null : Buffer.from(await request.arrayBuffer()), headers: Object.fromEntries(request.headers) });
      return new Response(request.method === 'HEAD' ? null : result.body, { status: result.status, headers: result.headers });
    });
    const firstBounds = initialHost?.bounds;
    const area = firstBounds && ['x','y','width','height'].every(k => Number.isFinite(firstBounds[k])) && firstBounds.width > 10 && firstBounds.height > 10
      ? toDipRect(firstBounds) : screen.getPrimaryDisplay().workArea;
    // WS_EX_TOOLWINDOW keeps the large transparent overlay out of Chromium's
    // native occlusion calculation even while its opaque pixels accept clicks.
    // Keep normal activation: Chromium's non-client handler consumes the first
    // mouse down (MA_NOACTIVATEANDEAT) when CanActivate/focusable is false.
    window = new BrowserWindow({ ...area, ...(isMac ? { acceptFirstMouse: true } : { type: 'toolbar' }), transparent: true, frame: false, thickFrame: false, resizable: false, maximizable: false, fullscreenable: false, backgroundColor: '#00000000', hasShadow: false, skipTaskbar: true, show: false, title: 'Codex 小龙娘', webPreferences: { preload: path.join(__dirname, 'preload.cjs'), contextIsolation: true, nodeIntegration: false, sandbox: true, backgroundThrottling: false, autoplayPolicy: 'no-user-gesture-required', additionalArguments: harness.extraArguments() } });
    if (usesWindowShape) applyWindowShape(EMPTY_SHAPE);
    if (isMac) {
      if (app.dock) app.dock.hide();
      window.setAlwaysOnTop(true, 'floating', 1);
      window.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true, skipTransformProcessType: true });
    }
    window.setAlwaysOnTop(isMac || mode.state.desktopMode === 'standalone', 'floating');
    if (mode.state.desktopMode === 'standalone') window.setBounds(screen.getPrimaryDisplay().workArea);
    window.webContents.on('render-process-gone', (_event, details) => { renderer.ready = false; visibility(); rendererLifecycle.recoverRenderer('renderer-' + details.reason); });
    window.webContents.on('did-fail-load', (_event, code, _description, _url, isMainFrame) => { if (isMainFrame && code !== -3) rendererLifecycle.recoverRenderer('load-' + code); });
    markStartup('windowCreated');
    window.once('ready-to-show', () => markStartup('frameReady'));
    harness.watchRenderer(window);
    if (!harness.enabled) process.stdout.write(JSON.stringify({ overlayHandle: window.getNativeWindowHandle().readBigUInt64LE().toString() }) + '\n');
    window.setIgnoreMouseEvents(true, { forward: !usesWindowShape });
    window.on('show', () => { diagnose('window-shown'); invalidate(); sendCursor(true); });
    window.on('hide', () => diagnose('window-hidden'));
    window.on('resize', () => {
      invalidate();
      // Keep the previous region while the renderer lays out the new viewport.
      if (usesWindowShape && !window.webContents.isDestroyed()) window.webContents.send('whale-shape-request');
    });
    window.webContents.on('did-start-loading', () => {
      if(quitting || !window || window.isDestroyed())return;
      renderer.ready = false; inputEnabled = false; clearTimeout(renderer.readyTimer); renderer.readyTimer = setTimeout(() => { if (!renderer.ready) rendererLifecycle.recoverRenderer('ready-timeout'); }, 15000);
      if (usesWindowShape) applyWindowShape(EMPTY_SHAPE);
      visibility();
      setKeyboardFocus(false);
      window.setIgnoreMouseEvents(true, { forward: !usesWindowShape });
    });
    window.webContents.setWindowOpenHandler(({ url }) => { openWebLink(url).catch(() => {}); return { action: 'deny' }; });
    window.webContents.on('will-navigate', (event, url) => { if (!url.startsWith(UI_ORIGIN + '/')) event.preventDefault(); });
    session.defaultSession.setPermissionRequestHandler((_web, _permission, callback) => callback(false));
    registerIpcHandlers({ ipcMain, host: ipcHost });
    // Windows uses the native cursor sampler instead of forwarding ignored mouse
    // messages into Chromium, which must not arbitrate the host cursor. The
    // sampler only runs while the window is visible; a hidden widget has no
    // cursor to report and should not wake every 16 ms.
    window.on('show', ensureCursorPoll);
    window.on('hide', stopCursorPoll);
    window.on('closed', stopCursorPoll);
    ensureCursorPoll();
    app.once('will-quit', stopCursorPoll);
    trayController.create();
    ({ toggleRegistered: toggleShortcutRegistered, diagnosticRegistered: diagnosticShortcutRegistered } = registerShortcuts({
      globalShortcut, isMac, toggle, reportVisibility, usesWindowShape, harnessEnabled: harness.enabled, diagnose,
    }));
    bridge = await startBridge(dispatcher, { dataDir, onHost: mode.setHost, onMode: mode.setMode, onResetPosition: resetPosition });
    markStartup('bridgeReady');
    await window.loadURL(UI_ORIGIN + '/widget.html').catch(() => rendererLifecycle.recoverRenderer('initial-load-failed'));
    markStartup('pageLoaded');
    if (mode.state.lastHost) await mode.setHost(mode.state.lastHost);
    // A harness run drives the live window from here and quits when it is done;
    // a normal launch installs the supervisor heartbeat instead.
    if (harness.enabled) await harness.run({
      app, window, screen, setHost: mode.setHost, setTestCursor, dispatcher, dataDir,
      openSettingsWindow: settings.open, settingsWindow: settings.get,
      renderInfo: () => ({ gpuStatus, presents, inputEnabled, keyboardFocus, windowShape, windowShapeError, visibility: visibilityController.snapshot() }),
    });
    else {
      const health=createHeartbeatMonitor({lastSeen:()=>mode.state.hostHeartbeat,onDelayed:()=>diagnose('monitor-heartbeat-delayed'),onRecovered:()=>diagnose('monitor-heartbeat-restored')});
      const supervisorPid=Number(process.env.WHALE_SUPERVISOR_PID);
      const heartbeat=setInterval(()=>{
        const delayed=health.check();
        // Windows GUI Electron stdin can report EOF while its parent lives.
        // Check only the launch-time parent PID, and never terminate that PID.
        if(delayed&&Number.isSafeInteger(supervisorPid)&&supervisorPid>0){try{process.kill(supervisorPid,0);}catch(error){if(error.code==='ESRCH'&&!quitting){diagnose('supervisor-exited');app.quit();}}}
      },2000); app.once('will-quit',()=>clearInterval(heartbeat));
    }
  }).catch(error => { try { save(path.join(dataDir, 'desktop-error.json'), { message: String(error.message).slice(0, 350), at: new Date().toISOString() }); } catch {} app.exit(1); });
  app.on('window-all-closed', () => { if (!quitting && renderer.ready) app.quit(); });
  app.on('before-quit', event => {
    clearTimeout(renderer.readyTimer); clearTimeout(renderer.recoveryTimer);
    event.preventDefault();
    if (quitting) return;
    quitting = true;
    visibilityController.dispose();
    // 退出挂件时一并关闭设置窗口，不遗留第二个窗口。
    settings.close();
    // Do not leave an unresponsive input surface over Codex while saving state.
    try { if (window && !window.isDestroyed()) { window.setIgnoreMouseEvents(true); window.hide(); } } catch {}
    let finished = false;
    const finish = () => {
      if (finished) return; finished = true;
      globalShortcut.unregisterAll(); trayController.destroy();
      // Cleanup above replaces renderer beforeunload: an unresponsive renderer
      // must not be asked to approve quitting a second time.
      app.exit(0);
    };
    const watchdog = setTimeout(finish, 6500);
    shutdownCompanion({
      readRenderer: () => window && !window.isDestroyed() && !window.webContents.isDestroyed() && !window.webContents.isCrashed?.()
        ? window.webContents.executeJavaScript("window.__whaleShutdown?.pendingStorage() || null") : null,
      saveRenderer: patch => uiStore.applyPatch(patch),
      flushState: () => uiStore.flush(),
      closeBridge: () => bridge?.close(),
      closeDispatcher: () => dispatcher?.close(),
    }).then(result => {
      try { save(path.join(dataDir, 'desktop-shutdown.json'), { at: new Date().toISOString(), ...result }); } catch {}
    }).catch(() => {}).finally(() => { clearTimeout(watchdog); finish(); });
  });
}

function resetPosition() {
  if(quitting||!window||window.isDestroyed())return false;
  if(renderer.ready)window.webContents.send('whale-command','reset-position');
  else if(!pendingCommands.includes('reset-position'))pendingCommands.push('reset-position');
  return true;
}
async function openDiagnosticsFolder() {
  try {
    const folder = path.join(dataDir, 'logs');
    fs.mkdirSync(folder, { recursive: true });
    const failure = await shell.openPath(folder);
    return !failure;
  } catch { return false; }
}
