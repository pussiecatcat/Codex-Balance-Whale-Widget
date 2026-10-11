// Catalogue and deletion UI for role art, bubble images, and sound assets.
// Each successful mutation reports the new catalogue to its owning editor.
export function createResourceManager({ document, client, confirm, requireSaved, onError, onRoleDelete,
  onBubbleImageDelete, onAudioGroupDelete, onAudioFragmentDelete }) {
  let mask = null, card = null, generation = 0;
  function node(tag, className, text) {
    const element = document.createElement(tag);
    element.className = className;
    if (text != null) element.textContent = text;
    return element;
  }
  function button(label, className, action, disabled = false) {
    const element = node('button', className, label);
    element.type = 'button';
    element.disabled = disabled;
    if (!disabled) element.addEventListener('click', event => { event.stopPropagation(); action(); });
    return element;
  }
  function ensure() {
    if (mask) return;
    mask = node('div', 'dshwv-resmask');
    mask.style.display = 'none';
    card = node('div', 'dshwv-usage-card dshwv-rescard');
    mask.appendChild(card);
    mask.addEventListener('click', event => { if (event.target === mask) close(); });
    document.body.appendChild(mask);
  }
  function close() { if (mask) mask.style.display = 'none'; }
  function tag(text, built) { return node('span', 'dshwv-restag' + (built ? ' dshwv-restag-built' : ''), text); }
  function row(icon, name, meta, suffix) {
    const result = node('div', 'dshwv-resrow');
    const left = node('div', 'dshwv-resmain');
    left.style.display = 'flex'; left.style.alignItems = 'center'; left.style.gap = '8px';
    const thumb = icon.url ? node('img', 'dshwv-resthum') : node('div', 'dshwv-resicon', icon.text);
    if (icon.url) { thumb.src = icon.url; thumb.alt = ''; }
    const main = node('div', 'dshwv-resmain'); main.style.minWidth = '0';
    main.appendChild(node('div', 'dshwv-resnm', name));
    if (meta) main.appendChild(node('div', 'dshwv-resmeta', meta));
    left.append(thumb, main); result.appendChild(left);
    for (const element of suffix) result.appendChild(element);
    return result;
  }
  function deleteAsset(kind, item) {
    const names = {
      role: `确定删除角色「${item.name || item.id}」吗？\n若该角色正被使用,将自动回退默认小鲸鱼。`,
      image: `确定删除泡泡图「${item.name || item.id}」吗？\n正在引用该图的泡泡行将无法显示。`,
      group: `确定删除音效组「${item.name || item.id}」吗？`,
      fragment: `确定删除音频片段「${item.name || item.id}」吗？\n引用该片段的音效组槽位会自动回退预设。`,
    };
    const handlers = {
      role: [() => client.deleteRole(item.id), data => { if (!Array.isArray(data.roles)) return false; onRoleDelete(item.id, data); return true; }],
      image: [() => client.deleteBubbleImage(item.id), data => { if (!Array.isArray(data.images)) return false; onBubbleImageDelete(item.id, data); return true; }],
      group: [() => client.deleteAudioGroup(item.id), data => { if (!Array.isArray(data.groups)) return false; onAudioGroupDelete(item.id, data); return true; }],
      fragment: [() => client.deleteAudioFragment(item.id), data => { if (!Array.isArray(data.fragments)) return false; onAudioFragmentDelete(item.id, data); return true; }],
    };
    confirm(names[kind], async () => {
      try {
        const data = await handlers[kind][0]();
        requireSaved(data);
        if (data?.ok && handlers[kind][1](data)) await open();
      } catch (error) { onError(error); }
    });
  }
  function render(roles, images, audio) {
    const wrap = node('div', 'dshwv-reswrap');
    wrap.appendChild(node('div', 'dshwv-rescat', '图片'));
    for (const role of roles) {
      const built = role.id === 'default';
      wrap.appendChild(row({ url: role.url }, role.name || role.id, role.id,
        [tag(built ? '默认角色' : '自定义角色', built), button('删除', 'dshwv-resdel', () => deleteAsset('role', role), built)]));
    }
    for (const image of images) {
      wrap.appendChild(row({ url: '/dsh-whale/bubble-img.png?id=' + encodeURIComponent(image.id) }, image.name || image.id, image.id,
        [tag(image.builtin ? '内置图' : '泡泡图', !!image.builtin), button('删除', 'dshwv-resdel', () => deleteAsset('image', image), !!image.builtin)]));
    }
    if (!roles.length && !images.length) wrap.appendChild(node('div', 'dshwv-resempty', '暂无自定义图片(角色/泡泡图)'));
    wrap.appendChild(node('div', 'dshwv-rescat', '音频'));
    const groups = Array.isArray(audio?.groups) ? audio.groups : [];
    const fragments = Array.isArray(audio?.fragments) ? audio.fragments.filter(item => !item.preset) : [];
    for (const group of groups) {
      const built = !!group.preset;
      const meta = !built && group.press && group.release ? '按压:' + group.press + ' 松开:' + group.release : '';
      wrap.appendChild(row({ text: '组' }, group.name || group.id, meta,
        [tag(built ? '预设组' : '自定义组', built), button('删除', 'dshwv-resdel', () => deleteAsset('group', group), built)]));
    }
    for (const fragment of fragments) {
      wrap.appendChild(row({ text: '音' }, fragment.name || fragment.id, fragment.id,
        [tag('音频片段', false), button('删除', 'dshwv-resdel', () => deleteAsset('fragment', fragment))]));
    }
    if (!groups.length && !fragments.length) wrap.appendChild(node('div', 'dshwv-resempty', '暂无自定义音频(片段/音效组)'));
    card.replaceChildren(card.firstChild, wrap);
  }
  async function open() {
    ensure();
    const head = node('div', 'dshwv-reshead');
    head.appendChild(node('span', 'dshwv-restitle', '资源管理'));
    head.appendChild(button('✕', 'dshwv-resclose', close));
    head.lastChild.title = '关闭';
    const loading = node('div', 'dshwv-reswrap');
    loading.appendChild(node('div', '', '加载中…'));
    loading.firstChild.style.cssText = 'padding:8px 6px;color:#203170';
    card.replaceChildren(head, loading);
    mask.style.display = 'flex';
    const current = ++generation;
    const results = await Promise.allSettled([client.roles(), client.bubbleImages(), client.audio()]);
    if (current !== generation) return;
    render(results[0].status === 'fulfilled' ? results[0].value?.roles || [] : [],
      results[1].status === 'fulfilled' ? results[1].value?.images || [] : [],
      results[2].status === 'fulfilled' ? results[2].value : null);
  }
  return { open, close };
}
