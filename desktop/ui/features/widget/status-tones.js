// One vocabulary for the states the data layer already distinguishes. Each
// state carries a label, a tone (never colour alone), an icon and the next
// action a user can take. Quota, balance, DIY models and connection tests all
// read from this table instead of inventing another set of words.
export const STATUS_TONES = Object.freeze({
  ready: { label: '已同步', tone: 'ok', icon: '✓', action: '' },
  syncing: { label: '正在同步…', tone: 'muted', icon: '…', action: '' },
  stale: { label: '数据已过期', tone: 'warn', icon: '!', action: '点击刷新或等待自动重试' },
  unauthenticated: { label: '请登录 Codex', tone: 'critical', icon: '!', action: '在 Codex 中登录订阅账号' },
  unavailable: { label: '暂无可用数据', tone: 'muted', icon: '?', action: '完成一次 Codex 请求后刷新' },
  error: { label: '查询暂不可用', tone: 'critical', icon: '!', action: '稍后重试，或检查 Codex 是否已安装' },
  ok: { label: '已连接', tone: 'ok', icon: '✓', action: '' },
  'not-configured': { label: '未配置', tone: 'muted', icon: '?', action: '添加服务商或填写 API 地址与密钥变量' },
  'key-missing': { label: '未检测到密钥', tone: 'warn', icon: '!', action: '设置环境变量后点“重新启动小龙娘”' },
  unreachable: { label: '无法连接', tone: 'critical', icon: '!', action: '检查网络或代理，然后重试' },
  'auth-failed': { label: '密钥无权限', tone: 'critical', icon: '!', action: '检查密钥和账号权限' },
  'provider-error': { label: '服务商返回错误', tone: 'critical', icon: '!', action: '查看错误信息，稍后重试' },
  'bad-response': { label: '接口不匹配', tone: 'critical', icon: '!', action: '检查余额路径和字段，或换用兼容接口' },
  'no-balance-api': { label: '不提供余额', tone: 'muted', icon: '—', action: '改用 token 统计或手动额度' },
});

const ERROR_KEYS = Object.freeze({
  AUTH: 'auth-failed',
  AUTH_REQUIRED: 'auth-failed',
  TIMEOUT: 'unreachable',
  NETWORK: 'unreachable',
  ECONNREFUSED: 'unreachable',
  NOT_JSON: 'bad-response',
  SHAPE: 'bad-response',
  CONFIG: 'not-configured',
  NO_KEY: 'key-missing',
  UNSUPPORTED: 'no-balance-api',
});

export function statusForCode(code) {
  const value = String(code || '');
  if (ERROR_KEYS[value]) return ERROR_KEYS[value];
  if (/^HTTP_(?:401|403)$/.test(value)) return 'auth-failed';
  if (/^HTTP_/.test(value) || value === 'API_ERROR') return 'provider-error';
  return 'provider-error';
}

export function statusForError(error) {
  return statusForCode(error?.payload?.code || error?.code);
}

export function statusView(status, { failed = false, changed = false, reason = '' } = {}) {
  const key = failed ? 'error' : Object.hasOwn(STATUS_TONES, status) ? status
    : ERROR_KEYS[status] || 'unavailable';
  const base = STATUS_TONES[key];
  const label = key === 'unavailable' && reason ? reason : key === 'ready' && changed ? '额度已更新' : base.label;
  return { key, label, tone: base.tone, icon: base.icon, action: base.action };
}
