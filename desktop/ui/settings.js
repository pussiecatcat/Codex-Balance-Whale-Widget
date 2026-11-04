// 大肥鱼完整设置窗口的控制器。
//
// 状态分三层，任何一层都不越权：
//   baseline  打开这一页时磁盘上的值，用来发现「你编辑期间被别人改了」
//   draft     用户在当前页的修改，只存在于内存，切换分类不会丢
//   values    最近一次从主进程读到的真实值
// 保存时只提交 draft 与 baseline 的差异，并且只发给该字段所属的存储域。
import { requestJson } from '/services/request.js';

(() => {
  'use strict';

  const catalog = window.WhaleSettingsCatalog;
  const pages = window.WhaleSettingsPages;
  const bridge = window.whaleDesktop;

  const state = {
    page: '',
    baseline: {},   // { domain: { key: value } } 当前页打开时磁盘上的值
    drafts: {},     // { pageId: { domain: { key: value } } } 按页保留草稿
    values: {},     // { domain: object }
    configured: {}, // 私密字段的存在标记
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
    title: document.getElementById('set-page-title'),
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
    if (field.id === 'usage.taskEndOn') state.draft.__combo = value;
    state.dirty = true;
    updateChrome();
    markRows();
  }

  function preview(field, value) {
    // 滑块拖动过程中的即时预览：只改显示，不落盘。
    if (value === null) return;
    state.previewValue = value;
  }

  // ── 与主进程通信 ────────────────────────────────────────────────────────

  const DOMAINS_BY_PAGE = pageId => [...new Set(catalog.forPage(pageId).map(field => field.domain))];

  async function loadPage(pageId) {
    const domains = DOMAINS_BY_PAGE(pageId);
    const result = await bridge.readSettings(domains);
    if (!result.ok) throw new Error(result.error || '读取设置失败');
    state.values = { ...state.values, ...result.values };
    // 只刷新基线，不动这一页的草稿：切走再回来时用户的修改还在。
    state.baseline = clone(result.values);
    if (pageId === 'api') {
      try {
        const info = await requestJson('/api/config');
        state.configured = info.configured || {};
      } catch { state.configured = {}; }
    }
  }

  /** 任何一页还有草稿就算有未保存修改。 */
  function anyPageDirty() {
    return catalog.pages.some(page => {
      const draft = state.drafts[page.id];
      if (!draft || !Object.keys(draft).length) return false;
      return true;
    });
  }

  async function save(force = false) {
    if (state.saving) return;
    const pageId = state.page;
    const changed = catalog.forPage(pageId).filter(field => isDirty(field, pageId));
    if (!changed.length) { updateChrome(); return; }
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
        const result = await bridge.writeSettings({ domain: 'completion',
          changes: { turnCostOn: value !== 'off', on: value === 'both' },
          base: { turnCostOn: state.values.size?.turnCostOn, on: state.values.usage?.taskEnd?.on } });
        if (!result.ok) { showNotice(result.error || '保存失败'); return; }
      }
      state.draft = {};
      await refresh();
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
  }

  function resetDefaults() {
    for (const field of catalog.forPage(state.page)) {
      if (field.type === 'locked' || field.bridged || ['role', 'position', 'snap', 'group', 'message', 'action'].includes(field.type) || field.private) continue;
      if (field.type === 'combo') { state.draft.__combo = 'both'; continue; }
      const patch = pages.toPatch(field, field.defaultValue, state.values);
      for (const [domain, changes] of Object.entries(patch)) {
        state.draft[domain] = state.draft[domain] || {};
        Object.assign(state.draft[domain], changes);
      }
    }
    showNotice('已恢复本页默认值，点「保存更改」后才会生效。素材、账号和私密配置不受影响。', 'info');
    render();
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
    const label = field => (catalog.byId.get(field) || {}).label || field;
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
    theirs.addEventListener('click', async () => { hideConflicts(); for (const item of conflicts) delete state.draft[domain]?.[item.key]; await refresh(); });
    actions.append(mine, theirs);
    box.append(actions);
    box.hidden = false;
  }

  // ── 渲染 ────────────────────────────────────────────────────────────────

  function summaryFor(field) {
    const value = currentValue(field);
    if (field.type === 'role') return '当前角色：' + (value || '默认角色');
    if (field.type === 'snap') return '当前：' + (value?.mode || 'ratio') + '（比例）';
    if (field.type === 'position') return '拖动鲸鱼即可改变位置';
    if (field.type === 'action') return '导入 / 导出素材包';
    if (field.pattern || field.type === 'group') return '共 ' + (field.subFields || []).length + ' 个子字段，在挂件里编辑';
    return '在挂件里编辑';
  }

  async function bridgeTo(field) {
    try {
      const opened = await bridge.focusWhale(pages.editorFor(field).editor);
      if (!opened) showNotice('编辑器未能打开，请稍后重试');
    } catch { showNotice('编辑器未能打开，请稍后重试'); }
  }

  const context = {
    get values() { return state.values; },
    currentValue,
    get configured() { return state.configured; },
    change, preview, isDirty, summaryFor, bridge: bridgeTo,
  };

  function markRows() {
    const rows = dom.content.querySelectorAll('.set-row');
    catalog.forPage(state.page).forEach((field, index) => {
      const row = rows[index];
      if (row) row.classList.toggle('is-dirty', isDirty(field));
    });
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
      button.textContent = page.label + (count ? ` (${count})` : '');
      button.setAttribute('aria-current', String(page.id === state.page));
      button.addEventListener('click', () => go(page.id));
      dom.nav.append(button);
    }
  }

  function render() {
    renderNav(true);
    dom.content.replaceChildren();
    dom.content.append(pages.renderPage(state.page, context));
    updateChrome();
  }

  async function refresh() {
    await loadPage(state.page);
    render();
  }

  async function go(pageId) {
    if (!catalog.pages.some(page => page.id === pageId)) pageId = catalog.pages[0].id;
    state.page = pageId;
    try { history.replaceState(null, '', '#' + pageId); } catch {}
    dom.conflicts.hidden = true;
    await loadPage(pageId);
    render();
  }

  // ── 启动 ────────────────────────────────────────────────────────────────

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
    state.values[change.domain] = change.values;
    for (const key of change.keys) {
      const edited = Object.values(state.drafts).some(draft => Object.hasOwn(draft[change.domain] || {}, key));
      if (state.baseline[change.domain] && !edited) state.baseline[change.domain][key] = change.values[key];
    }
    updateChrome();
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

  window.WhaleSettingsTest = { state, go, save, revert, resetDefaults, isDirty, anyDirty, anyPageDirty, render };
})();
