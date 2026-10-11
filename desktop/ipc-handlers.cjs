'use strict';
const { acceptsWindowMessage } = require('./ipc-window.cjs');

// The renderer's IPC surface as one table.
//
// These handlers used to sit inline among window creation, protocol registration
// and tray setup, so the set of channels a buggy or compromised renderer could
// reach was only visible by reading the whole application bootstrap. Everything
// they need from the main process arrives through `host`, whose members are
// functions because the window and the quit flag change over the process's life.
function registerIpcHandlers({ ipcMain, host }) {
  const liveWindow = () => host.window();
  const accepted = event => acceptsWindowMessage(liveWindow(), event, host.quitting());
  const fromMainFrame = event => {
    if (!accepted(event)) return false;
    try { return event.senderFrame === liveWindow().webContents.mainFrame; } catch { return false; }
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
    settings: () => host.sendCommand('settings'),
  };

  ipcMain.on('whale-storage', event => { event.returnValue = accepted(event) ? host.storage() : {}; });
  ipcMain.on('whale-save-storage', (event, input) => { if (accepted(event)) host.storeStorage(input); });
  ipcMain.on('whale-user-gesture', event => { if (fromMainFrame(event)) host.markGesture(); });
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
  ipcMain.handle('whale-open-external', (event, url) => fromMainFrame(event) ? host.openExternal(url) : false);
  ipcMain.handle('whale-command', async (event, command) => {
    if (!fromMainFrame(event)) return false;
    const handler = commands[command];
    return handler ? handler() : false;
  });
}

module.exports = { registerIpcHandlers };
