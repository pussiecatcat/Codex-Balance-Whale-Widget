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
  function quotaBar(left, width = 8) {
    if (!validPercent(left)) return '────────';
    const filled = Math.max(0, Math.min(width, Math.round(left / 100 * width)));
    return '━'.repeat(filled) + '─'.repeat(width - filled);
  }
  function fill(template, map) {
    return String(template).replace(/\{([a-z0-9_]+)\}/gi, (all, key) => Object.hasOwn(map, key) ? map[key] : all);
  }
  function quotaText(module, subscription, now = Date.now()) {
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
    const result = fill(module?.tpl || '{quota_label}剩余 {quota_left} · {quota_reset}', map);
    return result + (expired ? '（数据已过期）' : '');
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
  if (typeof module !== 'undefined' && module.exports) module.exports = { countdown, countdownShort, resetAt, quotaBar, quotaText, planText, peakText, moduleText, planName };
  if (typeof window === 'undefined' || typeof document === 'undefined') return;
  let subscription = null, pricing = null, fetchedAt = 0, pending = null, ticker = null;
  const bindings = new Map();
  function paint() {
    for (const [element, module] of bindings) {
      if (!element.isConnected) { bindings.delete(element); continue; }
      element.textContent = moduleText(module, subscription, pricing);
      if (module?.type === 'peak' || module?.type === 'nextpeak') applyPeakStyle(element, module, pricing);
      element.title = module?.type === 'peak' || module?.type === 'nextpeak' ? (pricing?.note || 'DeepSeek 峰谷时段') :
        subscription?.source === 'codex-app-server' ? 'Codex 实时查询' : '本机会话额度记录';
    }
    if (!bindings.size && ticker) { clearInterval(ticker); ticker = null; }
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
    if (pending) return pending;
    if (!force && Date.now() - fetchedAt < 30000 && !(pricing?.nextChangeAt && pricing.nextChangeAt <= Date.now() && Date.now() - fetchedAt >= 1000)) return subscription;
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
    bindings.set(element, module); element.textContent = moduleText(module, subscription, pricing);
    if (!ticker) ticker = setInterval(() => { paint(); if (bindings.size) refresh(); }, 1000);
    refresh();
  }
  function clearBindings(root) {
    for (const element of bindings.keys()) if (element === root || root.contains(element)) bindings.delete(element);
    if (!bindings.size && ticker) { clearInterval(ticker); ticker = null; }
  }
  window.WhaleQuota = { bind, clearBindings, refresh, countdown, countdownShort, resetAt, quotaBar, text: module => moduleText(module, subscription, pricing) };
})();
