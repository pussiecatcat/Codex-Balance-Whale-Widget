export const QUOTA_LABELS = { 300: '5 小时', 10080: '每周' };
const validPercent = value => typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 100;
const timeValue = value => typeof value === 'number' && value < 1e12 ? value * 1000 : value;
export function countdown(reset, now = Date.now()) {
  const time = timeValue(reset);
  if (!Number.isFinite(time)) return '未观测';
  if (time <= now) return '等待额度更新';
  let seconds = Math.ceil((time - now) / 1000);
  const days = Math.floor(seconds / 86400); seconds %= 86400;
  const hours = Math.floor(seconds / 3600); seconds %= 3600;
  const minutes = Math.floor(seconds / 60); seconds %= 60;
  return (days ? days + '天 ' : '') + [hours, minutes, seconds].map(n => String(n).padStart(2, '0')).join(':');
}
export function countdownShort(reset, now = Date.now()) {
  const time = timeValue(reset);
  if (!Number.isFinite(time)) return '等待同步';
  if (time <= now) return '等待刷新';
  let seconds = Math.ceil((time - now) / 1000);
  const days = Math.floor(seconds / 86400); seconds %= 86400;
  const hours = Math.floor(seconds / 3600); seconds %= 3600;
  const minutes = Math.floor(seconds / 60);
  const pad = value => String(value).padStart(2, '0');
  if (days) return `${pad(days)}d ${pad(hours)}h`;
  if (hours) return `${pad(hours)}h ${pad(minutes)}m`;
  return `${pad(Math.max(1, minutes))}m`;
}
export function resetAt(reset) {
  const time = timeValue(reset);
  if (!Number.isFinite(time)) return '等待同步';
  const value = new Date(time);
  if (!Number.isFinite(value.getTime())) return '等待同步';
  return value.toLocaleString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false });
}
export function snapshotAt(value) {
  const time = timeValue(value);
  if (!Number.isFinite(time)) return '未同步';
  const date = new Date(time);
  if (!Number.isFinite(date.getTime())) return '未同步';
  return [date.getHours(), date.getMinutes(), date.getSeconds()].map(part => String(part).padStart(2, '0')).join(':');
}
export function percentNumber(value) {
  if (!validPercent(value)) return '—';
  return Math.abs(value - Math.round(value)) < 1e-9 ? String(Math.round(value)) : value.toFixed(1);
}
export function quotaBar(left, width = 8) {
  if (!validPercent(left)) return '────────';
  const filled = Math.max(0, Math.min(width, Math.round(left / 100 * width)));
  return '━'.repeat(filled) + '─'.repeat(width - filled);
}
export function fill(template, map) {
  return String(template).replace(/\{([a-z0-9_]+)\}/gi, (all, key) => Object.hasOwn(map, key) ? map[key] : all);
}
export function quotaState(module, subscription, now = Date.now()) {
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
  const context = { item, subscription, minutes, valid, left, observedAt };
  const map = Object.fromEntries(TOKENS.map(token => [token.key, token.format(context, now)]));
  const tone = !valid || expired ? 'unknown' : left <= 15 ? 'critical' : left <= 35 ? 'caution' : 'steady';
  return { minutes, item, observedAt, expired, valid, left, map, tone };
}
export function quotaText(module, subscription, now = Date.now()) {
  const state = quotaState(module, subscription, now);
  const result = fill(module?.tpl || '{quota_label}剩余 {quota_left} · {quota_reset}', state.map);
  return result + (state.expired && !module?.quietStale ? '（上次数据，待同步）' : '');
}

// Editors and rendering consume the same inventory: adding a token needs one entry.
export const TOKENS = Object.freeze([
  { key: 'quota_left', label: '剩余百分比（1 位小数）', format: ({ valid, left }) => valid ? left.toFixed(1) + '%' : '未观测' },
  { key: 'quota_left_round', label: '剩余百分比（整数）', format: ({ valid, left }) => valid ? Math.round(left) + '%' : '未观测' },
  { key: 'quota_used', label: '已用百分比', format: ({ valid, item }) => valid ? item.usedPercent.toFixed(1) + '%' : '未观测' },
  { key: 'quota_used_round', label: '已用百分比（整数）', format: ({ valid, item }) => valid ? Math.round(item.usedPercent) + '%' : '未观测' },
  { key: 'quota_reset', label: '精确重置倒计时', format: ({ item }, now) => item ? countdown(item.resetsAt, now) : '未观测' },
  { key: 'quota_reset_short', label: '简洁重置倒计时', format: ({ item }, now) => item ? countdownShort(item.resetsAt, now) : '等待同步' },
  { key: 'quota_reset_at', label: '重置时间', format: ({ item }) => item ? resetAt(item.resetsAt) : '等待同步' },
  { key: 'quota_updated_at', label: '快照更新时间', format: ({ observedAt }) => snapshotAt(observedAt) },
  { key: 'quota_bar', label: '剩余额度条', format: ({ left }) => quotaBar(left) },
  { key: 'quota_label', label: '额度窗口名称', format: ({ minutes }) => QUOTA_LABELS[minutes] },
  { key: 'quota_source', label: '额度数据来源', format: ({ subscription }) => subscription?.source === 'codex-app-server' ? 'Codex 实时查询' : subscription?.source === 'local-session' ? '本机会话记录' : '正在读取额度' },
].map(Object.freeze));
