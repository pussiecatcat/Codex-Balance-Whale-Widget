const HELP_ID = 'dshwv-bubadvance-help';

// Builds the queue-advance setting and keeps its explanatory popover outside
// the scrollable editor card so the help text is never clipped.
export function createBubbleAdvanceControl({ document, viewport, onChange }) {
  const row = document.createElement('div');
  row.className = 'dshwv-bubadvance';

  const label = document.createElement('label');
  label.className = 'dshwv-bubadvance-label';
  const input = document.createElement('input');
  input.type = 'checkbox';
  input.className = 'dshwv-check dshwv-bubadvance-check';
  input.setAttribute('aria-describedby', HELP_ID);
  const text = document.createElement('span');
  text.textContent = '点按角色推进泡泡队列';
  label.appendChild(input);
  label.appendChild(text);
  row.appendChild(label);

  const helpButton = document.createElement('button');
  helpButton.type = 'button';
  helpButton.className = 'dshwv-bubadvance-q';
  helpButton.textContent = '?';
  helpButton.title = '查看点按角色时的泡泡队列规则';
  helpButton.setAttribute('aria-label', helpButton.title);
  helpButton.setAttribute('aria-controls', HELP_ID);
  helpButton.setAttribute('aria-expanded', 'false');
  row.appendChild(helpButton);

  const popover = document.createElement('div');
  popover.id = HELP_ID;
  popover.className = 'dshwv-bubadvance-pop';
  popover.setAttribute('role', 'tooltip');
  popover.innerHTML =
    '<p>关闭（默认）：<strong>点角色</strong> = 回到第 1 个泡泡（点泡泡才是往后推进）。</p>' +
    '<p>开启：<strong>点一下角色 = 往后推进一项</strong>（不再回到首次点击泡泡）；走到最后一项再点 = 收起泡泡。</p>';
  document.body.appendChild(popover);

  let pinned = false;
  let overButton = false;
  let overPopover = false;
  let hideTimer = null;

  function clearHideTimer() {
    if (hideTimer !== null) clearTimeout(hideTimer);
    hideTimer = null;
  }

  function positionHelp() {
    const bounds = helpButton.getBoundingClientRect();
    const area = viewport();
    const width = Math.min(360, Math.max(220, area.w - 16));
    const height = popover.offsetHeight || 112;
    let left = bounds.left;
    let top = bounds.bottom + 8;
    left = Math.max(8, Math.min(left, area.w - width - 8));
    if (top + height > area.h - 8) top = Math.max(8, bounds.top - height - 8);
    popover.style.width = Math.round(width) + 'px';
    popover.style.left = Math.round(left) + 'px';
    popover.style.top = Math.round(top) + 'px';
  }

  function showHelp() {
    clearHideTimer();
    popover.style.display = 'block';
    helpButton.setAttribute('aria-expanded', 'true');
    positionHelp();
  }

  function hideHelp(force = true) {
    clearHideTimer();
    if (!force && (pinned || overButton || overPopover || document.activeElement === helpButton)) return;
    pinned = false;
    popover.style.display = 'none';
    helpButton.setAttribute('aria-expanded', 'false');
  }

  function scheduleHide() {
    clearHideTimer();
    hideTimer = setTimeout(() => hideHelp(false), 90);
  }

  input.addEventListener('change', () => onChange?.(input.checked));
  helpButton.addEventListener('mouseenter', () => { overButton = true; showHelp(); });
  helpButton.addEventListener('mouseleave', () => { overButton = false; scheduleHide(); });
  helpButton.addEventListener('focus', showHelp);
  helpButton.addEventListener('blur', scheduleHide);
  helpButton.addEventListener('click', event => {
    event.stopPropagation();
    if (pinned) {
      hideHelp();
      return;
    }
    pinned = true;
    showHelp();
  });
  popover.addEventListener('mouseenter', () => { overPopover = true; clearHideTimer(); });
  popover.addEventListener('mouseleave', () => { overPopover = false; scheduleHide(); });
  document.addEventListener('pointerdown', event => {
    if (event.target === helpButton || event.target === popover || popover.contains?.(event.target)) return;
    hideHelp();
  }, true);
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape') hideHelp();
  });

  return Object.freeze({
    element: row,
    input,
    helpButton,
    popover,
    getValue: () => input.checked,
    setValue(value) { input.checked = value === true; },
    showHelp,
    hideHelp,
  });
}
