const HELP_ID = 'dshwv-bubadvance-help';
const HELP_BUTTON_ID = 'dshwv-bubadvance-help-button';

// Keeps the explanation outside the scrollable editor card so it is not clipped.
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
  helpButton.id = HELP_BUTTON_ID;
  helpButton.className = 'dshwv-bubadvance-q dshwv-askq dshwv-tplq';
  helpButton.textContent = '?';
  helpButton.setAttribute('aria-label', '查看点按角色推进泡泡队列说明');
  helpButton.setAttribute('aria-controls', HELP_ID);
  helpButton.setAttribute('aria-expanded', 'false');
  helpButton.style.marginLeft = '0';
  helpButton.style.marginRight = '0';
  row.appendChild(helpButton);

  const popover = document.createElement('div');
  popover.id = HELP_ID;
  popover.className = 'dshwv-bubadvance-pop dshwv-tplhelp dshwv-hintbox';
  popover.setAttribute('role', 'region');
  popover.setAttribute('aria-labelledby', HELP_BUTTON_ID);
  popover.setAttribute('aria-hidden', 'true');
  popover.innerHTML =
    '关闭（默认）：<b>点角色</b>＝回到第 1 个泡泡（点泡泡才是往后推进）。<br><br>' +
    '开启：<b>点一下角色 = 往后推进一项</b>（不再回到首次点击泡泡）；走到最后一项再点＝收起泡泡。';
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
    const margin = 8;
    const gap = 8;
    const safeLeft = margin;
    const safeRight = area.w - margin;
    const safeTop = margin;
    const safeBottom = area.h - margin;
    // The reference screenshot is captured at 150% Windows scaling: its
    // roughly 540 physical pixels correspond to a 360 CSS-pixel panel.
    const width = Math.max(0, Math.min(360, safeRight - safeLeft));
    popover.style.width = Math.round(width) + 'px';
    popover.style.maxWidth = Math.round(width) + 'px';
    const height = popover.offsetHeight || 112;
    const left = Math.max(safeLeft, Math.min(bounds.left, safeRight - width));
    let top = bounds.bottom + gap;
    if (top + height > safeBottom) top = bounds.top - height - gap;
    top = Math.max(safeTop, Math.min(top, safeBottom - height));
    popover.style.left = Math.round(left) + 'px';
    popover.style.top = Math.round(top) + 'px';
  }

  function showHelp() {
    clearHideTimer();
    popover.style.display = 'block';
    helpButton.setAttribute('aria-expanded', 'true');
    popover.setAttribute('aria-hidden', 'false');
    positionHelp();
  }

  function hideHelp(force = true) {
    clearHideTimer();
    if (!force && (pinned || overButton || overPopover || document.activeElement === helpButton)) return;
    pinned = false;
    popover.style.display = 'none';
    helpButton.setAttribute('aria-expanded', 'false');
    popover.setAttribute('aria-hidden', 'true');
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
  const repositionVisible = () => {
    if (popover.style.display === 'block') positionHelp();
  };
  document.addEventListener('scroll', repositionVisible, true);
  document.defaultView?.addEventListener?.('resize', repositionVisible);

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
