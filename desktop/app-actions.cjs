const path = require('node:path');

// Small app-level commands shared by the tray, the status dialog and the IPC
// host. They read live state through getters so main.cjs owns no copies.
function createAppActions({ app, dialog, getWindow, dataDir, save, mode, getRendererReady, getRecoveryAttempts }) {
  async function showStatusDialog() {
    const window = getWindow();
    const lines = [
      '平台：' + process.platform,
      '跟随模式：' + (mode.state.lastHost?.followMode || (mode.state.lastHost?.nativeFollowing ? 'native' : '等待 Codex')),
      'Codex PID：' + (mode.state.lastHost?.hostPid || '未检测到'),
      '挂件窗口：' + (window?.isVisible?.() ? '显示' : '隐藏'),
      '桌面模式：' + mode.state.desktopMode,
      '素材就绪：' + getRendererReady(),
      '恢复次数：' + getRecoveryAttempts(),
    ];
    await dialog.showMessageBox({
      type: 'info',
      title: '挂件运行状态',
      message: 'Codex 小龙娘',
      detail: lines.join('\n'),
      buttons: ['关闭'],
    });
  }
  function relaunchApp() { app.relaunch(); app.exit(0); return true; }
  function pauseAndQuit() {
    save(path.join(dataDir, 'pause-until-host-exit.json'), {
      pauseAll: mode.state.desktopMode === 'standalone',
      hostPid: mode.state.lastHost?.hostPid || 0,
      hostSession: mode.state.lastHost?.hostSession || '',
      hostWindow: mode.state.lastHost?.window || '0',
    });
    app.quit();
  }
  return { showStatusDialog, relaunchApp, pauseAndQuit };
}

module.exports = { createAppActions };
