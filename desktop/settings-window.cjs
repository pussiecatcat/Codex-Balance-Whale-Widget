const path = require('node:path');

// Owns the settings BrowserWindow: creation, navigation, unload confirmation and
// the preview reset on close. main.cjs keeps only the manager instance.
function createSettingsWindowManager({
  BrowserWindow, screen, dialog, harness, uiOrigin,
  openWebLink, previewSettings, getSettingsStore, isQuitting,
  showWidget, sendCommand, getWidgetWindow,
}) {
  let settingsWindow = null;
  const preload = path.join(__dirname, 'preload.cjs');

  function open(page) {
    if (settingsWindow && !settingsWindow.isDestroyed()) {
      if (settingsWindow.isMinimized()) settingsWindow.restore();
      settingsWindow.show();
      settingsWindow.focus();
      if (page) settingsWindow.webContents.send('whale-settings-navigate', { page });
      return settingsWindow;
    }
    const display = screen.getPrimaryDisplay();
    const work = display.workArea;
    // 方案建议 960×720，但真实尺寸必须落在显示器工作区内，小屏允许更小。
    const width = Math.max(560, Math.min(960, work.width - 40));
    const height = Math.max(420, Math.min(720, work.height - 60));
    const x = Math.max(work.x, Math.round(work.x + (work.width - width) / 2));
    const y = Math.max(work.y, Math.round(work.y + (work.height - height) / 3));
    settingsWindow = new BrowserWindow({
      x, y, width, height, minWidth: 560, minHeight: 420,
      title: '小龙娘设置', show: false, resizable: true, minimizable: true, maximizable: true, fullscreenable: false,
      backgroundColor: '#f6f8fd',
      autoHideMenuBar: true,
      webPreferences: {
        preload,
        contextIsolation: true, nodeIntegration: false, sandbox: true,
        // 与挂件同一个 preload，靠这个参数区分窗口角色。
        additionalArguments: harness.enabled ? ['--whale-render-test', '--whale-role=settings'] : ['--whale-role=settings'],
      },
    });
    const target = settingsWindow;
    // 这两个守卫是 per-webContents 的，不会从挂件窗口继承，必须重新注册。
    target.webContents.setWindowOpenHandler(({ url }) => { openWebLink(url).catch(() => {}); return { action: 'deny' }; });
    target.webContents.on('will-navigate', (event, url) => { if (!url.startsWith(uiOrigin + '/')) event.preventDefault(); });
    // beforeunload 只负责「有未保存修改」的判断；Electron 遇到它不会自己弹框，
    // 这里补上选择框。preventDefault 表示放行关闭。
    target.webContents.on('will-prevent-unload', event => {
      // 退出应用时不弹框，直接放行，避免退出被草稿卡住。
      if (isQuitting()) { event.preventDefault(); return; }
      const choice = dialog.showMessageBoxSync(target, {
        type: 'warning',
        buttons: ['继续编辑', '放弃修改并关闭'],
        defaultId: 0,
        cancelId: 0,
        noLink: true,
        title: '还有未保存的修改',
        message: '关闭设置窗口会丢弃这些修改。',
        detail: '「继续编辑」返回设置窗口；「放弃修改并关闭」直接关闭，草稿不会保存。',
      });
      if (choice === 1) event.preventDefault();
    });
    target.once('ready-to-show', () => { if (!target.isDestroyed()) target.show(); });
    target.on('closed', () => {
      if (settingsWindow === target) settingsWindow = null;
      // 关闭时丢弃未保存的预览：读回磁盘值再让挂件应用一次。
      const store = getSettingsStore();
      if (store) {
        store.read(['size'])
          .then(values => preview({ domain: 'size', values: values.size }))
          .catch(() => {});
      }
    });
    harness.watchRenderer(target);
    target.loadURL(uiOrigin + '/settings.html' + (page ? '#' + page : '')).catch(() => { if (settingsWindow === target) settingsWindow = null; });
    return settingsWindow;
  }

  function close() {
    if (settingsWindow && !settingsWindow.isDestroyed()) settingsWindow.destroy();
    settingsWindow = null;
  }

  // 设置窗口点「打开编辑器」时，普通窗口会压住透明挂件，先最小化自己再点亮鲸鱼。
  function openEditor(payload) {
    if (!payload || !payload.editor) return false;
    showWidget();
    const target = settingsWindow;
    if (target && !target.isDestroyed() && !target.isMinimized()) target.minimize();
    return sendCommand('open-editor', { editor: payload.editor, args: payload.args || {} });
  }

  // 设置窗口拖动大小/音量时的临时预览：只广播给挂件，不写任何配置文件。
  function preview(change) {
    if (!change || !change.domain) return false;
    const widget = getWidgetWindow();
    if (!widget || widget.isDestroyed() || widget.webContents.isDestroyed()) return false;
    widget.webContents.send('whale-settings-preview', change);
    return true;
  }

  return { open, close, get: () => settingsWindow, openEditor, preview };
}

module.exports = { createSettingsWindowManager };
