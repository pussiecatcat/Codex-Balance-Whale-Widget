import './settings-catalog.js';
import './settings-pages.js';
// 小龙娘完整设置窗口的控制器。
//
// 状态分三层，任何一层都不越权：
//   baseline  打开这一页时磁盘上的值，用来发现「你编辑期间被别人改了」
//   draft     用户在当前页的修改，只存在于内存，切换分类不会丢
//   values    最近一次从主进程读到的真实值
// 保存时只提交 draft 与 baseline 的差异，并且只发给该字段所属的存储域。
import { requestJson } from '/services/request.js';
import { soundOptions } from '/services/sound-reference.js';

(() => {
  'use strict';

  const catalog = window.WhaleSettingsCatalog;
  const pages = window.WhaleSettingsPages;
  const bridge = window.whaleDesktop;

  const state = {
    page: '',
    baseline: {},   // { domain: { key: value } } 磁盘上的值，跨页合并保留
    drafts: {},     // { pageId: { domain: { key: value } } } 按页保留草稿
    values: {},     // { domain: object }
    configured: {}, // 私密字段的存在标记
    audio: null,    // /dsh-whale/audio.json，动态音效选项
    saving: false,
  };
  // 草稿按页保存：切到别的分类再回来，这一页的修改还在。
  Object.defineProperty(state, 'draft', {
    get() { return this.drafts[this.page] || (this.drafts[this.page] = {}); },
    set(next) { this.drafts[this.page] = next; },
    enumerable: true,
  });

  const dom = {
    nav: document.getElementById('set-nav'),
    content: document.getElementById('set-content'),
    dirty: document.getElementById('set-dirty'),
    save: document.getElementById('set-save'),
    revert: document.getElementById('set-revert'),
    reset: document.getElementById('set-reset'),
    scope: document.getElementById('set-scope'),
    conflicts: document.getElementById('set-conflicts'),
  };

  // ── 值读写 ──────────────────────────────────────────────────────────────

  const clone = value => JSON.parse(JSON.stringify(value));
  const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

  function mergedFor(field) {
    const base = state.baseline[field.domain] || {};
    const draft = state.draft[field.domain] || {};
    return { ...base, ...draft };
  }

  function currentValue(field) {
    if (field.id === 'usage.taskEndOn') return state.draft.__combo ?? pages.readValue(field, state.values);
    const merged = mergedFor(field);
    const actual = pages.readValue(field, { ...state.values, [field.domain]: merged });
    if (actual !== undefined) return actual;
    return pages.defaultFor(field, state.values);
  }

  /** 某个字段是否真的被改过。草稿按页存放，所以必须指明是哪一页。 */
  function isDirty(field, pageId = state.page) {
    const base = state.baseline[field.domain] || {};
    const draft = state.drafts[pageId]?.[field.domain] || {};
    if (field.id === 'usage.taskEndOn') {
      return Object.hasOwn(state.drafts[pageId] || {}, '__combo') && !same(state.drafts[pageId].__combo, pages.readValue(field, state.values));
    }
    // 完成音量有「跟随点击音量」这一档：volSet 变了但数值没变时也算修改。
    if (field.id === 'usage.taskEndVol') {
      const merged = { ...base, ...draft };
      return !same(pages.readValue(field, { [field.domain]: merged }), pages.readValue(field, { [field.domain]: base }))
        || (merged.taskEnd?.volSet === true) !== (base.taskEnd?.volSet === true);
    }
    return !same(pages.readValue(field, { [field.domain]: { ...base, ...draft } }), pages.readValue(field, { [field.domain]: base }));
  }

  function anyDirty(pageId = state.page) {
    return catalog.forPage(pageId).some(field => isDirty(field, pageId));
  }

  function change(field, value) {
    if (field.id === 'usage.taskEndOn') { state.draft.__combo = value; updateChrome(); return; }
    const patch = pages.toPatch(field, value, { ...state.values, [field.domain]: mergedFor(field) });
    for (const [domain, changes] of Object.entries(patch)) {
      state.draft[domain] = state.draft[domain] || {};
      Object.assign(state.draft[domain], changes);
    }
    updateChrome();
    markRows();
    void syncSizePreview();
  }

  // 所有页面的 size 草稿合并成一次预览请求。挂件只应用不落盘。
  function sizeDraftChanges() {
    const changes = {};
    for (const pageDraft of Object.values(state.drafts)) Object.assign(changes, pageDraft.size || {});
    return changes;
  }

  async function syncSizePreview() {
    if (!bridge.previewSettings) return;
    try { await bridge.previewSettings({ domain: 'size', changes: sizeDraftChanges() }); }
    catch { /* 预览失败不阻塞输入；保存时仍会写盘 */ }
  }

  function preview(field, value) {
    // 拖动过程中的即时预览：只改显示，不落盘。只有大小和点击音量支持。
    if (value === null) return;
    if (field.domain !== 'size' || !bridge.previewSettings) return;
    const patch = pages.toPatch(field, value, { ...state.values, [field.domain]: mergedFor(field) });
    bridge.previewSettings({ domain: field.domain, changes: { ...sizeDraftChanges(), ...(patch.size || {}) } })
      .catch(() => { /* 预览是尽力而为 */ });
  }

  // ── 与主进程通信 ────────────────────────────────────────────────────────

  const DOMAINS_BY_PAGE = pageId => [...new Set(catalog.forPage(pageId).map(field => field.domain))];

  async function loadPage(pageId) {
    const domains = DOMAINS_BY_PAGE(pageId);
    const result = await bridge.readSettings(domains);
    if (!result.ok) throw new Error(result.error || '读取设置失败');
    state.values = { ...state.values, ...result.values };
    // 只刷新基线，不动任何一页的草稿：切走再回来时用户的修改还在。
    // 合并而不是整体替换，否则 anyPageDirty() 会把别的页的草稿判错。
    state.baseline = { ...state.baseline, ...clone(result.values) };
    if (pageId === 'api') {
      try {
        const info = await requestJson('/api/config');
        state.configured = info.configured || {};
      } catch { state.configured = {}; }
    }
    await ensureAudioCatalog();
  }

  async function ensureAudioCatalog() {
    if (state.audio) return;
    try { state.audio = await requestJson('/dsh-whale/audio.json') || {}; }
    catch { state.audio = { groups: [], fragments: [] }; }
  }

  function optionsFor(field) {
    if (!field.optionsSource) return field.options;
    const audio = state.audio || {};
    if (field.optionsSource === 'soundGroups') {
      const groups = (audio.groups || []).filter(group => group?.id)
        .map(group => ({ value: group.id, label: String(group.name || group.id) }));
      return groups.length ? groups : field.options;
    }
    if (field.optionsSource === 'soundReferences') {
      const options = soundOptions(audio);
      return options.length ? options : field.options;
    }
    return field.options;
  }

  /** 任何一页还有真实改动才算未保存：改回原样、只切页都不算。 */
  function anyPageDirty() {
    return catalog.pages.some(page => catalog.forPage(page.id).some(field => isDirty(field, page.id)));
  }

  function invalidRange(field) {
    if (field.type !== 'number') return '';
    const value = currentValue(field);
    if (typeof value !== 'number' || !Number.isFinite(value)) return `${field.label} 必须是数字`;
    if (field.min !== undefined && value < field.min) return `${field.label} 不能小于 ${field.min}`;
    if (field.max !== undefined && value > field.max) return `${field.label} 不能大于 ${field.max}`;
    return '';
  }

  function firstRangeError(pageId = state.page) {
    for (const field of catalog.forPage(pageId)) {
      if (!isDirty(field, pageId)) continue;
      const message = invalidRange(field);
      if (message) return message;
    }
    return '';
  }

  async function save(force = false) {
    if (state.saving) return;
    const pageId = state.page;
    const changed = catalog.forPage(pageId).filter(field => isDirty(field, pageId));
    if (!changed.length) { updateChrome(); return; }
    // 数字越界在输入时就标红了；这里再拦一次保存前的汇总提示。
    for (const target of catalog.pages) {
      const message = firstRangeError(target.id);
      if (message) { showNotice(message); return; }
    }
    state.saving = true;
    dom.save.disabled = true;
    hideConflicts();
    try {
      const domains = [...new Set(changed.filter(f => f.type !== 'combo').map(f => f.domain))];
      for (const domain of domains) {
        const changes = state.draft[domain] || {};
        const result = await bridge.writeSettings({ domain, changes, base: state.baseline[domain] || {}, force });
        if (!result.ok && result.conflicts) { showConflicts(result.conflicts, domain); return; }
        if (!result.ok) { showNotice(result.error || '保存失败'); return; }
        state.values[domain] = result.values;
        state.baseline[domain] = clone(result.values);
        delete state.draft[domain];
      }
      if (Object.hasOwn(state.draft, '__combo')) {
        const value = state.draft.__combo;
        // 完成提醒和其他域走同一套冲突流程，「保留我的」时会带 force 重试。
        const result = await bridge.writeSettings({ domain: 'completion',
          changes: { turnCostOn: value !== 'off', on: value === 'both' },
          base: { turnCostOn: state.values.size?.turnCostOn, on: state.values.usage?.taskEnd?.on },
          force });
        if (!result.ok && result.conflicts) { showConflicts(result.conflicts, 'completion'); return; }
        if (!result.ok) { showNotice(result.error || '保存失败'); return; }
        if (result.values) {
          state.values.size = { ...state.values.size, turnCostOn: result.values.turnCostOn };
          state.values.usage = { ...state.values.usage, taskEnd: { ...state.values.usage?.taskEnd, on: result.values.on } };
          state.baseline.size = { ...state.baseline.size, turnCostOn: result.values.turnCostOn };
          state.baseline.usage = { ...state.baseline.usage, taskEnd: { ...state.baseline.usage?.taskEnd, on: result.values.on } };
        }
      }
      state.draft = {};
      await refresh();
      void syncSizePreview();
      showNotice('已保存', 'info');
    } catch (error) {
      showNotice(error?.message || '保存失败，草稿仍保留在当前页');
    } finally {
      state.saving = false;
      dom.save.disabled = false;
    }
  }

  function revert() {
    state.draft = {};
    render();
    void syncSizePreview();
  }

  function resetDefaults() {
    for (const field of catalog.forPage(state.page)) {
      if (field.type === 'locked' || field.type === 'note' || field.bridged || field.private) continue;
      if (['role', 'position', 'snap', 'group', 'message', 'action'].includes(field.type)) continue;
      // API 页的接口字段不参与「恢复默认」：把 provider、currency 等重置成默认值
      // 可能拆散一套本来能用的自定义接口配置，而密钥又保持不动。
      if (field.domain === 'api' || field.domain === 'apiModels') continue;
      if (field.type === 'combo') { state.draft.__combo = field.defaultValue; continue; }
      const patch = pages.toPatch(field, field.defaultValue, state.values);
      for (const [domain, changes] of Object.entries(patch)) {
        state.draft[domain] = state.draft[domain] || {};
        Object.assign(state.draft[domain], changes);
      }
    }
    // 先重绘再提示：render() 会重建内容区，提示必须写在新的节点上。
    render();
    void syncSizePreview();
    showNotice('已恢复本页默认值，点「保存更改」后才会生效。素材、账号和私密配置不受影响。', 'info');
  }

  // ── 提示与冲突 ──────────────────────────────────────────────────────────

  function showNotice(message, kind = 'error') {
    const node = dom.content.querySelector('.set-notice');
    if (!node) return;
    node.textContent = message;
    node.className = 'set-notice ' + kind;
    node.hidden = !message;
  }

  function hideConflicts() { dom.conflicts.hidden = true; dom.conflicts.replaceChildren(); }

  function showConflicts(conflicts, domain) {
    const box = dom.conflicts;
    box.replaceChildren();
    const heading = document.createElement('h3');
    heading.textContent = '这些设置在你编辑期间被改过';
    box.append(heading);
    const list = document.createElement('ul');
    const label = key => {
      const field = catalog.byId.get(key);
      if (field) return field.label;
      return { turnCostOn: '任务结束后显示用量', on: '完成提醒声音', mode: '数据来源' }[key] || key;
    };
    for (const conflict of conflicts) {
      const item = document.createElement('li');
      item.textContent = `${label(conflict.key)}：你的修改是 ${JSON.stringify(conflict.yours)}，现在保存的值是 ${JSON.stringify(conflict.theirs)}`;
      list.append(item);
    }
    box.append(list);
    const actions = document.createElement('div');
    actions.className = 'set-conflict-actions';
    const mine = document.createElement('button');
    mine.className = 'set-button primary';
    mine.type = 'button';
    mine.textContent = '保留我的修改';
    mine.addEventListener('click', async () => { hideConflicts(); await save(true); });
    const theirs = document.createElement('button');
    theirs.className = 'set-button';
    theirs.type = 'button';
    theirs.textContent = '用当前值';
    theirs.addEventListener('click', async () => {
      hideConflicts();
      if (domain === 'completion') delete state.draft.__combo;
      else for (const item of conflicts) delete state.draft[domain]?.[item.key];
      await refresh();
      void syncSizePreview();
    });
    actions.append(mine, theirs);
    box.append(actions);
    box.hidden = false;
  }

  // ── 渲染 ────────────────────────────────────────────────────────────────

  function summaryFor(field) {
    const value = currentValue(field);
    if (field.type === 'role') return value ? '当前：' + value : '当前：默认角色';
    if (field.type === 'snap') return { ratio: '当前：按比例', px: '当前：按像素', off: '当前：关闭' }[value?.mode || 'ratio'] || '';
    if (field.type === 'position') return '拖动鲸鱼即可移动';
    if (field.pattern || field.type === 'group') return (field.subFields || []).length ? '共 ' + field.subFields.length + ' 项' : '';
    return '';
  }

  async function openEditor(target) {
    if (!target || !target.name) { showNotice('这个字段没有可打开的编辑器'); return false; }
    try {
      const opened = await bridge.focusWhale({ name: target.name, args: target.args || {} });
      if (!opened) showNotice('编辑器未能打开，请稍后重试');
      return !!opened;
    } catch { showNotice('编辑器未能打开，请稍后重试'); return false; }
  }

  async function bridgeTo(field) {
    const target = pages.editorFor(field);
    if (!target) { showNotice('这个字段没有可打开的编辑器'); return; }
    await openEditor(target);
  }

  async function resetPosition() {
    try {
      const ok = await bridge.resetPosition?.();
      showNotice(ok ? '已把鲸鱼移回右下角。' : '复位失败，请稍后重试。', ok ? 'info' : 'error');
    } catch { showNotice('复位失败，请稍后重试。'); }
  }

  const context = {
    get values() { return state.values; },
    currentValue,
    get configured() { return state.configured; },
    optionsFor,
    change, preview, isDirty, summaryFor, bridge: bridgeTo, resetPosition,
  };

  function markRows() {
    // 按字段 ID 找行：界面顺序按分区排，和目录顺序不是一回事。
    for (const row of dom.content.querySelectorAll('.set-row')) {
      const field = catalog.byId.get(row.dataset.fieldId);
      if (field) row.classList.toggle('is-dirty', isDirty(field));
    }
    updateChrome();
  }

  function updateChrome() {
    renderNav();
    const dirty = anyDirty();
    dom.dirty.hidden = !dirty;
    dom.save.disabled = !dirty || state.saving;
    dom.revert.disabled = !dirty || state.saving;
    dom.reset.disabled = state.saving;
    dom.scope.textContent = '本页改动：' + catalog.forPage(state.page).filter(field => isDirty(field, state.page)).length + ' 项';
  }

  let navSignature = '';
  function renderNav(force) {
    // 拖动滑块时会高频调用 updateChrome，导航只在计数真的变了才重建。
    const signature = state.page + '|' + catalog.pages.map(page =>
      page.id + ':' + catalog.forPage(page.id).filter(field => isDirty(field, page.id)).length).join(',');
    if (!force && signature === navSignature) return;
    navSignature = signature;
    dom.nav.replaceChildren();
    for (const page of catalog.pages) {
      const button = document.createElement('button');
      button.type = 'button';
      const count = catalog.forPage(page.id).filter(field => isDirty(field, page.id)).length;
      button.textContent = page.label;
      if (count) {
        const badge = document.createElement('span');
        badge.className = 'set-nav-count';
        badge.textContent = `(${count})`;
        button.append(' ', badge);
      }
      button.setAttribute('aria-current', String(page.id === state.page));
      button.addEventListener('click', () => go(page.id));
      dom.nav.append(button);
    }
  }

  function render() {
    renderNav(true);
    dom.content.replaceChildren();
    dom.content.append(pages.renderPage(state.page, context));
    if (state.page === 'providers') void hydrateProviders();
    updateChrome();
  }

  // ── 服务商首屏 ──────────────────────────────────────────────────────────
  // 列表只读；真正的增删改仍在挂件的 API 弹层里，避免把两套编辑器做成两份
  // 可能分叉的实现。点「编辑」时由主进程点亮鲸鱼并打开它自己的弹层。
  let providerRevision = 0;
  async function hydrateProviders() {
    const box = document.getElementById('set-providers');
    if (!box) return;
    const revision = ++providerRevision;
    const line = (parent, className, text) => {
      const node = document.createElement('p');
      node.className = className;
      if (text != null) node.textContent = text;
      parent.append(node);
      return node;
    };
    const edit = (card, target, label) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'set-button';
      button.textContent = label || '编辑';
      button.addEventListener('click', () => { void openEditor(target); });
      card.append(button);
    };
    try {
      const [models, config] = await Promise.all([requestJson('/api/models'), requestJson('/api/config')]);
      if (revision !== providerRevision || state.page !== 'providers' || !box.isConnected) return;
      box.replaceChildren();
      line(box, 'set-providers-hint', '小龙娘从这里读取余额和额度。当前 API 自动跟随 Codex；DIY 服务商单独添加。');
      const auto = document.createElement('div');
      auto.className = 'set-provider-card';
      const main = document.createElement('div');
      main.className = 'set-provider-main';
      const title = document.createElement('strong');
      title.textContent = 'Codex 当前 API';
      const badge = document.createElement('span');
      badge.className = 'set-provider-badge';
      badge.textContent = '自动';
      const status = document.createElement('span');
      status.className = 'set-provider-status';
      const configured = config?.configured || {};
      const ready = !!(configured.baseUrl || configured.keyEnv || configured.profile || configured.projectDir);
      status.textContent = config?.warning ? '已配置（已从备份恢复）' : ready ? '已配置' : '未配置';
      status.classList.toggle('is-ok', ready);
      main.append(title, badge, status);
      auto.append(main);
      edit(auto, { name: 'api' });
      box.append(auto);
      const list = models?.models || [];
      if (!list.length) {
        line(box, 'set-providers-empty', '尚未添加 DIY 服务商。Codex 当前 API 仍会自动跟随；需要单独查看余额时再添加。');
      } else {
        for (const model of list) {
          const card = document.createElement('div');
          card.className = 'set-provider-card';
          const row = document.createElement('div');
          row.className = 'set-provider-main';
          const name = document.createElement('strong');
          name.textContent = model.name;
          const meta = document.createElement('span');
          meta.className = 'set-provider-meta';
          meta.textContent = (model.kind === 'quota' ? '订阅额度' : model.kind === 'codex' ? '本地统计' : model.noBalanceApi ? '无余额接口' : '余额接口') + ' · ' + model.currency;
          const key = document.createElement('span');
          key.className = 'set-provider-status';
          key.textContent = model.configured?.key ? '已配置' : model.keyEnv ? '缺少密钥' : '未配置';
          key.classList.toggle('is-ok', !!model.configured?.key);
          row.append(name, meta, key);
          card.append(row);
          edit(card, { name: 'api-model', args: { id: model.id } });
          box.append(card);
        }
      }
      const add = document.createElement('button');
      add.type = 'button';
      add.className = 'set-button primary';
      add.textContent = '在挂件中添加服务商';
      add.addEventListener('click', () => { void openEditor({ name: 'api-model', args: { id: null } }); });
      box.append(add);
      line(box, 'set-providers-hint', '密钥只读取环境变量，配置文件不保存密钥内容。测试连接与新增在挂件的「API 余额设置」里完成。');
    } catch (error) {
      if (revision !== providerRevision) return;
      box.replaceChildren();
      line(box, 'set-providers-error', '服务商列表暂时无法读取：' + (error?.message || '未知错误'));
      const retry = document.createElement('button');
      retry.type = 'button';
      retry.className = 'set-button';
      retry.textContent = '重试';
      retry.addEventListener('click', () => { void hydrateProviders(); });
      box.append(retry);
    }
  }

  async function refresh() {
    await loadPage(state.page);
    render();
  }

  function renderLoadError(pageId, error) {
    state.page = pageId;
    renderNav(true);
    dom.content.replaceChildren();
    const page = catalog.pages.find(item => item.id === pageId);
    const heading = document.createElement('h2');
    heading.className = 'set-page-title';
    heading.textContent = page ? page.label : '设置';
    const box = document.createElement('div');
    box.className = 'set-notice error';
    box.textContent = '读取设置失败：' + (error?.message || error || '未知错误');
    const retry = document.createElement('button');
    retry.type = 'button';
    retry.className = 'set-button';
    retry.textContent = '重试';
    retry.addEventListener('click', () => { void go(pageId); });
    box.append(document.createElement('br'), retry);
    dom.content.append(heading, box);
    updateChrome();
  }

  async function go(pageId) {
    if (!catalog.pages.some(page => page.id === pageId)) pageId = catalog.pages[0].id;
    state.page = pageId;
    try { history.replaceState(null, '', '#' + pageId); } catch {}
    dom.conflicts.hidden = true;
    try {
      await loadPage(pageId);
      render();
    } catch (error) {
      // 读取失败也要让界面明确说发生了什么，并给出重试入口。
      renderLoadError(pageId, error);
    }
  }

  // ── 启动 ────────────────────────────────────────────────────────────────

  document.getElementById('set-logs')?.addEventListener('click', () => { bridge.openLogs?.(); });

  // Shows which build is running, so a stale install is visible at a glance.
  requestJson('/api/status').then(info => {
    const build = document.getElementById('set-build');
    if (build) build.textContent = info.buildVersion || info.version || '';
  }).catch(() => {});

  function initialPage() {
    const hash = (location.hash || '').replace(/^#/, '');
    return catalog.pages.some(page => page.id === hash) ? hash : catalog.pages[0].id;
  }

  dom.save.addEventListener('click', () => save());
  dom.revert.addEventListener('click', revert);
  dom.reset.addEventListener('click', resetDefaults);

  bridge.onNavigate(target => { if (target?.page) go(target.page); });
  // 别的入口（快捷菜单、挂件自身）改了同一批设置时同步已保存值，但不覆盖本页草稿。
  bridge.onSettingsChanged(change => {
    if (!change || !change.domain) return;
    state.values[change.domain] = change.values;
    const keys = Array.isArray(change.keys) ? change.keys : [];
    for (const key of keys) {
      const edited = Object.values(state.drafts).some(draft => Object.hasOwn(draft[change.domain] || {}, key));
      if (state.baseline[change.domain] && !edited) state.baseline[change.domain][key] = change.values[key];
    }
    // 当前页有字段被别的入口改了、又没有草稿时重绘，避免继续显示旧值。
    const affectsCurrent = catalog.forPage(state.page).some(field => field.domain === change.domain && !isDirty(field));
    if (affectsCurrent && !anyDirty()) render();
    else { markRows(); updateChrome(); }
  });

  window.addEventListener('beforeunload', event => {
    // 关闭不等于保存：任何一页还有草稿都要拦一下。
    if (!anyPageDirty()) return;
    // 关闭不等于保存。草稿留在当前页，重新打开仍是原值。
    event.preventDefault();
    event.returnValue = '';
  });

  go(initialPage()).catch(error => {
    dom.content.replaceChildren();
    const box = document.createElement('div');
    box.className = 'set-notice error';
    box.textContent = '设置窗口未能读取配置：' + (error?.message || error);
    dom.content.append(box);
  });

  window.WhaleSettingsTest = { state, go, save, revert, resetDefaults, isDirty, anyDirty, anyPageDirty, render, renderLoadError };
})();
