import catalog from './settings-catalog.js';
import { attach as attachHelp } from './settings-help.js';
// 设置窗口的分区与字段行渲染。
//
// 每个字段按设置目录（settings-catalog.js）里的 type 渲染成对应控件。同一分类
// 的字段按 SECTIONS 分进一张卡片，控件统一落在右侧固定宽度的列里。需要画布的
// 复杂编辑器不在这里重写：同一个编辑器下的字段合成一张卡片，只放一个打开按钮，
// 由设置窗口唤起鲸鱼自己的弹层。
import { completionMode, completionPatch } from './shared/sound-model.js';

  const el = (tag, className, text) => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = text;
    return node;
  };

  // 字段在页内的分组。没列出的字段落进页尾的无标题卡片，所以目录新增字段不会
  // 从界面上消失。fold 的小节默认收起，只有其中有未保存修改时才展开。
  const SECTIONS = {
    appearance: [
      { title: '显示', ids: ['size.scale', 'ui.accountView', 'ui.displayCurrency'] },
    ],
    sound: [
      { title: '点击反馈', ids: ['size.sound', 'size.vol', 'size.soundSet', 'ui.feel'] },
      { title: '任务完成', ids: ['usage.taskEndOn', 'size.turnCostOn', 'size.turnCostCloseMs', 'usage.taskEndSel', 'usage.taskEndVol'] },
      { title: '提问与授权', ids: ['usage.events.question', 'usage.events.approval', 'usage.waitCharClose'] },
    ],
    bubble: [
      { title: '显示', ids: ['size.bubbleOn', 'ui.bubbleShape'] },
    ],
    position: [
      { title: '桌面避让', ids: ['size.scrollGapOn', 'size.scrollGapPx'] },
      { title: '菜单', ids: ['size.menuBtnHide'] },
    ],
    api: [
      { title: '预警与预算', ids: ['usage.alertOn', 'usage.alertBelow', 'usage.budgetOn', 'usage.budgetAmount', 'usage.alertAutoClose', 'usage.alertTtlSec'] },
      { title: '接口', ids: ['api.provider', 'api.baseUrl', 'api.keyEnv', 'api.dashboardUrl', 'api.refreshSeconds', 'api.monitorSessions'] },
      { title: '自定义接口字段（通常不用改）', fold: true, ids: ['api.profile', 'api.projectDir', 'api.currency', 'api.balancePath', 'api.balanceField', 'api.usedField', 'api.balanceScale', 'api.billingUsageDivisor', 'api.quotaPerUnit'] },
    ],
  };
  // 每个需要编辑器的字段都在目录里显式声明 editor；这里不再按 domain/type 猜。
  const opensEditor = field => !!field.bridged || !!field.editor;

  function pathValue(object, path) {
    return path.split('.').reduce((value, key) => value?.[key], object);
  }
  // 存储值 = 界面值 × scale + offset（例如毫秒存、秒显示；大小按档位显示、按倍数存）。
  // 结果收敛到 1e-9，避免 0.7 + 0.5 这类浮点误差变成 1.2000000000000002 写进配置。
  const tidy = value => Math.round(value * 1e9) / 1e9;
  function fromStorage(field, value) {
    if (!field.scale || typeof value !== 'number') return value;
    return tidy((value - (field.offset || 0)) / field.scale);
  }
  function toStorage(field, value) {
    if (!field.scale || typeof value !== 'number') return value;
    return tidy(value * field.scale + (field.offset || 0));
  }
  function readValue(field, values) {
    if (field.id === 'usage.taskEndOn') {
      return completionMode({ turnCostOn: values.size?.turnCostOn, taskEndOn: values.usage?.taskEnd?.on });
    }
    return fromStorage(field, pathValue(values[field.domain], field.key.split(' / ')[0]));
  }
  function toPatch(field, value, base) {
    if (field.id === 'usage.taskEndOn') {
      const patch = completionPatch(value);
      return { size: { turnCostOn: patch.turnCostOn }, usage: { taskEnd: { ...base.usage?.taskEnd, on: patch.taskEndOn } } };
    }
    // 「跟随点击音量」没有数值：恢复默认时只把 volSet 关掉，不写死一个假音量。
    if (field.id === 'usage.taskEndVol' && value === null) {
      return { usage: { taskEnd: { ...base.usage?.taskEnd, volSet: false } } };
    }
    const stored = toStorage(field, value);
    const document = {};
    const paths = field.key.split(' / ');
    for (const keyPath of paths) {
      const parts = keyPath.split('.');
      if (parts.length === 1) { document[keyPath] = stored; continue; }
      const [root, key] = parts;
      document[root] = { ...(document[root] || base[field.domain]?.[root]), [key]: key === 'volSet' ? true : stored };
    }
    return { [field.domain]: document };
  }
  function defaultFor(field, values) {
    return readValue(field, values) ?? field.defaultValue;
  }
  function editorFor(field) {
    if (!field.editor) return null;
    return field.editor;
  }

  function makeControl(field, context) {
    const row = el('div', 'set-row-control');
    // 走 currentValue 而不是 readValue：存储里还没有这个键时，用目录里的默认值，
    // 否则全新安装会渲染出一堆空的下拉框。
    const current = context.currentValue(field);
    // 滑块需要把草稿值回写到自己的输入框；其它控件没有这一步。
    let syncOutput = () => {};
    const set = next => { context.change(field, next); syncOutput(); };

    if (field.type === 'note') {
      row.append(el('span', 'set-locked', field.note || '由其它设置控制'));
      return row;
    }

    if (field.type === 'position') {
      const reset = el('button', 'set-button', '移回右下角');
      reset.type = 'button';
      reset.addEventListener('click', () => { void context.resetPosition?.(); });
      row.append(reset);
      return row;
    }

    if (field.type === 'boolean') {
      const input = el('input');
      input.type = 'checkbox';
      input.className = 'set-check';
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
      input.setAttribute('aria-label', field.label);
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
      input.setAttribute('aria-label', field.label);
      const boundsMessage = value => {
        if (field.min !== undefined && value < field.min) return `不能小于 ${field.min}`;
        if (field.max !== undefined && value > field.max) return `不能大于 ${field.max}`;
        return '';
      };
      input.addEventListener('input', () => { input.setCustomValidity(''); input.classList.remove('is-invalid'); });
      input.addEventListener('change', () => {
        const raw = input.value.trim();
        if (raw === '') {
          input.setCustomValidity(''); input.classList.remove('is-invalid');
          set(typeof field.defaultValue === 'number' ? field.defaultValue : null);
          return;
        }
        const value = Number(raw);
        if (!Number.isFinite(value)) {
          input.setCustomValidity('请输入数字'); input.classList.add('is-invalid'); input.reportValidity();
          return;
        }
        const message = boundsMessage(value);
        if (message) {
          input.setCustomValidity(message); input.classList.add('is-invalid'); input.reportValidity();
          return;
        }
        input.setCustomValidity(''); input.classList.remove('is-invalid');
        set(value);
      });
      row.append(input);
      if (field.unit) row.append(el('span', 'set-output', field.unit));
      return row;
    }

    if (field.type === 'select' || field.type === 'combo') {
      const select = el('select');
      select.setAttribute('aria-label', field.label);
      const options = context.optionsFor?.(field) || field.options
        || [{ value: 'off', label: '关闭' }, { value: 'bubble', label: '仅气泡' }, { value: 'both', label: '气泡和声音' }];
      for (const option of options) {
        const node = el('option', null, option.label);
        node.value = option.value;
        select.append(node);
      }
      const wanted = current == null ? '' : String(current);
      select.value = wanted;
      // 存储里的值不在选项里（例如自定义音效组）时，保留它并标成「当前」，
      // 不能因为下拉没有这一项就悄悄改成第一个预设。
      if (wanted && select.value !== wanted && field.id !== 'usage.taskEndOn') {
        const custom = el('option', null, '当前：' + wanted);
        custom.value = wanted;
        select.append(custom);
        select.value = wanted;
      }
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
      input.setAttribute('aria-label', field.label);
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

    const fallback = el('span', 'set-locked', '暂不支持的类型：' + field.type);
    row.append(fallback);
    return row;
  }

  function formatRange(field, value) {
    if (field.unit === '百分比') return Math.round(value * 100) + '%';
    const text = Number.isFinite(field.step) && field.step < 1
      ? value.toFixed(2).replace(/\.?0+$/, '')
      : String(value);
    const shown = field.unit ? text + ' ' + field.unit : text;
    // 档位这类换算单位顺带给出存储值，例如「14 档 · 1.9 倍」。
    return field.storedUnit ? shown + ' · ' + toStorage(field, value) + ' ' + field.storedUnit : shown;
  }

  function renderRow(field, context) {
    const row = el('div', 'set-row');
    row.dataset.fieldId = field.id;
    if (context.isDirty(field)) row.classList.add('is-dirty');

    const main = el('div', 'set-row-main');
    const label = el('div', 'set-row-label');
    label.append(el('span', 'set-row-name', field.label));
    // 说明按钮跟着字段名，不占控件列，否则每行右侧都是一排相同的圆圈。
    attachHelp(label, field);
    // 内部 ID 不给用户看，只留给测试和排障定位这一行。
    const id = el('span', 'set-id', field.id);
    id.hidden = true;
    label.append(id);
    main.append(label, el('div', 'set-row-purpose', field.purpose));
    row.append(main);
    if (!opensEditor(field)) row.append(makeControl(field, context));
    return row;
  }

  function renderDirectSection(section, fields, context) {
    const card = el('div', 'set-card');
    for (const field of fields) card.append(renderRow(field, context));
    if (section.fold) {
      const fold = el('details', 'set-section set-fold');
      fold.open = fields.some(field => context.isDirty(field));
      fold.append(el('summary', 'set-section-title', section.title), card);
      return fold;
    }
    const box = el('section', 'set-section');
    if (section.title) box.append(el('h3', 'set-section-title', section.title));
    box.append(card);
    return box;
  }

  // 同一个编辑器下的字段合成一张卡片，只放一个按钮。原先每行一个
  // 「打开气泡编辑器」，一屏全是相同的按钮。
  function renderEditorSection(fields, context) {
    const groups = new Map();
    for (const field of fields) {
      const target = editorFor(field);
      if (!target) continue;
      // 同一路由但参数不同（例如余额预警 vs 每日预算提醒）要分开成两行。
      const key = target.name + ':' + JSON.stringify(target.args || {});
      if (!groups.has(key)) groups.set(key, { target, fields: [] });
      groups.get(key).fields.push(field);
    }
    const box = el('section', 'set-section');
    box.append(el('h3', 'set-section-title', '在编辑器中调整'));
    box.append(el('p', 'set-section-hint', '这些内容需要边看边改，会在小龙娘旁边打开编辑器，并在编辑器内保存。'));
    for (const group of groups.values()) {
      const card = el('div', 'set-card set-editor-card');
      const single = group.fields.length === 1;
      const label = group.target.label || ('打开' + group.target.name + '编辑器');
      const open = el('button', 'set-button set-editor-open', single ? label : '打开');
      open.type = 'button';
      open.setAttribute('aria-label', label);
      open.addEventListener('click', () => context.bridge(group.fields[0]));
      if (!single) {
        const head = el('div', 'set-editor-head');
        head.append(el('strong', 'set-editor-name', label.replace(/^打开/, '')), open);
        card.append(head);
      }
      for (const field of group.fields) {
        const row = renderRow(field, context);
        row.classList.add('is-bridged');
        const summary = context.summaryFor(field);
        const side = el('div', 'set-row-side');
        if (summary) side.append(el('span', 'set-summary', summary));
        if (single) side.append(open);
        if (side.childNodes.length) row.append(side);
        card.append(row);
      }
      box.append(card);
    }
    return box;
  }

  function renderPage(pageId, context) {
    const page = catalog.pages.find(item => item.id === pageId);
    const container = document.createDocumentFragment();
    container.append(el('h2', 'set-page-title', page.label));
    container.append(el('p', 'set-page-hint', page.hint));

    const notice = el('div', 'set-notice error');
    notice.hidden = true;
    container.append(notice);

    // 服务商列表由 settings.js 异步填充：这里只提供稳定的挂载点，避免把
    // 网络请求塞进这个纯渲染模块。编辑仍在挂件自己的 API 弹层里完成。
    if (pageId === 'providers') {
      const providers = el('div', 'set-providers');
      providers.id = 'set-providers';
      providers.append(el('p', 'set-providers-loading', '正在读取服务商…'));
      container.append(providers);
    }

    // locked 字段是不可修改的历史遗留值，留在目录里供文档与校验使用，不占界面。
    const fields = catalog.forPage(pageId).filter(field => field.type !== 'locked');
    const direct = fields.filter(field => !opensEditor(field));
    const placed = new Set();
    for (const section of SECTIONS[pageId] || []) {
      const members = section.ids.map(id => direct.find(field => field.id === id)).filter(Boolean);
      if (!members.length) continue;
      members.forEach(field => placed.add(field));
      container.append(renderDirectSection(section, members, context));
    }
    const rest = direct.filter(field => !placed.has(field));
    if (rest.length) container.append(renderDirectSection({}, rest, context));
    const editors = fields.filter(opensEditor);
    if (editors.length) container.append(renderEditorSection(editors, context));
    return container;
  }

export { renderPage, toPatch, readValue, editorFor, defaultFor };
