import { QUOTA_LABELS as labels, countdown, countdownShort, resetAt, snapshotAt, percentNumber, quotaBar, fill, quotaState, quotaText } from '../shared/quota-format.js';
import { requestJson } from './request.js';
import { statusView } from '../shared/status-tones.js';

export function planName(type) {
    const key = String(type || '').toLowerCase();
    if (!key) return 'Codex 订阅';
    const names = { plus: 'Codex Plus', pro: 'Codex Pro', team: 'Codex Team', business: 'Codex Business', enterprise: 'Codex Enterprise', free: 'Codex Free' };
    return names[key] || 'Codex ' + String(type).replace(/[_-]+/g, ' ');
  }
export function planText(module, subscription) {
    const type = subscription?.planType || '';
    return fill(module?.tpl || '{plan_name}', { plan_name: planName(type), plan_type: type || 'unknown' });
  }
export function peakText(module, pricing, now = Date.now()) {
    if (!pricing?.visible) return fill(module?.tpl || '{peak_phase}', { peak_phase: '当前 API 无峰谷时段', peak_countdown: '—', peak_switch_at: '—', peak_note: '' });
    const isPeak = pricing.phase === 'peak', style = module?.type === 'nextpeak' ? 'count' : module?.peakStyle || 'default';
    const phase = pricing.phase === 'unknown' ? '时段规则待更新' : style === 'liangwen' ? (isPeak ? '梁文峰' : '梁文谷') : style === 'qiangqiang' ? (isPeak ? '!?峰峰?!' : '!?谷谷?!') : style === 'mini' ? (isPeak ? '峰' : '谷') : (isPeak ? '高峰时段' : '空闲时段');
    const map = { peak_phase: phase, peak_countdown: pricing.nextChangeAt ? countdown(pricing.nextChangeAt, now) : '等待规则更新',
      peak_switch_at: pricing.nextChangeAt ? resetAt(pricing.nextChangeAt) : '等待规则更新', peak_note: pricing.note || '' };
    map.status = map.peak_phase; map.countdown = map.peak_countdown;
    return fill(module?.tpl || (style === 'count' ? '{peak_countdown}' : '{peak_phase}'), map);
  }
