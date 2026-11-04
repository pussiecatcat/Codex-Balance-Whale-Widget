// One vocabulary for the states the data layer already distinguishes. Each
// state carries a tone (never colour alone) and the next action a user can take.
export const STATUS_TONES = Object.freeze({
  ready: { label: '已同步', tone: 'ok', action: '' },
  syncing: { label: '正在同步…', tone: 'muted', action: '' },
  stale: { label: '数据已过期', tone: 'warn', action: '点击刷新或等待自动重试' },
  unauthenticated: { label: '请登录 Codex', tone: 'critical', action: '在 Codex 中登录订阅账号' },
  unavailable: { label: '暂无可用数据', tone: 'muted', action: '完成一次 Codex 请求后刷新' },
  error: { label: '查询暂不可用', tone: 'critical', action: '稍后重试，或检查 Codex 是否已安装' },
});

export function statusView(status, { failed = false, changed = false, reason = '' } = {}) {
  const key = failed ? 'error' : Object.hasOwn(STATUS_TONES, status) ? status : 'unavailable';
  const base = STATUS_TONES[key];
  const label = key === 'unavailable' && reason ? reason : key === 'ready' && changed ? '额度已更新' : base.label;
  return { key, label, tone: base.tone, action: base.action };
}
