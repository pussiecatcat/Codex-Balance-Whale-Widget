import { openOver } from '../../services/layers.js';
// The press/release fragment picker. Values and DOM stay in the caller; this
// module owns the panel lifecycle and the list of available fragments.
export function createAudioSlotPanel({
  document, viewport, getFragments, getPress, getRelease, setPress, setRelease,
  getPressBtn, getReleaseBtn, getPressPanel, getReleasePanel, makeNameCell,
  bindNameMarquee, previewEnsure, deleteFragment,
}) {
  let activePanel = null;

  function slotName(id) {
    const fragment = getFragments().find(item => item.id === id);
    return fragment ? fragment.name : id;
  }
  function slotBtnText(btn, id) {
    try {
      const text = slotName(id);
      btn.style.opacity = text ? '' : '.55';
      btn.textContent = text || '留空·不发声';
      btn.title = '留空则该事件不发声;点击可选择音频片段';
    } catch (error) { return btn; }
  }
  function refresh() {
    slotBtnText(getPressBtn(), getPress());
    slotBtnText(getReleaseBtn(), getRelease());
  }
  function close() {
    const press = getPressPanel(), release = getReleasePanel();
    if (press) press.style.display = 'none';
    if (release) release.style.display = 'none';
    activePanel = null;
  }
  function apply(slot, id) {
    if (slot === 'press') { setPress(id); slotBtnText(getPressBtn(), id); }
    else { setRelease(id); slotBtnText(getReleaseBtn(), id); }
    previewEnsure(true);
    close();
  }
  function render(slot) {
    try {
      const panel = slot === 'press' ? getPressPanel() : getReleasePanel();
      const current = slot === 'press' ? getPress() : getRelease();
      panel.innerHTML = '';
      const emptyItem = document.createElement('div');
      emptyItem.className = 'dshwv-audioitem' + (!current ? ' dshwv-audioitem-cur' : '');
      const emptyIcon = document.createElement('span');
      emptyIcon.className = 'dshwv-audiothumb dshwv-audiothumb-empty';
      emptyIcon.setAttribute('aria-hidden', 'true');
      emptyItem.appendChild(emptyIcon);
      const emptyName = makeNameCell('dshwv-audioname', '留空（不发声）');
      emptyItem.appendChild(emptyName);
      emptyItem.addEventListener('click', () => { apply(slot, ''); });
      bindNameMarquee(emptyItem, emptyName);
      panel.appendChild(emptyItem);
      for (const fragment of getFragments()) {
        const item = document.createElement('div');
        item.className = 'dshwv-audioitem' + (current === fragment.id ? ' dshwv-audioitem-cur' : '');
        const thumb = document.createElement('span');
        thumb.className = 'dshwv-audiothumb';
        thumb.setAttribute('aria-hidden', 'true');
        item.appendChild(thumb);
        const name = makeNameCell('dshwv-audioname', fragment.name);
        item.appendChild(name);
        if (fragment.preset) {
          const tag = document.createElement('span');
          tag.className = 'dshwv-audiopreset';
          tag.textContent = '预设';
          item.appendChild(tag);
        } else {
          const del = document.createElement('button');
          del.type = 'button';
          del.className = 'dshwv-audiodel';
          del.textContent = '✕';
          del.title = '删除该音频';
          del.addEventListener('click', event => { event.stopPropagation(); deleteFragment(slot, fragment.id); });
          item.appendChild(del);
        }
        item.addEventListener('click', () => { apply(slot, fragment.id); });
        bindNameMarquee(item, name);
        panel.appendChild(item);
      }
    } catch (error) { return; }
  }
  function toggle(slot) {
    const btn = slot === 'press' ? getPressBtn() : getReleaseBtn();
    const panel = slot === 'press' ? getPressPanel() : getReleasePanel();
    if (activePanel === panel) { close(); return; }
    close();
    activePanel = panel;
    render(slot);
    try {
      const bounds = btn.getBoundingClientRect();
      const vp = viewport();
      const width = Math.max(120, Math.round(bounds.width));
      panel.style.width = width + 'px';
      panel.style.left = Math.max(4, Math.min(bounds.left, vp.w - width - 4)) + 'px';
      panel.style.top = bounds.bottom + 4 + 'px';
      openOver(null, panel);
      panel.style.display = 'block';
    } catch (error) { return; }
  }
  return { toggle, close, render, refresh };
}
