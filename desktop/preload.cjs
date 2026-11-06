const { contextBridge, ipcRenderer } = require('electron');
// One preload serves both windows. The settings window is created with
// --whale-role=settings, so it gets a much narrower bridge: no click-through,
// no shape, no host-following, only the configuration read/write surface.
const isSettingsWindow = process.argv.includes('--whale-role=settings');
const saved = ipcRenderer.sendSync('whale-storage');
try { for (const [key, value] of Object.entries(saved)) if (localStorage.getItem(key) == null) localStorage.setItem(key, value); } catch {}
let trustedClickAt = 0;
for (const eventName of ['click', 'auxclick']) document.addEventListener(eventName, event => {
  if (!event.isTrusted || (event.button !== 0 && event.button !== 1)) return;
  trustedClickAt = Date.now(); ipcRenderer.send('whale-user-gesture');
}, true);
if (isSettingsWindow) {
  contextBridge.exposeInMainWorld('whaleDesktop', {
    platform: process.platform,
    role: 'settings',
    readSettings: domains => ipcRenderer.invoke('whale-settings-read', { domains }),
    writeSettings: request => ipcRenderer.invoke('whale-settings-write', request),
    previewSettings: request => ipcRenderer.invoke('whale-settings-preview', request),
    settings: {
      read: domains => ipcRenderer.invoke('whale-settings-read', { domains }),
      write: request => ipcRenderer.invoke('whale-settings-write', request),
      preview: request => ipcRenderer.invoke('whale-settings-preview', request),
      onChanged: callback => {
        const listener = (_event, change) => callback(change);
        ipcRenderer.on('whale-settings-changed', listener);
        return () => ipcRenderer.removeListener('whale-settings-changed', listener);
      },
    },
    focusWhale: target => ipcRenderer.invoke('whale-command', target ? 'open-editor' : 'focus-whale', {
      editor: typeof target === 'string' ? target : String(target?.name || ''),
      args: target && typeof target === 'object' && target.args && typeof target.args === 'object' ? target.args : {},
    }),
    resetPosition: () => ipcRenderer.invoke('whale-command', 'reset-position'),
    openLogs: () => ipcRenderer.invoke('whale-command', 'open-logs'),
    onSettingsChanged: callback => {
      const listener = (_event, change) => callback(change);
      ipcRenderer.on('whale-settings-changed', listener);
      return () => ipcRenderer.removeListener('whale-settings-changed', listener);
    },
    onNavigate: callback => ipcRenderer.on('whale-settings-navigate', (_event, target) => callback(target)),
  });
} else contextBridge.exposeInMainWorld('whaleDesktop', {
  platform: process.platform,
  settings: {
    read: domains => ipcRenderer.invoke('whale-settings-read', { domains }),
    write: request => ipcRenderer.invoke('whale-settings-write', request),
    preview: request => ipcRenderer.invoke('whale-settings-preview', request),
    onChanged: callback => {
      const listener = (_event, change) => callback(change);
      ipcRenderer.on('whale-settings-changed', listener);
      return () => ipcRenderer.removeListener('whale-settings-changed', listener);
    },
  },
  ready: () => ipcRenderer.send('whale-ready'),
  keyboardFocus: value => ipcRenderer.send('whale-keyboard-focus', !!value),
  interactive: value => ipcRenderer.send('whale-interactive', !!value),
  shape: rects => ipcRenderer.send('whale-shape', rects),
  onCursor: callback => ipcRenderer.on('whale-cursor', (_event, point) => callback(point)),
  storage: saved,
  save: patch => ipcRenderer.invoke('whale-save-storage', patch),
  command: command => ipcRenderer.invoke('whale-command', command),
  openSettings: page => ipcRenderer.invoke('whale-command', 'open-settings', page),
  onSettingsChanged: callback => {
    const listener = (_event, change) => callback(change);
    ipcRenderer.on('whale-settings-changed', listener);
    return () => ipcRenderer.removeListener('whale-settings-changed', listener);
  },
  openExternal: value => {
    if (!trustedClickAt || Date.now() - trustedClickAt > 1000 || !navigator.userActivation.isActive || typeof value !== 'string') return Promise.resolve(false);
    trustedClickAt = 0;
    return ipcRenderer.invoke('whale-open-external', value);
  },
  testMode: process.argv.includes('--whale-render-test'),
});
ipcRenderer.on('whale-command', (_event, command, payload) => {
  const events = {
    balance: 'whale-refresh',
    usage: 'whale-open-usage',
    settings: 'whale-open-settings',
    'reset-position': 'whale-reset-position',
  };
  if (command === 'open-editor') window.dispatchEvent(new CustomEvent('whale-open-editor', { detail: { editor: payload?.editor || '', args: payload?.args || {} } }));
  else if (events[command]) window.dispatchEvent(new Event(events[command]));
});
ipcRenderer.on('whale-settings-preview', (_event, change) => window.dispatchEvent(new CustomEvent('whale-settings-preview', { detail: change })));

ipcRenderer.on('whale-desktop-mode', (_event, mode) => window.dispatchEvent(new CustomEvent('whale-desktop-mode', { detail: mode })));
ipcRenderer.on('whale-desktop-mode-changing', () => window.dispatchEvent(new Event('whale-mode-changing')));
ipcRenderer.on('whale-shape-request', () => window.dispatchEvent(new Event('whale-shape-request')));
