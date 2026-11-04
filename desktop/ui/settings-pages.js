// 六个分类的字段行渲染。
//
// 每个字段按设置目录（settings-catalog.js）里的 type 渲染成对应控件，
// 并统一在左侧挂上 `!` 说明按钮。需要画布的复杂编辑器不在这里重写：
// 它们显示参数摘要加一个「打开对应编辑器」按钮，由设置窗口唤起鲸鱼自己的弹层。
(() => {
  'use strict';

  const catalog = window.WhaleSettingsCatalog;
  const el = (tag, className, text) => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = text;
    return node;
  };

  function pathValue(object, path) {
    return path.split('.').reduce((value, key) => value?.[key], object);
  }
  function readValue(field, values) {
    if (field.id === 'usage.taskEndOn') {
      const bubble = values.size?.turnCostOn !== false, sound = values.usage?.taskEnd?.on === true;
      return bubble ? (sound ? 'both' : 'bubble') : (sound ? 'custom' : 'off');
    }
    return pathValue(values[field.domain], field.key.split(' / ')[0]);
  }
  function toPatch(field, value, base) {
    if (field.id === 'usage.taskEndOn') return { size: { turnCostOn: value !== 'off' }, usage: { taskEnd: { ...base.usage?.taskEnd, on: value === 'both' } } };
    const document = {};
    const paths = field.key.split(' / ');
    for (const keyPath of paths) {
      const parts = keyPath.split('.');
      if (parts.length === 1) { document[keyPath] = value; continue; }
      const [root, key] = parts;
      document[root] = { ...(document[root] || base[field.domain]?.[root]), [key]: key === 'volSet' ? true : value };
    }
    return { [field.domain]: document };
  }
  function defaultFor(field, values) {
    return readValue(field, values) ?? field.defaultValue;
  }
  function editorFor(field) {
    if (field.domain === 'api' || field.domain === 'apiModels') return { editor: 'api', label: '打开 API 编辑器' };
    if (field.domain === 'media') return field.id === 'media.audio'
      ? { editor: 'sound', label: '打开音效编辑器' } : { editor: 'workshop', label: '打开素材管理' };
    if (field.id === 'ui.role') return { editor: 'role', label: '打开角色选择' };
    if (field.type === 'snap' || field.type === 'position') return { editor: 'snap', label: '打开位置编辑器' };
    if (field.page === 'sound') return { editor: 'sound', label: '打开音效编辑器' };
    return { editor: 'bubble', label: '打开气泡编辑器' };
  }

  function makeControl(field, context) {
    const row = el('div', 'set-row-control');
    // 走 currentValue 而不是 readValue：存储里还没有这个键时，用目录里的默认值，
    // 否则全新安装会渲染出一堆空的下拉框。
    const current = context.currentValue(field);
    // 滑块需要把草稿值回写到自己的输入框；其它控件没有这一步。
    let syncOutput = () => {};
    const set = next => { context.change(field, next); syncOutput(); };

    if (field.type === 'locked') {
      row.append(el('span', 'set-locked', '固定值，不可修改'));
      return row;
    }

    if (field.type === 'boolean') {
      const input = el('input');
      input.type = 'checkbox';
      input.checked = current !== false;
      input.setAttribute('aria-label', field.label);
      input.addEventListener('change', () => set(input.checked));
      row.append(input);
      return row;
    }

    if (field.type === 'range') {
      const input = el('input');
      input.type = 'range';
      input.min = field.min; input.max = field.max; input.step = field.step;
      input.value = current ?? field.min;
      const output = el('span', 'set-output');
      const render = () => { output.textContent = formatRange(field, Number(input.value)); };
      // set() 会回调它，所以必须在 return 之前完成声明。
      // 必须读草稿而不是 context.values：values 是最近一次从主进程读到的值，
      // 刚改完还没保存时它还是旧值，滑块会立刻弹回去。
      syncOutput = () => { input.value = context.currentValue(field) ?? field.min; render(); };
      input.addEventListener('input', () => { context.preview(field, Number(input.value)); render(); });
      input.addEventListener('change', () => { context.preview(field, null); set(Number(input.value)); });
      render();
      row.append(input, output);
      return row;
    }

    if (field.type === 'number') {
      const input = el('input');
      input.type = 'number';
      if (field.min !== undefined) input.min = field.min;
      if (field.max !== undefined) input.max = field.max;
      input.step = field.step ?? 'any';
      input.value = current ?? '';
      const unit = el('span', 'set-output', field.unit || '');
      input.addEventListener('change', () => {
        const raw = input.value.trim();
        if (raw === '') { set(field.defaultValue); return; }
        const value = Number(raw);
        if (!Number.isFinite(value)) { input.reportValidity(); return; }
        set(value);
      });
      row.append(input, unit);
      return row;
    }

    if (field.type === 'select' || field.type === 'combo') {
      const select = el('select');
      select.setAttribute('aria-label', field.label);
      for (const option of field.options || [{ value: 'off', label: '关闭' }, { value: 'bubble', label: '仅气泡' }, { value: 'both', label: '气泡和声音' }]) {
        const node = el('option', null, option.label);
        node.value = option.value;
        select.append(node);
      }
      select.value = current == null ? '' : String(current);
      if (field.id === 'usage.taskEndOn' && !['off', 'bubble', 'both'].includes(select.value)) {
        // 已有非标准组合时显示「自定义」，打开页面不得擅自归一化。
        const custom = el('option', null, '自定义');
        custom.value = 'custom';
        select.append(custom);
        select.value = 'custom';
      }
      select.addEventListener('change', () => set(select.value));
      row.append(select);
      return row;
    }

    if (field.type === 'text' || field.type === 'url') {
      const input = el('input');
      input.type = field.type === 'url' ? 'url' : 'text';
      input.autocomplete = 'off';
      input.spellcheck = false;
      // 私密字段从不回显真实值：已配置时只提示，留空表示保留。
      const configured = context.configured?.[field.key] === true;
      input.value = field.private ? '' : (current ?? '');
      input.placeholder = field.private
        ? (configured ? '已配置（内容隐藏）；留空保持不变' : '留空保持默认；填写新值可修改')
        : '';
      input.addEventListener('change', () => {
        const raw = input.value.trim();
        if (field.private && raw === '') { input.value = ''; return; }
        set(raw);
      });
      row.append(input);
      return row;
    }

    // 复杂编辑器：显示摘要，交给挂件里的弹层细调。
    if (field.bridged || ['role', 'position', 'snap', 'group', 'message', 'action'].includes(field.type)) {
      const box = el('div', 'set-row-bridge');
      box.append(el('span', 'set-summary', context.summaryFor(field)));
      const button = el('button', 'set-button', editorFor(field).label);
      button.type = 'button';
      button.title = '将在挂件中打开，修改后在编辑器内保存';
      button.addEventListener('click', () => context.bridge(field));
      box.append(button);
      row.append(box);
      return row;
    }

    const fallback = el('span', 'set-locked', '暂不支持的类型：' + field.type);
    row.append(fallback);
    return row;
  }

  function formatRange(field, value) {
    if (field.unit === '百分比') return Math.round(value * 100) + '%';
    const text = Number.isFinite(field.step) && field.step < 1
      ? value.toFixed(2).replace(/\.?0+$/, '')
      : String(value);
    return field.unit ? text + ' ' + field.unit : text;
  }

  function renderRow(field, context) {
    const row = el('div', 'set-row');
    if (field.bridged) row.classList.add('is-bridged');
    if (context.isDirty(field)) row.classList.add('is-dirty');

    const main = el('div', 'set-row-main');
    const label = el('div', 'set-row-label');
    label.append(document.createTextNode(field.label));
    label.append(el('span', 'set-id', field.id));
    main.append(label, el('div', 'set-row-purpose', field.purpose));
    row.append(main);

    const controlHost = el('div', 'set-row-control');
    const built = makeControl(field, context);
    for (const child of Array.from(built.childNodes)) {
      if (child.nodeName === 'DIV' && child.className === 'set-row-control') {
        for (const inner of Array.from(child.childNodes)) controlHost.append(inner);
      } else {
        controlHost.append(child);
      }
    }
    window.WhaleSettingsHelp.attach(controlHost, field);
    row.append(controlHost);
    return row;
  }

  function renderPage(pageId, context) {
    const page = catalog.pages.find(item => item.id === pageId);
    const container = document.createDocumentFragment();
    container.append(el('h2', 'set-page-title', page.label));
    container.append(el('p', 'set-page-hint', page.hint));

    const notice = el('div', 'set-notice error');
    notice.hidden = true;
    container.append(notice);

    // 直接可编辑的字段先渲染，需要打开对应编辑器的放在「进阶」小节后面。
    const direct = catalog.forPage(pageId).filter(field => !(field.bridged || ['role', 'position', 'snap', 'group', 'message', 'action'].includes(field.type)));
    const advanced = catalog.forPage(pageId).filter(field => direct.indexOf(field) < 0);

    for (const field of direct) container.append(renderRow(field, context));
    if (advanced.length) {
      container.append(el('h3', 'set-group-title', '进阶设置'));
      for (const field of advanced) container.append(renderRow(field, context));
    }
    return container;
  }

  window.WhaleSettingsPages = { renderPage, toPatch, readValue, editorFor, defaultFor };
})();
