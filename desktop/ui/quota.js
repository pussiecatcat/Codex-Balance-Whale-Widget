(() => {
  'use strict';
  const labels = { 300: '5 小时', 10080: '每周' };
  const validPercent = value => typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 100;
  const timeValue = value => typeof value === 'number' && value < 1e12 ? value * 1000 : value;
  function countdown(reset, now = Date.now()) {
    const time = timeValue(reset);
    if (!Number.isFinite(time)) return '未观测';
    if (time <= now) return '等待额度更新';
    let seconds = Math.ceil((time - now) / 1000);
    const days = Math.floor(seconds / 86400); seconds %= 86400;
    const hours = Math.floor(seconds / 3600); seconds %= 3600;
    const minutes = Math.floor(seconds / 60); seconds %= 60;
    return (days ? days + '天 ' : '') + [hours, minutes, seconds].map(n => String(n).padStart(2, '0')).join(':');
  }
  function countdownShort(reset, now = Date.now()) {
    const time = timeValue(reset);
    if (!Number.isFinite(time)) return '等待同步';
    if (time <= now) return '等待刷新';
    let seconds = Math.ceil((time - now) / 1000);
    const days = Math.floor(seconds / 86400); seconds %= 86400;
    const hours = Math.floor(seconds / 3600); seconds %= 3600;
    const minutes = Math.floor(seconds / 60);
    if (days) return `${days}天 ${String(hours).padStart(2, '0')}小时`;
    if (hours) return `${hours}小时 ${String(minutes).padStart(2, '0')}分`;
    return `${Math.max(1, minutes)}分钟`;
  }
  function resetAt(reset) {
    const time = timeValue(reset);
    if (!Number.isFinite(time)) return '等待同步';
    const value = new Date(time);
    if (!Number.isFinite(value.getTime())) return '等待同步';
    return value.toLocaleString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false });
  }
  function snapshotAt(value) {
    const time = timeValue(value);
    if (!Number.isFinite(time)) return '未同步';
    const date = new Date(time);
    if (!Number.isFinite(date.getTime())) return '未同步';
    return [date.getHours(), date.getMinutes(), date.getSeconds()].map(part => String(part).padStart(2, '0')).join(':');
  }
  function percentNumber(value) {
    if (!validPercent(value)) return '—';
    return Math.abs(value - Math.round(value)) < 1e-9 ? String(Math.round(value)) : value.toFixed(1);
  }
  function quotaBar(left, width = 8) {
    if (!validPercent(left)) return '────────';
    const filled = Math.max(0, Math.min(width, Math.round(left / 100 * width)));
    return '━'.repeat(filled) + '─'.repeat(width - filled);
  }
  function fill(template, map) {
    return String(template).replace(/\{([a-z0-9_]+)\}/gi, (all, key) => Object.hasOwn(map, key) ? map[key] : all);
  }
  function quotaState(module, subscription, now = Date.now()) {
    const minutes = module?.windowDurationMins === 10080 ? 10080 : 300;
    const item = subscription?.windows?.find(value => value.windowDurationMins === minutes);
    const resetExpired = item && Number.isFinite(item.resetsAt) && timeValue(item.resetsAt) <= now;
    const expired = item && (subscription?.stale || item.stale || resetExpired ||
      subscription?.source === 'local-session' && now - item.observedAt > 15 * 60000 ||
      subscription?.source === 'codex-app-server' && now - subscription.observedAt > 2 * 60000);
    // An old observation remains useful, but must never masquerade as a live value.
    const valid = item && validPercent(item.usedPercent);
    const left = valid ? Math.max(0, 100 - item.usedPercent) : null;
    const observedAt = item?.observedAt || subscription?.observedAt || null;
    const map = {
      quota_label: labels[minutes], quota_left: valid ? left.toFixed(1) + '%' : '未观测',
      quota_left_round: valid ? Math.round(left) + '%' : '未观测', quota_used: valid ? item.usedPercent.toFixed(1) + '%' : '未观测',
      quota_reset: item ? countdown(item.resetsAt, now) : '未观测', quota_reset_short: item ? countdownShort(item.resetsAt, now) : '等待同步',
      quota_reset_at: item ? resetAt(item.resetsAt) : '等待同步', quota_bar: quotaBar(left),
      quota_updated_at: snapshotAt(observedAt),
      quota_source: subscription?.source === 'codex-app-server' ? 'Codex 实时查询' : subscription?.source === 'local-session' ? '本机会话记录' : '正在读取额度',
    };
    const tone = !valid || expired ? 'unknown' : left <= 15 ? 'critical' : left <= 35 ? 'caution' : 'steady';
    return { minutes, item, observedAt, expired, valid, left, map, tone };
  }
  function quotaText(module, subscription, now = Date.now()) {
    const state = quotaState(module, subscription, now);
    const result = fill(module?.tpl || '{quota_label}剩余 {quota_left} · {quota_reset}', state.map);
    return result + (state.expired ? '（上次数据，待同步）' : '');
  }
  function planName(type) {
    const key = String(type || '').toLowerCase();
    if (!key) return 'Codex 订阅';
    const names = { plus: 'Codex Plus', pro: 'Codex Pro', team: 'Codex Team', business: 'Codex Business', enterprise: 'Codex Enterprise', free: 'Codex Free' };
    return names[key] || 'Codex ' + String(type).replace(/[_-]+/g, ' ');
  }
  function planText(module, subscription) {
    const type = subscription?.planType || '';
    return fill(module?.tpl || '{plan_name}', { plan_name: planName(type), plan_type: type || 'unknown' });
  }
  function peakText(module, pricing, now = Date.now()) {
    if (!pricing?.visible) return fill(module?.tpl || '{peak_phase}', { peak_phase: '当前 API 无峰谷时段', peak_countdown: '—', peak_switch_at: '—', peak_note: '' });
    const isPeak = pricing.phase === 'peak', style = module?.type === 'nextpeak' ? 'count' : module?.peakStyle || 'default';
    const phase = pricing.phase === 'unknown' ? '时段规则待更新' : style === 'liangwen' ? (isPeak ? '梁文峰' : '梁文谷') : style === 'qiangqiang' ? (isPeak ? '!?峰峰?!' : '!?谷谷?!') : style === 'mini' ? (isPeak ? '峰' : '谷') : (isPeak ? '高峰时段' : '空闲时段');
    const map = { peak_phase: phase, peak_countdown: pricing.nextChangeAt ? countdown(pricing.nextChangeAt, now) : '等待规则更新',
      peak_switch_at: pricing.nextChangeAt ? resetAt(pricing.nextChangeAt) : '等待规则更新', peak_note: pricing.note || '' };
    map.status = map.peak_phase; map.countdown = map.peak_countdown;
    return fill(module?.tpl || (style === 'count' ? '{peak_countdown}' : '{peak_phase}'), map);
  }
  function moduleText(module, subscription, pricing, now = Date.now()) {
    if (module?.type === 'plan') return planText(module, subscription);
    if (module?.type === 'peak' || module?.type === 'nextpeak') return peakText(module, pricing, now);
    return quotaText(module, subscription, now);
  }
  if (typeof module !== 'undefined' && module.exports) module.exports = { countdown, countdownShort, resetAt, snapshotAt, percentNumber, quotaBar, quotaState, quotaText, planText, peakText, moduleText, planName };
  if (typeof window === 'undefined' || typeof document === 'undefined') return;
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
    reset.textContent = state.item ? '重置 ' + countdown(state.item.resetsAt) : syncStatus || '首次同步中…';
    element.title = state.expired ? '显示上次成功取得的额度；当前数值待同步。' : syncStatus;
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
    if (!force && fetchedAt && Date.now() - fetchedAt < interval) return subscription;
    const ownRevision = revision, current = { force, promise: null, abort: new AbortController() };
    syncing = true; paint();
    current.promise = (async () => {
      const timeout = setTimeout(() => current.abort.abort(), 22000);
      try {
        const response = await fetch('/api/quota' + (force ? '?refresh=1' : ''), { cache: 'no-store', signal: current.abort.signal });
        if (!response.ok) throw Error('unavailable');
        const data = await response.json();
        if (ownRevision !== revision || stopped) return subscription;
        if (!data.subscription || data.ok === false) throw Error('unavailable');
        const before = JSON.stringify(subscription?.windows?.map(item => [item.windowDurationMins, item.usedPercent, item.resetsAt]));
        subscription = data.subscription;
        const after = JSON.stringify(subscription.windows?.map(item => [item.windowDurationMins, item.usedPercent, item.resetsAt]));
        const failed = ['stale', 'error'].includes(subscription.status);
        failures = failed ? Math.min(5, failures + 1) : 0;
        syncStatus = failed ? '同步失败，稍后重试' : subscription.status === 'unauthenticated' ? '请登录 Codex' :
          !subscription.available ? subscription.reason || '暂无额度窗口' : before === after ? '已同步，额度未变化' : '额度已更新';
      } catch {
        if (ownRevision !== revision || stopped) return subscription;
        failures = Math.min(5, failures + 1);
        if (subscription) subscription = { ...subscription, stale: true };
        syncStatus = '同步失败，稍后重试';
      } finally {
        clearTimeout(timeout);
        if (ownRevision === revision) { fetchedAt = Date.now(); syncing = false; paint(); }
      }
      return subscription;
    })().finally(() => { if (pending === current) pending = null; });
    pending = current;
    // Pricing has its own cadence and cannot block quota rendering.
    if (!pricingAt || Date.now() - pricingAt >= 60000) {
      pricingAt = Date.now();
      fetch('/api/pricing', { cache: 'no-store' }).then(r => r.ok ? r.json() : null).then(data => {
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
    for (const timer of settledTimers) clearTimeout(timer);
    settledTimers = [0, 3000, 8000, 15000].map(delay => setTimeout(() => refresh(true), delay));
  }
  function startTicker() {
    if (!ticker && !stopped) ticker = setInterval(() => { paint(); if (active || bindings.size) refresh(); }, 1000);
  }
  window.addEventListener('whale-account-view', event => {
    revision++; pending?.abort.abort(); pending = null; fetchedAt = 0; failures = 0; syncing = false;
    active = event.detail?.mode === 'subscription'; subscription = null;
    for (const timer of settledTimers) clearTimeout(timer);
    settledTimers = [];
    if (active) { startTicker(); refresh(true); }
    else { clearInterval(ticker); ticker = null; paint(); }
  });
  window.addEventListener('online', () => { if (active) refresh(true); });
  window.addEventListener('focus', () => { if (active) refresh(); });
  window.addEventListener('pagehide', () => {
    stopped = true; revision++; pending?.abort.abort(); clearInterval(ticker);
    for (const timer of settledTimers) clearTimeout(timer); settledTimers = [];
  }, { once: true });
  window.WhaleQuota = { bind, clearBindings, refresh, settled, countdown, countdownShort, resetAt, snapshotAt, quotaBar, text: module => moduleText(module, subscription, pricing) };
})();
