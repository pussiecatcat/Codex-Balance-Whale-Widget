export function createRoleManager(deps) {
  const {
    document, window, localStorage, location, Image, rendering,
    imageElement, roleButton, roleButtonLabel, rolePanel, imageUrl,
    assetClient, assetWarning, assetNotice, assetFailure, requireSaved,
    viewport, setupHitTest, makeNameCell, bindNameMarquee, confirm,
  } = deps;
  let current = { id: 'default', name: '小鲸鱼', url: imageUrl };
  let roles = [];
  const badIds = Object.create(null);
  let fallbackInProgress = false;
  let generation = 0;
  const nameDisposers = [];

  function roleUrl(id) {
    return id === 'default' ? imageUrl : '/dsh-whale/role-image.png?id=' + encodeURIComponent(id);
  }

  function close() {
    rolePanel.classList.remove('dshwv-rolelist-open');
    rolePanel.style.display = 'none';
  }

  function toggle() {
    if (rolePanel.classList.contains('dshwv-rolelist-open')) {
      close();
      return;
    }
    try {
      const bounds = roleButton.getBoundingClientRect();
      const area = viewport();
      const width = Math.max(200, Math.round(bounds.width));
      rolePanel.style.width = width + 'px';
      rolePanel.style.left = Math.max(4, Math.min(bounds.left, area.w - width - 4)) + 'px';
      rolePanel.style.top = bounds.bottom + 6 + 'px';
      rolePanel.style.display = 'block';
      rolePanel.classList.add('dshwv-rolelist-open');
    } catch (error) {}
  }

  function render() {
    try {
      // Rebuilding the list detaches whichever row the pointer was over, and a
      // detached row never fires mouseleave — release its marquee first.
      for (const dispose of nameDisposers.splice(0)) { try { dispose(); } catch (error) {} }
      rolePanel.innerHTML = '';
      for (const role of roles) {
        const item = document.createElement('div');
        item.className = 'dshwv-roleitem' + (current.id === role.id ? ' dshwv-roleitem-cur' : '');
        const thumb = document.createElement('img');
        thumb.className = 'dshwv-rolethumb';
        thumb.src = role.url;
        thumb.alt = '';
        thumb.draggable = false;
        const name = makeNameCell('dshwv-rolename', role.name);
        const nameWrap = document.createElement('span');
        nameWrap.className = 'dshwv-rolenamewrap';
        if (role.format === 'gif' || role.format === 'apng') {
          const tag = document.createElement('span');
          tag.className = 'dshwv-roleGifTag';
          tag.textContent = role.format === 'apng' ? 'APNG' : 'GIF';
          nameWrap.appendChild(tag);
        }
        nameWrap.appendChild(name);
        item.appendChild(thumb);
        item.appendChild(nameWrap);
        const pin = document.createElement('button');
        pin.type = 'button';
        pin.className = 'dshwv-rolepin' + (role.pinned ? ' on' : '');
        pin.textContent = '📌';
        pin.title = role.pinned ? '取消置顶' : '置顶';
        pin.addEventListener('click', event => {
          event.stopPropagation();
          togglePin(role.id, !role.pinned);
        });
        item.appendChild(pin);
        if (role.id !== 'default') {
          const remove = document.createElement('button');
          remove.type = 'button';
          remove.className = 'dshwv-roledel';
          remove.textContent = '✕';
          remove.title = '删除角色';
          remove.addEventListener('click', event => {
            event.stopPropagation();
            deleteRole(role.id);
          });
          item.appendChild(remove);
        }
        item.addEventListener('click', () => apply(role.id, role.name, roleUrl(role.id)));
        const releaseName = bindNameMarquee(item, name);
        if (typeof releaseName === 'function') nameDisposers.push(releaseName);
        rolePanel.appendChild(item);
      }
    } catch (error) {}
  }

  function apply(id, name, url, isFallback = false) {
    const requestGeneration = ++generation;
    const readyImage = new Image();
    readyImage.src = url;
    return Promise.all([readyImage.decode(), rendering.hitCache.prepare(url)]).then(() => {
      if (requestGeneration !== generation) return false;
      current = { id, name, url };
      imageElement.src = url;
      roleButtonLabel.textContent = name;
      try { localStorage.setItem('dshw-role', id); } catch (error) {}
      setupHitTest(url);
      close();
      render();
      rendering.presentFor(200);
      delete badIds[id];
      fallbackInProgress = false;
      if (isFallback) assetNotice('原角色图片无法显示，已切回小鲸鱼；可在角色菜单重新选择');
      return true;
    }).catch(() => {
      if (requestGeneration !== generation) return false;
      badIds[id] = true;
      fallbackInProgress = false;
      assetNotice(isFallback ? '内置小鲸鱼图片加载失败，请重启挂件或重新安装' : '角色图片无法读取，已保留原角色');
      if (!isFallback) recover();
      return false;
    });
  }

  function recover() {
    if (fallbackInProgress || imageElement.complete && imageElement.naturalWidth > 0) return;
    let failedId = current.id;
    try { failedId = localStorage.getItem('dshw-role') || failedId; } catch (error) {}
    if (failedId && failedId !== 'default') badIds[failedId] = true;
    if (new URL(imageElement.currentSrc || imageElement.src, location.href).href === new URL(imageUrl, location.href).href) {
      assetNotice('内置小鲸鱼图片加载失败，请重启挂件或重新安装');
      return;
    }
    fallbackInProgress = true;
    apply('default', '小鲸鱼', imageUrl, true);
  }

  function replace(nextRoles) {
    roles = Array.isArray(nextRoles) ? nextRoles : [];
    render();
  }

  function useImported(nextRoles) {
    replace(nextRoles);
    let newest = null;
    for (const role of roles) if (role.id !== 'default' && (!newest || role.createdAt > newest.createdAt)) newest = role;
    if (newest) apply(newest.id, newest.name, roleUrl(newest.id));
  }

  function handleDeleted(id, nextRoles) {
    replace(nextRoles);
    if (current.id === id) apply('default', '小鲸鱼', imageUrl);
  }

  function load() {
    try {
      assetClient.roles().then(data => {
        if (!data) return;
        replace(data.roles);
        assetWarning(data);
        if (fallbackInProgress) return;
        let saved = '';
        try { saved = localStorage.getItem('dshw-role') || ''; } catch (error) {}
        const found = roles.find(role => role.id === saved) || null;
        if (found && !badIds[found.id]) {
          if (current.id !== found.id) apply(found.id, found.name, found.url);
          else render();
        } else if (saved && saved !== 'default') apply('default', '小鲸鱼', imageUrl);
      }).catch(() => {});
    } catch (error) {}
  }

  function togglePin(id, pinned) {
    try {
      window.fetch('/dsh-whale/role-pin.json', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, pinned }),
      }).then(response => response.json()).then(data => {
        requireSaved(data);
        if (data?.ok && Array.isArray(data.roles)) replace(data.roles);
      }).catch(assetFailure);
    } catch (error) { assetFailure(error); }
  }

  function deleteRole(id) {
    const role = roles.find(item => item.id === id) || null;
    confirm('确定删除角色「' + (role ? role.name : id) + '」吗？', () => {
      try {
        window.fetch('/dsh-whale/role-delete.json', {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }),
        }).then(response => response.json()).then(data => {
          requireSaved(data);
          if (data?.ok && Array.isArray(data.roles)) handleDeleted(id, data.roles);
        }).catch(assetFailure);
      } catch (error) { assetFailure(error); }
    });
  }

  window.addEventListener('whale-role-fallback', recover);
  return Object.freeze({ apply, close, toggle, render, load, replace, useImported, handleDeleted,
    current: () => ({ ...current }), roles: () => roles.map(role => ({ ...role })) });
}