export function moduleText(module, subscription, pricing, now = Date.now()) {
    if (module?.type === 'plan') return planText(module, subscription);
    if (module?.type === 'peak' || module?.type === 'nextpeak') return peakText(module, pricing, now);
    return quotaText(module, subscription, now);
  }
  export function createQuotaRuntime({
  window: win = globalThis,
  requestJson: requestFn = requestJson,
  statusView: viewFn = statusView,
  setTimeout: setTimer = globalThis.setTimeout,
  clearTimeout: clearTimer = globalThis.clearTimeout,
  setInterval: setTimerInterval = globalThis.setInterval,
  clearInterval: clearTimerInterval = globalThis.clearInterval,
  now: nowFn = Date.now,
} = {}) {
let subscription = null, pricing = null, fetchedAt = 0, pending = null, ticker = null, settledTimers = [];
  let active = false, stopped = false, revision = 0, failures = 0, syncing = false, syncStatus = '', pricingAt = 0;
  const bindings = new Map();
  function ensureQuotaMeter(element) {
    if (element.querySelector('.dshwv-quota-meter-head')) return;
    element.textContent = '';
    element.classList.add('dshwv-quota-meter');
    element.setAttribute('role', 'img');
    const head = document.createElement('span');
    head.className = 'dshwv-quota-meter-head';
    const label = document.createElement('span');
    label.className = 'dshwv-quota-meter-label';
    const value = document.createElement('span');
    value.className = 'dshwv-quota-meter-value';
    const number = document.createElement('strong');
    number.className = 'dshwv-quota-meter-number';
    const unit = document.createElement('span');
    unit.className = 'dshwv-quota-meter-unit';
    unit.textContent = '%';
    value.append(number, unit);
    head.append(label, value);
    const track = document.createElement('span');
    track.className = 'dshwv-quota-meter-track';
    const fill = document.createElement('span');
    fill.className = 'dshwv-quota-meter-fill';
    track.appendChild(fill);
    const foot = document.createElement('span');
    foot.className = 'dshwv-quota-meter-foot';
    const resetLabel = document.createElement('span');
    resetLabel.className = 'dshwv-quota-meter-reset-label';
    resetLabel.textContent = '重置';
    const reset = document.createElement('span');
    reset.className = 'dshwv-quota-meter-reset';
    foot.append(resetLabel, reset);
    element.append(head, track, foot);
  }
  function paintQuotaMeter(element, module) {
    const state = quotaState(module, subscription);
    ensureQuotaMeter(element);
    element.classList.toggle('dshwv-quota-meter-weekly', state.minutes === 10080);
    element.dataset.quotaTone = state.tone;
    const label = element.querySelector('.dshwv-quota-meter-label');
    const number = element.querySelector('.dshwv-quota-meter-number');
    const unit = element.querySelector('.dshwv-quota-meter-unit');
    const fill = element.querySelector('.dshwv-quota-meter-fill');
    const resetLabel = element.querySelector('.dshwv-quota-meter-reset-label');
    const reset = element.querySelector('.dshwv-quota-meter-reset');
    label.textContent = labels[state.minutes];
    number.textContent = percentNumber(state.left);
    unit.hidden = !state.valid;
    fill.style.width = state.valid ? Math.max(0, Math.min(100, state.left)) + '%' : '0%';
    resetLabel.textContent = syncing ? '正在同步…' : state.expired ? '上次 ' + snapshotAt(state.observedAt) :
      state.item ? snapshotAt(state.observedAt) + ' 更新' : '状态';
    reset.textContent = state.item ? '重置 ' + countdownShort(state.item.resetsAt) : syncStatus || '首次同步中…';
    element.title = state.item ? '更新于 ' + snapshotAt(state.observedAt) + '，重置倒计时 ' + countdown(state.item.resetsAt) : syncStatus;
    const spokenValue = state.valid ? percentNumber(state.left) + '%' : '未观测';
    element.setAttribute('aria-label', labels[state.minutes] + '剩余' + spokenValue + '，' + resetLabel.textContent + '，' + reset.textContent);
  }
  function paint() {
    for (const [element, module] of bindings) {
      if (!element.isConnected) { bindings.delete(element); continue; }
      if (module?.type === 'quota' && module?.quotaStyle === 'meter' && !module?.apiModelId) paintQuotaMeter(element, module);
      else element.textContent = moduleText(module, subscription, pricing);
      if (module?.type === 'peak' || module?.type === 'nextpeak') applyPeakStyle(element, module, pricing);
      element.title = module?.type === 'peak' || module?.type === 'nextpeak' ? (pricing?.note || 'DeepSeek 峰谷时段') :
        (subscription?.stale ? '上次成功数据 · ' : '') + (syncStatus || '正在同步额度');
    }
  }
  function applyPeakStyle(element, module, pricing) {
    if (!pricing?.visible || pricing.phase === 'unknown') return;
    const prefix = pricing.phase === 'peak' ? 'peak' : 'off';
    const row = element.closest('.dshwv-trow') || element;
    const rgb = module[prefix + 'Rgb'], bgRgb = module[prefix + 'BgRgb'];
    for (const node of new Set([element, row])) {
      for (const cls of [...node.classList]) if (cls === 'dshwv-rgb' || cls.startsWith('dshwv-rgb-') || cls === 'dshwv-bgrgb' || cls.startsWith('dshwv-bgrgb-')) node.classList.remove(cls);
    }
    const schemes = ['macaron','candy','rouge','bamboo','aurora','deepsea','sunset','forest','champagne','lavender','mint','lava','galaxy','ink','indigo'];
    if (rgb) { element.classList.add('dshwv-rgb'); if (schemes.includes(rgb) && rgb !== 'macaron') element.classList.add('dshwv-rgb-' + rgb); }
    row.style.color = rgb ? '' : module[prefix + 'Color'] || module.color || (prefix === 'peak' ? '#e0433f' : '#2fa24c');
    row.style.background = bgRgb ? '' : module[prefix + 'Bg'] || '';
    if (bgRgb) { row.classList.add('dshwv-bgrgb'); if (schemes.includes(bgRgb) && bgRgb !== 'macaron') row.classList.add('dshwv-bgrgb-' + bgRgb); }
    row.style.padding = bgRgb || module[prefix + 'Bg'] ? '1px 6px' : '';
    row.style.borderRadius = '7px'; row.style.fontVariantNumeric = 'tabular-nums';
  }
  async function refresh(force = false) {
    if (stopped) return subscription;
    if (pending) {
      if (!force || pending.force) return pending.promise;
      const queuedRevision = revision;
      return pending.promise.then(() => queuedRevision === revision ? refresh(true) : subscription);
    }
    const interval = failures ? Math.min(30000, 3000 * 2 ** (failures - 1)) : bindings.size ? 10000 : 30000;
    if (!force && fetchedAt && nowFn() - fetchedAt < interval) return subscription;
    const ownRevision = revision, current = { force, promise: null, abort: new AbortController() };
    syncing = true; paint();
    current.promise = (async () => {
      const timeout = setTimer(() => current.abort.abort(), 22000);
      try {
        const data = await requestFn('/api/quota' + (force ? '?refresh=1' : ''), { signal: current.abort.signal });
        if (ownRevision !== revision || stopped) return subscription;
        if (!data.subscription || data.ok === false) throw Error('unavailable');
        const before = JSON.stringify(subscription?.windows?.map(item => [item.windowDurationMins, item.usedPercent, item.resetsAt]));
        subscription = data.subscription;
        const after = JSON.stringify(subscription.windows?.map(item => [item.windowDurationMins, item.usedPercent, item.resetsAt]));
        const failed = ['stale', 'error'].includes(subscription.status);
        failures = failed ? Math.min(5, failures + 1) : 0;
        const view = viewFn(subscription.status, { failed, changed: before !== after, reason: subscription.reason || '暂无额度窗口' });
        syncStatus = failed ? '同步失败，稍后重试' : view.label;
      } catch {
        if (ownRevision !== revision || stopped) return subscription;
        failures = Math.min(5, failures + 1);
        if (subscription) subscription = { ...subscription, stale: true };
        syncStatus = '同步失败，稍后重试';
      } finally {
        clearTimer(timeout);
        if (ownRevision === revision) { fetchedAt = nowFn(); syncing = false; paint(); }
      }
      return subscription;
    })().finally(() => { if (pending === current) pending = null; });
    pending = current;
    // Pricing has its own cadence and cannot block quota rendering.
    if (!pricingAt || nowFn() - pricingAt >= 60000) {
      pricingAt = nowFn();
      requestFn('/api/pricing').then(data => {
        if (data && ownRevision === revision && !stopped) { pricing = data; paint(); }
      }).catch(() => {});
    }
    return current.promise;
  }
  function bind(element, module) {
    bindings.set(element, module);
    if (module?.type === 'quota' && module?.quotaStyle === 'meter' && !module?.apiModelId) paintQuotaMeter(element, module);
    else element.textContent = moduleText(module, subscription, pricing);
    startTicker();
    refresh();
  }
  function clearBindings(root) {
    for (const element of bindings.keys()) if (element === root || root.contains(element)) bindings.delete(element);
  }
  function settled() {
    for (const timer of settledTimers) clearTimer(timer);
    settledTimers = [0, 3000, 8000, 15000].map(delay => setTimer(() => refresh(true), delay));
  }
  function startTicker() {
    if (!ticker && !stopped) ticker = setTimerInterval(() => { paint(); if (active || bindings.size) refresh(); }, 1000);
  }
  win.addEventListener('online', () => { if (active) refresh(true); });
  win.addEventListener('focus', () => { if (active) refresh(); });
  win.addEventListener('pagehide', () => {
    stopped = true; revision++; pending?.abort.abort(); clearTimerInterval(ticker);
    for (const timer of settledTimers) clearTimer(timer); settledTimers = [];
  }, { once: true });
  function sourceLine() {
    if (!subscription) return '额度加载中…';
    const at = snapshotAt(subscription.observedAt);
    if (subscription.status === 'unauthenticated') return '请登录 Codex';
    if (subscription.status === 'unavailable' || subscription.available === false) return 'Codex 暂未返回额度';
    if (subscription.stale) return '上次数据' + (at ? ' · ' + at : '') + ' · 正在重试';
    if (subscription.source === 'local-session') return '本机会话记录 · 非实时';
    if (subscription.source === 'codex-app-server') return 'Codex 官方' + (at ? ' · ' + at + ' 更新' : '');
    return 'Codex 额度' + (at ? ' · ' + at + ' 更新' : '');
  }
  
  function setSubscriptionMode(mode) {
    revision++; pending?.abort.abort(); pending = null; fetchedAt = 0; failures = 0; syncing = false;
    active = mode === 'subscription'; subscription = null;
    for (const timer of settledTimers) clearTimer(timer);
    settledTimers = [];
    if (active) { startTicker(); refresh(true); }
    else { clearTimerInterval(ticker); ticker = null; paint(); }
  }
  return { bind, clearBindings, refresh, settled, countdown, countdownShort, resetAt, snapshotAt, quotaBar, sourceLine, setSubscriptionMode, text: (module, at = nowFn()) => moduleText(module, subscription, pricing, at) };
}

export const WhaleQuota = typeof window !== 'undefined' ? createQuotaRuntime() : null;
export default WhaleQuota;
export { countdown, countdownShort, resetAt, snapshotAt, percentNumber, quotaBar, quotaState, quotaText, fill, labels };
