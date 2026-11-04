'use strict';
const { acceptsWindowMessage, senderRole, isMainFrameFromRole } = require('./ipc-window.cjs');

// The renderer's IPC surface as one table.
//
// These handlers used to sit inline among window creation, protocol registration
// and tray setup, so the set of channels a buggy or compromised renderer could
// reach was only visible by reading the whole application bootstrap. Everything
// they need from the main process arrives through `host`, whose members are
// functions because the window and the quit flag change over the process's life.
//
// 两个窗口（挂件 / 设置）共享这些通道：「这条消息是谁发的」由 senderRole 判定。
// 挂件专用通道（shape、interactive、ready、storage）只认挂件窗口；设置窗口只拿
// 配置读写和两个白名单命令，拿不到裁切、穿透、宿主跟随等任何挂件能力。
function registerIpcHandlers({ ipcMain, host }) {
  const windows = () => host.windows();
  const roleOf = event => senderRole(event, windows(), host.quitting());
  const fromRole = (event, role) => isMainFrameFromRole(event, role, windows(), host.quitting());
  // 挂件窗口专属通道沿用单窗口判定：liveWindow 之外一律拒绝。
  const accepted = event => acceptsWindowMessage(host.window(), event, host.quitting());
  const fromMainFrame = event => {
    if (!accepted(event)) return false;
    try { return event.senderFrame === host.window().webContents.mainFrame; } catch { return false; }
  };

  // Commands the tray and the CLI send into the window. An unknown command still
  // answers false rather than throwing, which is the contract the renderer reads.
  const commands = {
    desktop: () => host.setMode('standalone'),
    follow: () => host.setMode('follow-codex'),
    mode: () => host.desktopMode(),
    show: () => { host.show(); return true; },
    status: async () => { await host.showStatusDialog(); return true; },
    stop: () => { host.pauseAndQuit(); return true; },
    'reset-position': () => host.resetPosition(),
    balance: () => host.sendCommand('balance'),
    usage: () => host.sendCommand('usage'),
    settings: () => host.openSettings(),
    'open-settings': payload => host.openSettings(typeof payload === 'string' ? payload : undefined),
  };
  // 设置窗口唯一被允许的通用命令：点亮鲸鱼并唤起它自己的编辑器弹层。
  const settingsCommands = {
    'focus-whale': () => { host.show(); return true; },
    'open-editor': payload => { host.show(); return host.sendCommand('open-editor', { editor: typeof payload?.editor === 'string' ? payload.editor : '' }); },
  };

  ipcMain.on('whale-storage', event => { event.returnValue = accepted(event) ? host.storage() : {}; });
  ipcMain.handle('whale-save-storage', (event, input) => accepted(event) ? host.storeStorage(input) : { ok: false });
  ipcMain.on('whale-user-gesture', event => { if (fromMainFrame(event) || fromRole(event, 'settings')) host.markGesture(); });
  ipcMain.on('whale-shape', (event, rects) => { if (fromMainFrame(event)) host.applyShape(rects); });
  ipcMain.on('whale-ready', event => { if (accepted(event)) host.rendererReady(); });
  ipcMain.on('whale-keyboard-focus', (event, editing) => {
    if (accepted(event) && typeof editing === 'boolean') host.setKeyboardFocus(editing);
  });
  ipcMain.on('whale-interactive', (event, enabled) => {
    // The window-shape precondition and the no-op case stay in the host, which
    // owns that state. They are independent of the type check, so the order does
    // not change which messages take effect.
    if (!accepted(event) || typeof enabled !== 'boolean') return;
    host.setInteractive(enabled);
  });
  ipcMain.handle('whale-open-external', (event, url) => {
    // 手动点击是硬要求：设置窗口没有 preload 里那层 trustedClickAt 兜底。
    if (roleOf(event) === 'settings' && !host.gestureFresh()) return false;
    return fromMainFrame(event) || fromRole(event, 'settings') ? host.openExternal(url) : false;
  });
  ipcMain.handle('whale-command', async (event, command, payload) => {
    const role = roleOf(event);
    if (!fromRole(event, role)) return false;
    // 设置窗口不能改运行方式、不能退出，只能要求点亮鲸鱼并唤起编辑器。
    if (role === 'settings') {
      const handler = settingsCommands[command];
      return handler ? handler(payload) : false;
    }
    const handler = commands[command];
    return handler ? handler(payload) : false;
  });
  // 设置窗口专用：读写配置。它走主进程的 SettingsStore，挂件和设置页共用一条写路径。
  ipcMain.handle('whale-settings-read', async (event, request) => {
    if (!fromRole(event, 'settings') || !host.settingsStore()) return { ok: false, error: '设置未就绪' };
    try { return { ok: true, values: await host.settingsStore().read(request?.domains || 'size') }; }
    catch (error) { return { ok: false, error: error?.message || '读取设置失败' }; }
  });
  ipcMain.handle('whale-settings-write', async (event, request) => {
    if (!fromRole(event, 'settings') || !host.settingsStore()) return { ok: false, error: '设置未就绪' };
    try { return await host.settingsStore().save(request || {}); }
    catch (error) { return { ok: false, error: error?.message || '保存设置失败' }; }
  });
  ipcMain.handle('whale-settings-preview', async (event, request) => {
    if (!fromRole(event, 'settings') || !host.settingsStore()) return { ok: false, error: '设置未就绪' };
    try { return await host.settingsStore().preview(request || {}); }
    catch (error) { return { ok: false, error: error?.message || '预览失败' }; }
  });
}

module.exports = { registerIpcHandlers };
