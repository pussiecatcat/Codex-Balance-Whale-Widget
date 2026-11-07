import { needsModelPolling, nextPollDelay } from '../model-polling.js';
import { statusForCode, statusForError, statusView } from '../../../shared/status-tones.js';
import { requestJson } from '../../../services/request.js';

const CACHE_MS = 30000;
const LEDGER_OFFSET_MS = 8 * 3600000;

// The API model store owns the registry snapshot, the per-model observed values
// and the polling loop. It used to publish `window.WhaleApiModels` and talk to
// the rest of the widget through custom events; the composition root now passes
// the store instance and two callbacks instead.
export function createApiModelsStore({
  request = requestJson,
  quota = null,
  money = null,
  document: doc = globalThis.document,
  storage = null,
  onAlert = () => {},
  onChanged = () => {},
  now = Date.now,
} = {}) {
  let registry = { templates: [], models: [] };
  let loadedAt = 0;
  let pending = null;
  const values = new Map();
  const bindings = new Map();
  const failures = new Map();
  const store = storage || { getItem() { return null; }, setItem() {} };

  const call = (url, method = 'GET', body) => request(url, { method, body });
  const modelOf = id => registry.models.find(item => item.id === id) || null;
  const modelName = id => modelOf(id)?.name || 'API 模型';
  const formatMoney = (amount, currency) => money?.formatMoney(amount, currency)
    || new Intl.NumberFormat('zh-CN', { style: 'currency', currency }).format(amount);

  async function load(force = false) {
    if (pending) return pending;
    if (!force && now() - loadedAt < CACHE_MS) return registry;
    pending = call('/api/models').then(data => { registry = data; loadedAt = now(); return data; }).finally(() => { pending = null; });
    return pending;
  }

  function valueText(module, value) {
    if (loadedAt && !registry.models.some(model => model.id === module.apiModelId)) return 'API 模型未配置';
    if (!value) return modelName(module.apiModelId) + ' · 加载中';
    if (value.error) return modelName(module.apiModelId) + ' · ' + statusView(statusForError(value)).label;
    const model = modelOf(module.apiModelId);
    if (module.type === 'today') {
      const tokens = Number(value.todayTokens || 0).toLocaleString() + ' tokens';
      const cost = value.todayEstimate == null ? '金额未知' : formatMoney(value.todayEstimate, value.currency || model?.currency || 'USD') + '（估算）';
      return (module.tpl || '今日 {api_tokens}').replaceAll('{api_tokens}', tokens).replaceAll('{expense_api}', cost).replaceAll('{api_cost}', cost).replaceAll('{api_name}', modelName(module.apiModelId));
    }
    if (module.type === 'plan') return (module.tpl || '{plan_name}').replaceAll('{plan_name}', modelName(module.apiModelId) + (value.level ? ' · ' + value.level : '')).replaceAll('{plan_type}', value.kind || 'API');
    if (module.type === 'quota') {
      const item = value.windows?.find(window => module.quotaKey ? window.key === module.quotaKey : true);
      const expired = item?.resetsAt && item.resetsAt <= now();
      const left = item && Number.isFinite(item.usedPercent) && !expired ? Math.max(0, 100 - item.usedPercent) : null;
      const leftText = left === null ? '未观测' : left.toFixed(1) + '%';
      const usedText = item && Number.isFinite(item.usedPercent) ? item.usedPercent.toFixed(1) + '%' : '未观测';
      return (module.tpl || '{api_name} 剩余 {api_quota_left}')
        .replaceAll('{api_name}', modelName(module.apiModelId))
        .replaceAll('{api_quota_left}', leftText)
        .replaceAll('{api_quota_used}', usedText)
        .replaceAll('{quota_left}', leftText)
        .replaceAll('{quota_left_round}', left === null ? '未观测' : Math.round(left) + '%')
        .replaceAll('{quota_used}', usedText)
        .replaceAll('{quota_label}', item?.label || '当前周期')
        .replaceAll('{quota_reset_short}', quota?.countdownShort(item?.resetsAt) || '等待同步')
        .replaceAll('{quota_reset_at}', quota?.resetAt(item?.resetsAt) || '等待同步')
        .replaceAll('{quota_reset}', quota?.countdown(item?.resetsAt) || '未观测')
        .replaceAll('{quota_bar}', quota?.quotaBar(left) || '────────')
        + (expired ? '（数据已过期）' : value.source === 'manual' ? '（手动）' : value.source === 'local-estimate' ? '（本机估算）' : '');
    }
    if (value.noBalanceApi || value.available === false) return modelName(module.apiModelId) + ' · 无公开余额接口';
    const amount = Number(value.balance);
    const display = Number.isFinite(amount) ? formatMoney(amount, value.currency || 'USD') : '未观测';
    return (module.tpl || '{api_name} {api_balance}').replaceAll('{api_name}', modelName(module.apiModelId)).replaceAll('{api_balance}', display).replaceAll('{balance_api}', display).replaceAll('{balance_ds}', display);
  }

  function checkAlerts(id, value) {
    const model = modelOf(id), alerts = model?.alerts || {};
    if (!model || value?.error) return;
    const day = new Date(now() + LEDGER_OFFSET_MS).toISOString().slice(0, 10);
    const first = value.windows?.[0];
    const left = first && Number.isFinite(first.usedPercent) ? 100 - first.usedPercent : null;
    const map = { api_name: model.name, api_balance: value.balance ?? '未知', api_cost: value.todayEstimate ?? '未知', api_quota_left: left === null ? '未知' : left.toFixed(1) + '%' };
    const resolve = (node, kind) => {
      if (Array.isArray(node)) return node.map(item => resolve(item, kind));
      if (node && typeof node === 'object') return Object.fromEntries(Object.entries(node).map(([key, item]) => [key, resolve(item, kind)]));
      if (typeof node !== 'string') return node;
      return node.replace(/\{(api_name|api_balance|api_cost|api_quota_left|below|amount|currency)\}/g, (all, name) => {
        if (name === 'below') return String(kind === 'quota' ? alerts.quotaRemainingBelow : alerts.balanceBelow);
        if (name === 'amount') return String(alerts.dailyBudget);
        if (name === 'currency') return model.currency;
        return String(map[name]);
      });
    };
    const fire = (kind, fallback, rank) => {
      const key = 'dshw-api-alert:' + day + ':' + id + ':' + kind;
      try { if (store.getItem(key)) return; store.setItem(key, '1'); } catch { /* storage may be disabled */ }
      const message = (model.messages?.[kind] || fallback).replace(/\{(api_name|api_balance|api_cost|api_quota_left)\}/g, (all, name) => String(map[name]));
      const config = model.bubbleSettings?.[kind];
      onAlert({ message, rank, lines: config?.lines?.length ? resolve(config.lines, kind) : null, config });
    };
    if (Number.isFinite(alerts.balanceBelow) && Number.isFinite(value.balance) && value.balance <= alerts.balanceBelow) fire('balance', model.name + ' 余额已低于 ' + alerts.balanceBelow + ' ' + model.currency, 2);
    if (Number.isFinite(alerts.dailyTokens) && Number(value.todayTokens) >= alerts.dailyTokens) fire('tokens', model.name + ' 今日 token 已达到 ' + Number(alerts.dailyTokens).toLocaleString(), 1);
    if (Number.isFinite(alerts.dailyBudget) && Number.isFinite(value.todayEstimate) && value.todayEstimate >= alerts.dailyBudget) fire('budget', model.name + ' 今日估算费用达到 ' + value.todayEstimate.toFixed(4) + ' ' + model.currency, 1);
    if (Number.isFinite(alerts.quotaRemainingBelow) && left !== null && !(first.resetsAt && first.resetsAt <= now()) && left <= alerts.quotaRemainingBelow) fire('quota', model.name + ' 额度仅剩 ' + left.toFixed(1) + '%', 2);
  }

  function paint() {
    for (const [element, module] of bindings) {
      if (!element.isConnected) { bindings.delete(element); continue; }
      element.textContent = valueText(module, values.get(module.apiModelId)?.data);
    }
  }

  function bind(element, module) {
    bindings.set(element, module);
    element.textContent = valueText(module, values.get(module.apiModelId)?.data);
    load().then(() => refreshValue(module.apiModelId)).catch(() => {});
  }

  function clearBindings(root) {
    for (const element of bindings.keys()) if (element === root || root.contains(element)) bindings.delete(element);
  }

  async function refreshValue(id, force = false) {
    const old = values.get(id);
    if (!force && old && now() - old.at < CACHE_MS) return old.data;
    try {
      const data = await call('/api/models/value?id=' + encodeURIComponent(id));
      values.set(id, { at: now(), data });
    } catch (error) {
      values.set(id, { at: now(), data: { error: error.message, code: error.payload?.code || error.code } });
    }
    paint(); checkAlerts(id, values.get(id).data);
    return values.get(id).data;
  }

  async function options(select, selected, changed) {
    await load();
    select.replaceChildren(new Option('当前主 API', ''));
    for (const model of registry.models) select.append(new Option(model.name, model.id));
    select.value = selected || '';
    select.onchange = () => changed(select.value);
  }

  async function monitor() {
    const data = await load().catch(() => null);
    if (!data) return;
    const bound = new Set([...bindings.values()].map(module => module.apiModelId));
    const due = data.models.filter(model => needsModelPolling(model, { bound: bound.has(model.id), visible: !doc?.hidden }))
      .filter(model => (failures.get(model.id)?.until || 0) <= now());
    await Promise.allSettled(due.map(async model => {
      const value = await refreshValue(model.id);
      if (value?.error) {
        const count = (failures.get(model.id)?.count || 0) + 1;
        failures.set(model.id, { count, until: now() + nextPollDelay(count) });
      } else failures.delete(model.id);
    }));
  }

  function invalidate() { loadedAt = 0; }
  function dropValue(id) { if (id) values.delete(id); }
  function changed() { onChanged(); }
  function start(scope) {
    scope.interval(monitor, 60000);
    scope.interval(() => { if (bindings.size) paint(); }, 1000);
    scope.on(doc, 'visibilitychange', () => { if (!doc.hidden) monitor(); });
    Promise.resolve().then(monitor);
  }

  return {
    load, options, bind, clearBindings, monitor, start, paint, formatMoney,
    text: module => valueText(module, values.get(module.apiModelId)?.data),
    refreshValue, valueText, modelOf,
    models: () => registry.models, templates: () => registry.templates,
    invalidate, dropValue, changed,
    statusForError, statusForCode, statusView,
  };
}
