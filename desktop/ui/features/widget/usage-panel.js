import { openOver } from '../../services/layers.js';
// The usage panel's request and record-window state. The menu shell, charts and
// alert editors stay in the entry because they share the bubble editor's live
// state; this module owns the ledger request lifecycle so the entry stops
// holding a second copy of it.
export function createUsagePanel({
  document, requestJson, settingsUrl, recordsUrl,
  assetWarning, assetFailure, WhaleMoney, updateSoundSettings,
  getPanel, getMain, fill, getState, refreshBalance, getTodayKey, getRecordsView,
}) {
  let usageSet = null;
  const mask = document.createElement('div');
  mask.className = 'dshwv-usage-mask';
  mask.style.display = 'none';
  const card = document.createElement('div');
  card.className = 'dshwv-usage-card';
  mask.appendChild(card);
  mask.addEventListener('click', event => { if (event.target === mask) close(); });
  document.body.appendChild(mask);

  function getUsageSet() { return usageSet; }
  function setUsageSet(value) { usageSet = value; }

  function load(cb) {
    try {
      requestJson(settingsUrl).then(d => {
        if (d && d.ok && d.usage) usageSet = d.usage;
        if (cb) cb();
      }).catch(() => { if (cb) cb(); });
    } catch { if (cb) cb(); }
  }

  function save(patch) {
    try {
      updateSoundSettings(
        current => ({ size: current.size, usage: Object.assign({}, current.usage, patch || {}) }),
        saved => { if (saved && saved.usage) usageSet = saved.usage; },
      );
    } catch (error) { assetFailure(error); }
  }

  function refresh() {
    const main = getMain();
    if (!main) return;
    main.innerHTML = '';
    const body = document.createElement('div');
    body.textContent = '加载中…';
    main.appendChild(body);
    requestJson(recordsUrl).then(d => {
      if (d && d.ok && d.settings) usageSet = d.settings;
      assetWarning(d);
      WhaleMoney.refreshBindings(getPanel());
      fill(d);
      if (d && d.ok && d.today && isFinite(Number(d.today.total))) {
        const total = Number(d.today.total), state = getState();
        if (state.todayUsage === null || total >= state.todayUsage) state.todayUsage = total;
      }
    }).catch(() => { main.textContent = '记录加载失败'; });
  }

  function reconcile() {
    requestJson('/api/reconcile').then(data => {
      if (!data || data.ok === false) throw new Error((data && data.error) || '账本读取失败');
      const editorMask = document.createElement('div'); editorMask.className = 'dshwv-bubmask'; openOver(null, editorMask);
      const editor = document.createElement('div'); editor.className = 'dshwv-bubcard'; editorMask.appendChild(editor);
      const title = document.createElement('div'); title.className = 'dshwv-bubtitle'; title.textContent = '校正今日 API 消耗'; editor.appendChild(title);
      const tip = document.createElement('p'); tip.className = 'dshwv-usage-hint'; tip.textContent = '期初 + 充值 − 其他支出 − 期末 = 今日消耗。保存时会检查账本版本，避免覆盖另一处修改。'; editor.appendChild(tip);
      const fields = {}, current = typeof getState().balance === 'number' ? getState().balance : 0, today = Number(data.today && data.today.total) || 0;
      [['opening', '期初余额', current + today], ['credits', '今日充值', 0], ['otherDebits', '其他支出', 0], ['last', '期末余额', current]].forEach(spec => {
        const rowElement = document.createElement('label'); rowElement.className = 'whale-sound-row'; rowElement.textContent = spec[1];
        const input = document.createElement('input'); input.type = 'number'; input.min = '0'; input.step = '0.00000001'; input.className = 'dshwv-number'; input.value = String(Math.max(0, spec[2]));
        rowElement.appendChild(input); editor.appendChild(rowElement); fields[spec[0]] = input;
      });
      const status = document.createElement('p'); status.className = 'whale-sound-error'; status.hidden = true; editor.appendChild(status);
      const actions = document.createElement('div'); actions.className = 'dshwv-bubbtns'; editor.appendChild(actions);
      const button = (label, className, listener) => { const b = document.createElement('button'); b.type = 'button'; b.className = 'dshwv-bubbtn ' + className; b.textContent = label; b.addEventListener('click', listener); actions.appendChild(b); return b; };
      button('取消', 'dshwv-bubbtn-no', () => { editorMask.remove(); });
      const saveButton = button('保存校正', 'dshwv-bubbtn-ok', () => {
        const payload = { revision: Number(data.revision || 0), date: getTodayKey() };
        for (const key in fields) { payload[key] = Number(fields[key].value); if (!isFinite(payload[key]) || payload[key] < 0) { fields[key].focus(); return; } }
        saveButton.disabled = true; status.hidden = true;
        requestJson('/api/reconcile', { method: 'POST', body: payload }).then(() => {
          editorMask.remove(); refresh(); refreshBalance(true);
        }).catch(error => { status.textContent = error.message || '余额校正失败'; status.hidden = false; saveButton.disabled = false; });
      });
      editorMask.addEventListener('click', event => { if (event.target === editorMask) editorMask.remove(); });
      document.body.appendChild(editorMask);
    }).catch(error => assetFailure(error));
  }

  function openRecords() {
    card.innerHTML = '<div style="padding:10px;color:#203170">加载中…</div>';
    mask.style.display = 'flex';
    requestJson(recordsUrl).then(d => {
      getRecordsView().fill(d);
      assetWarning(d);
    }).catch(() => {
      card.innerHTML = '<div style="padding:10px;color:#203170">加载失败</div>';
    });
  }

  function close() { mask.style.display = 'none'; }

  return { load, save, refresh, reconcile, openRecords, close, getUsageSet, setUsageSet, card, mask };
}

// Shell construction belongs beside the usage model, independent of menu layout.
export function createUsageShell({ document, button }) {
  const panel = document.createElement('div');
  panel.className = 'dshwv-usage-sub'; panel.style.display = 'none';
  const area = document.createElement('div'); area.className = 'dshwv-usage-area';
  area.style.cssText = 'flex:1 1 auto;min-height:0;overflow:hidden;position:relative';
  area.appendChild(panel);
  const navigationRow = document.createElement('div'); navigationRow.className = 'dshwv-menu-row';
  navigationRow.style.flex = '0 0 auto'; button.style.width = '100%'; navigationRow.appendChild(button);
  function build(buildModels) {
    panel.innerHTML = '';
    const title = document.createElement('div'); title.className = 'dshwv-usage-subtitle';
    title.textContent = '- = 小龙娘记账 = -'; panel.appendChild(title);
    buildModels();
    const main = document.createElement('div'); main.className = 'dshwv-usagebody'; panel.appendChild(main);
    return main;
  }
  return { panel, area, navigationRow, build };
}
