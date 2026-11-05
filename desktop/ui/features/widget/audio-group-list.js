// The compact audio-group list: names, preset tags, pin/delete actions and the
// current group highlight. The editor and playback live elsewhere.
export function createAudioGroupList({
  document, requestJson, url, getGroups, setGroups, getSoundSet, setSoundSet,
  getPanel, closePanel, makeNameCell, bindNameMarquee, requireSaved, assetFailure,
  showConfirm, refreshTaskEnd,
}) {
  function pinGroup(id, pinned) {
    try {
      requestJson(url, { method: 'POST', body: { action: 'pin-group', id, pinned } }).then(data => {
        requireSaved(data);
        if (data && data.ok && Array.isArray(data.groups)) {
          setGroups(data.groups);
          render();
          refreshTaskEnd();
        }
      }).catch(assetFailure);
    } catch (error) { assetFailure(error); }
  }

  function deleteGroup(id) {
    const group = getGroups().find(item => item.id === id) || null;
    showConfirm('确定删除音效组「' + (group ? group.name : id) + '」吗？', () => {
      try {
        requestJson(url, { method: 'POST', body: { action: 'delete-group', id } }).then(data => {
          requireSaved(data);
          if (data && data.ok && Array.isArray(data.groups)) {
            setGroups(data.groups);
            render();
            refreshTaskEnd();
            if (getSoundSet() === id) setSoundSet('duck');
          }
        }).catch(assetFailure);
      } catch (error) { assetFailure(error); }
    });
  }

  function render() {
    try {
      const panel = getPanel();
      panel.innerHTML = '';
      for (const group of getGroups()) {
        const item = document.createElement('div');
        item.className = 'dshwv-audioitem' + (getSoundSet() === group.id ? ' dshwv-audioitem-cur' : '');
        const thumb = document.createElement('span');
        thumb.className = 'dshwv-audiothumb';
        thumb.setAttribute('aria-hidden', 'true');
        item.appendChild(thumb);
        const name = makeNameCell('dshwv-audioname', group.name);
        item.appendChild(name);
        if (group.preset) {
          const tag = document.createElement('span');
          tag.className = 'dshwv-audiopreset';
          tag.textContent = '预设';
          item.appendChild(tag);
        } else {
          const pin = document.createElement('button');
          pin.type = 'button';
          pin.className = 'dshwv-audiopin' + (group.pinned ? ' on' : '');
          pin.textContent = '📌';
          pin.title = group.pinned ? '取消置顶' : '置顶';
          pin.addEventListener('click', event => { event.stopPropagation(); pinGroup(group.id, !group.pinned); });
          item.appendChild(pin);
          const del = document.createElement('button');
          del.type = 'button';
          del.className = 'dshwv-audiodel';
          del.textContent = '✕';
          del.title = '删除音效组';
          del.addEventListener('click', event => { event.stopPropagation(); deleteGroup(group.id); });
          item.appendChild(del);
        }
        item.addEventListener('click', () => { setSoundSet(group.id); closePanel(); });
        bindNameMarquee(item, name);
        panel.appendChild(item);
      }
    } catch (error) { assetFailure(error); }
  }

  return { render };
}
