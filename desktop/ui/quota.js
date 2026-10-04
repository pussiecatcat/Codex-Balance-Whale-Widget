(() => {
  'use strict';
  const labels = { 300: '5 小时', 10080: '每周' };
  const validPercent = value => typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 100;
  const timeValue = value => typeof value === 'number' && value < 1e12 ? value * 1000 : value;
  // The longest real window is weekly. A reset further out than this is a corrupt
  // or unit-confused value (milliseconds read back as seconds), not a quota
  // window. Rendered as a countdown it produced strings like "12000000天 00:00:00".
  const MAX_RESET_AHEAD_MS = 10 * 365 * 86400000;
  function countdown(reset, now = Date.now()) {
    const time = timeValue(reset);
    if (!Number.isFinite(time) || time > now + MAX_RESET_AHEAD_MS) return '未观测';
    if (time <= now) return '等待额度更新';
    let seconds = Math.ceil((time - now) / 1000);
    const days = Math.floor(seconds / 86400); seconds %= 86400;
    const hours = Math.floor(seconds / 3600); seconds %= 3600;
    const minutes = Math.floor(seconds / 60); seconds %= 60;
    return (days ? days + '天 ' : '') + [hours, minutes, seconds].map(n => String(n).padStart(2, '0')).join(':');
  }
  function countdownShort(reset, now = Date.now()) {
    const time = timeValue(reset);
    if (!Number.isFinite(time) || time > now + MAX_RESET_AHEAD_MS) return '等待同步';
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
    if (!Number.isFinite(time) || time > Date.now() + MAX_RESET_AHEAD_MS) return '等待同步';
    const value = new Date(time);
    if (!Number.isFinite(value.getTime())) return '等待同步';
    return value.toLocaleString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false });
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
    const expired = item && (item.stale || resetExpired ||
      subscription?.source === 'local-session' && now - item.observedAt > 15 * 60000 ||
      subscription?.source === 'codex-app-server' && now - subscription.observedAt > 2 * 60000);
    const valid = item && validPercent(item.usedPercent) && !expired;
    const left = valid ? Math.max(0, 100 - item.usedPercent) : null;
    const map = {
      quota_label: labels[minutes], quota_left: valid ? left.toFixed(1) + '%' : '未观测',
      quota_left_round: valid ? Math.round(left) + '%' : '未观测', quota_used: valid ? item.usedPercent.toFixed(1) + '%' : '未观测',
      quota_reset: item ? countdown(item.resetsAt, now) : '未观测', quota_reset_short: item ? countdownShort(item.resetsAt, now) : '等待同步',
      quota_reset_at: item ? resetAt(item.resetsAt) : '等待同步', quota_bar: quotaBar(left),
      quota_source: subscription?.source === 'codex-app-server' ? 'Codex 实时查询' : subscription?.source === 'local-session' ? '本机会话记录' : '正在读取额度',
    };
    const tone = !valid ? 'unknown' : left <= 15 ? 'critical' : left <= 35 ? 'caution' : 'steady';
    return { minutes, item, expired, valid, left, map, tone };
  }
  function quotaText(module, subscription, now = Date.now()) {
    const state = quotaState(module, subscription, now);
    const result = fill(module?.tpl || '{quota_label}剩余 {quota_left} · {quota_reset}', state.map);
    return result + (state.expired ? '（数据已过期）' : '');
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
  if (typeof module !== 'undefined' && module.exports) module.exports = { countdown, countdownShort, resetAt, quotaBar, quotaState, quotaText, planText, peakText, moduleText, planName };
  if (typeof window === 'undefined' || typeof document === 'undefined') return;
  let subscription = null, pricing = null, fetchedAt = 0, pending = null, ticker = null, boundaryStreak = 0;
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
    number.textContent = state.valid ? String(Math.round(state.left)) : '—';
    unit.hidden = !state.valid;
    fill.style.width = state.valid ? Math.max(0, Math.min(100, state.left)) + '%' : '0%';
    resetLabel.textContent = state.expired ? '状态' : '重置';
    reset.textContent = state.expired ? '额度待刷新' : state.item ? countdown(state.item.resetsAt) : '等待同步';
    const spokenValue = state.valid ? Math.round(state.left) + '%' : '未观测';
    element.setAttribute('aria-label', labels[state.minutes] + '剩余' + spokenValue + '，' + resetLabel.textContent + reset.textContent);
  }
  function paint() {
    for (const [element, module] of bindings) {
      if (!element.isConnected) { bindings.delete(element); continue; }
      if (module?.type === 'quota' && module?.quotaStyle === 'meter' && !module?.apiModelId) paintQuotaMeter(element, module);
      else element.textContent = moduleText(module, subscription, pricing);
      if (module?.type === 'peak' || module?.type === 'nextpeak') applyPeakStyle(element, module, pricing);
      element.title = module?.type === 'peak' || module?.type === 'nextpeak' ? (pricing?.note || 'DeepSeek 峰谷时段') :
        subscription?.source === 'codex-app-server' ? 'Codex 实时查询' : '本机会话额度记录';
    }
    if (!bindings.size && ticker) { clearInterval(ticker); ticker = null; }
  }
  // applyPeakStyle writes inline colour/background/padding onto the row and adds
  // scheme classes. When the pricing rule later goes away (API switch, rule
  // update, "no peak rule"), the old early return left all of it in place: a
  // frozen peak-red row with 6px padding that no longer describes anything, and
  // one that also skewed the row size the window-shape rects are measured from.
  // Snapshot what we are about to overwrite so the fallback restores exactly it,
  // instead of blanking styling the bubble editor owns.
  const peakSnapshots = new WeakMap();
  const isPeakSchemeClass = cls => cls === 'dshwv-rgb' || cls.startsWith('dshwv-rgb-') || cls === 'dshwv-bgrgb' || cls.startsWith('dshwv-bgrgb-');
  function restorePeakStyle(element) {
    const saved = peakSnapshots.get(element);
    if (!saved) return;
    peakSnapshots.delete(element);
    for (const snap of saved) {
      for (const cls of [...snap.node.classList]) if (isPeakSchemeClass(cls)) snap.node.classList.remove(cls);
      for (const cls of snap.classes) snap.node.classList.add(cls);
      snap.node.style.color = snap.color;
      snap.node.style.background = snap.background;
      snap.node.style.padding = snap.padding;
      snap.node.style.borderRadius = snap.borderRadius;
      snap.node.style.fontVariantNumeric = snap.fontVariantNumeric;
    }
  }
  function applyPeakStyle(element, module, pricing) {
    if (!pricing?.visible || pricing.phase === 'unknown') { restorePeakStyle(element); return; }
    const prefix = pricing.phase === 'peak' ? 'peak' : 'off';
    const row = element.closest('.dshwv-trow') || element;
    if (!peakSnapshots.has(element)) {
      peakSnapshots.set(element, [...new Set([element, row])].map(node => ({
        node, classes: [...node.classList], color: node.style.color, background: node.style.background,
        padding: node.style.padding, borderRadius: node.style.borderRadius, fontVariantNumeric: node.style.fontVariantNumeric,
      })));
    }
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
    if (pending) return pending;
    // Crossing a peak boundary retries every second so the phase flips promptly.
    // That retry is only meant to cover the moment until the service publishes the
    // next boundary, but a rule that stays in the past kept it at 1 Hz forever —
    // two requests a second, for as long as the widget runs. After a sustained
    // streak the retry drops to the normal 30 s cadence; the streak resets as soon
    // as a fresh boundary arrives, so the fast path is unchanged in the normal case.
    const overdue = !!(pricing?.nextChangeAt && pricing.nextChangeAt <= Date.now());
    if (!force) {
      const gap = overdue && boundaryStreak < 30 ? 1000 : 30000;
      if (Date.now() - fetchedAt < gap) return subscription;
    }
    if (overdue) boundaryStreak++; else boundaryStreak = 0;
    pending = (async () => {
      try {
        const [insightResponse, pricingResponse] = await Promise.all([
          fetch('/api/insights', { cache: 'no-store' }), fetch('/api/pricing', { cache: 'no-store' })
        ]);
        if (insightResponse.ok) { const data = await insightResponse.json(); subscription = data.subscription || null; }
        if (pricingResponse.ok) { const data = await pricingResponse.json(); pricing = data || null; }
        fetchedAt = Date.now();
      } catch { fetchedAt = Date.now(); }
      paint();
      return subscription;
    })().finally(() => { pending = null; });
    return pending;
  }
  function bind(element, module) {
    bindings.set(element, module);
    if (module?.type === 'quota' && module?.quotaStyle === 'meter' && !module?.apiModelId) paintQuotaMeter(element, module);
    else element.textContent = moduleText(module, subscription, pricing);
    if (!ticker) ticker = setInterval(() => { paint(); if (bindings.size) refresh(); }, 1000);
    refresh();
  }
  function clearBindings(root) {
    for (const element of bindings.keys()) if (element === root || root.contains(element)) bindings.delete(element);
    if (!bindings.size && ticker) { clearInterval(ticker); ticker = null; }
  }
  window.WhaleQuota = { bind, clearBindings, refresh, countdown, countdownShort, resetAt, quotaBar, text: module => moduleText(module, subscription, pricing) };
})();
