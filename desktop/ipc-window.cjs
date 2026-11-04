// IPC 发送方校验。
//
// 挂件窗口和设置窗口是同一个进程里的两个 BrowserWindow，共享一套 ipcMain
// 通道，所以「这条消息是谁发的」必须在每个通道上单独判定：设置窗口只拿到配置
// 相关能力，挂件专用的裁切、鼠标穿透、宿主跟随等消息不能因为多开一个窗口就放行。
function acceptsWindowMessage(window, event, quitting = false) {
  if (quitting || !window || window.isDestroyed()) return false;
  try { const contents = window.webContents; return !!contents && !contents.isDestroyed() && event.sender === contents; } catch { return false; }
}

/**
 * 把事件来源解析成窗口角色。
 * @returns {'widget'|'settings'|null}
 */
function senderRole(event, { widget, settings } = {}, quitting = false) {
  if (quitting) return null;
  // 设置窗口先判：它一定不是挂件，两者的 webContents 互不相同。
  if (acceptsWindowMessage(settings, event)) return 'settings';
  if (acceptsWindowMessage(widget, event)) return 'widget';
  return null;
}

/** 角色匹配，并且必须来自该窗口的主框架（拒绝 iframe / worker）。 */
function isMainFrameFrom(event, window, quitting = false) {
  if (!acceptsWindowMessage(window, event, quitting)) return false;
  try { return event.senderFrame === window.webContents.mainFrame; } catch { return false; }
}

function isMainFrameFromRole(event, role, windows, quitting = false) {
  const win = role === 'settings' ? windows.settings : role === 'widget' ? windows.widget : null;
  return !!win && isMainFrameFrom(event, win, quitting);
}

module.exports = { acceptsWindowMessage, senderRole, isMainFrameFrom, isMainFrameFromRole };
