export function createVisibilityState(root, button) {
  let hidden = false;
  return {
    hide() { hidden = true; root.classList.add('dshwv-whale-hidden'); button.title = '恢复大肥鱼'; },
    restore() {
      if (!hidden) return false;
      hidden = false;
      root.classList.remove('dshwv-whale-hidden');
      button.title = '菜单';
      return true;
    },
  };
}

export function createVisibilityRow({ document, row, hide, confirm, stop }) {
  const hideButton = document.createElement('button');
  hideButton.type = 'button';
  hideButton.className = 'dshwv-sound';
  hideButton.textContent = '隐藏大肥鱼';
  hideButton.addEventListener('click', hide);
  const stopButton = document.createElement('button');
  stopButton.type = 'button';
  stopButton.className = 'dshwv-sound';
  stopButton.textContent = '关闭大肥鱼';
  stopButton.addEventListener('click', () => confirm(
    '关闭后挂件将退出。常驻桌面模式需手动启动；跟随 Codex 模式在下次打开 Codex 时恢复。',
    stop, '关闭大肥鱼'));
  row.append(hideButton, stopButton);
  return row;
}
