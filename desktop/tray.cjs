// The tray menu is a command table: every item names one action, and the
// labels that depend on desktop mode are computed at build time.
function createTrayController({ Tray, Menu, nativeImage, iconPath, actions }) {
  let tray = null;
  const standalone = () => actions.getMode() === 'standalone';
  function create() {
    if (tray) return tray;
    const icon = nativeImage.createFromPath(iconPath).resize({ width: 24, height: 24 });
    tray = new Tray(icon);
    tray.setToolTip('Codex 小龙娘 · 跟随 Codex');
    update();
    tray.on('double-click', actions.toggle);
    return tray;
  }
  function update() {
    if (!tray) return;
    tray.setToolTip('Codex 小龙娘 · ' + (standalone() ? '独立桌面' : '跟随 Codex'));
    tray.setContextMenu(Menu.buildFromTemplate([
      { label: '显示 / 隐藏小龙娘', click: actions.toggle },
      { label: '恢复显示小龙娘', click: actions.show },
      { label: '移回右下角', click: () => actions.resetPosition() },
      { label: standalone() ? '跟随 Codex' : '常驻桌面', click: () => actions.setMode(standalone() ? 'follow-codex' : 'standalone') },
      { label: '刷新余额', click: () => actions.sendCommand('balance') },
      { label: '查看用量记录', click: () => actions.sendCommand('usage') },
      { label: '小龙娘设置…', click: () => actions.openSettings() },
      { label: '查看运行状态', click: actions.showStatusDialog },
      { type: 'separator' },
      { label: standalone() ? '退出（手动启动后恢复）' : '本次退出（下次打开 Codex 恢复）', click: actions.pauseAndQuit },
    ]));
  }
  function destroy() { try { tray?.destroy(); } catch { /* already gone */ } tray = null; }
  return { create, update, destroy, get tray() { return tray; } };
}

module.exports = { createTrayController };
