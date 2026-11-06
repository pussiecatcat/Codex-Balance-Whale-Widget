import { openOver } from '../../services/layers.js';
// Shared confirmation surface for destructive bubble, role and audio actions.
export function createConfirmDialog({ document }) {
  const mask = document.createElement('div');
  mask.className = 'dshwv-confirmmask';
  mask.style.display = 'none';
  const card = document.createElement('div');
  card.className = 'dshwv-confirmwin';
  const text = document.createElement('div');
  text.className = 'dshwv-confirmtext';
  const buttons = document.createElement('div');
  buttons.className = 'dshwv-confirmbtns';
  const no = document.createElement('button');
  no.type = 'button';
  no.className = 'dshwv-cropbtn dshwv-cropbtn-no';
  no.textContent = '取消';
  const yes = document.createElement('button');
  yes.type = 'button';
  yes.className = 'dshwv-cropbtn dshwv-cropbtn-ok';
  yes.textContent = '删除';
  buttons.appendChild(no);
  buttons.appendChild(yes);
  card.appendChild(text);
  card.appendChild(buttons);
  mask.appendChild(card);
  document.body.appendChild(mask);

  let callback = null;
  const hide = () => { mask.style.display = 'none'; callback = null; };
  no.addEventListener('click', hide);
  yes.addEventListener('click', () => {
    const run = callback;
    hide();
    if (run) run();
  });
  const show = (message, run, okLabel) => {
    callback = run || null;
    text.textContent = message;
    if (!okLabel) okLabel = String(message || '').includes('删除') ? '删除' : '确定';
    yes.textContent = okLabel;
    openOver(null, mask);
    mask.style.display = 'flex';
  };
  return { show, hide, mask };
}
