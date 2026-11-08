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

export function createDisplayModeSelect(document, row, changeMode) {
  const select = document.createElement('select');
  select.id = 'dshw-desktop-display';
  select.className = 'dshwv-sound';
  for (const [value, label] of [['follow-codex', '跟随 Codex'], ['standalone', '常驻桌面']]) {
    const option = document.createElement('option');
    option.value = value;
    option.textContent = label;
    select.appendChild(option);
  }
  select.addEventListener('change', () => changeMode(select.value));
  const help = document.createElement('button');
  help.type = 'button';
  help.className = 'dshwv-fx-info-button';
  help.textContent = '?';
  help.title = '跟随 Codex：随 Codex 窗口显示，窗口最小化时隐藏；退出后下次打开 Codex 时恢复。\n常驻桌面：独立显示在桌面；退出后需要手动启动。两种模式分别保存位置和大小。';
  help.setAttribute('aria-label', help.title);
  row.append(select, help);
  return select;
}
