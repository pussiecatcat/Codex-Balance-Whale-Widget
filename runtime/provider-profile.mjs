import { domainError } from '../lib/errors.mjs';
import { readBoundedBodyText } from './bounded-body.mjs';

// One profile shape for both "the API Codex is using" and every DIY model.
// Endpoint resolution differs, but credential style, prices and alerts are the
// same concepts; keeping them here stops the two settings paths from drifting.
export const PRICE_FIELDS = Object.freeze(['input', 'cachedInput', 'cacheWrite', 'output']);

const numeric = value => value !== null && value !== undefined && value !== '' && typeof value !== 'boolean' && Number.isFinite(Number(value)) ? Number(value) : null;

export function normalizePrices(prices = {}) {
  const out = {};
  const alias = { input: ['input'], cachedInput: ['cachedInput', 'cached'], cacheWrite: ['cacheWrite', 'cache_write'], output: ['output'] };
  for (const [field, keys] of Object.entries(alias)) {
    for (const key of keys) {
      const value = numeric(prices?.[key]);
      if (value !== null && value >= 0) { out[field] = value; break; }
    }
  }
  return out;
}

export function normalizeModelPrices(models = {}) {
  return Object.fromEntries(Object.entries(models || {}).map(([model, prices]) => [model, normalizePrices(prices)]));
}

export function profileFromCodex(context) {
  return {
    id: 'codex',
    kind: 'codex',
    name: 'Codex 当前 API',
    auto: true,
    // The profile list is a read model, not a settings editor. Endpoint and
    // environment names stay out of it until an editor asks for them through
    // an authenticated detail path.
    endpointConfigured: !!context?.baseUrl,
    credential: context?.keySource && context.keySource !== 'none'
      ? { source: context.keySource, configured: true }
      : null,
    adapter: context?.setting?.provider || 'auto',
    currency: context?.setting?.currency || 'USD',
    prices: normalizeModelPrices(context?.setting?.models || {}),
    alerts: {},
  };
}

export function profileFromModel(model) {
  return {
    id: model.id,
    kind: model.kind || 'balance',
    name: model.name || model.id,
    auto: false,
    endpointConfigured: !!(model.balanceUrl || model.baseUrl),
    credential: model.keyEnv ? { source: 'environment', configured: true } : null,
    adapter: model.template || '',
    currency: model.currency || 'USD',
    prices: { [model.name || model.id]: normalizePrices(model.prices || {}) },
    alerts: { ...(model.alerts || {}) },
  };
}

export function listProfiles(context, models = []) {
  return [profileFromCodex(context), ...(Array.isArray(models) ? models.map(profileFromModel) : [])];
}

// The one HTTP path used by both provider implementations. Callers keep their
// own error type and message policy through `fail`; auth style, redirect rules,
// body bounds, JSON parsing and timeout handling live here only.
export async function requestJson({
  url, key = '', auth = 'bearer', fetchImpl = fetch, timeoutMs = 12000, maxBytes = 1024 * 1024,
  userAgent = '', requireJsonContentType = false, isBusinessError = data => data?.success === false || data?.is_available === false || data?.code === false || data?.error,
  fail = (code, message, status) => domainError(message, status, code),
} = {}) {
  let target = url;
  const headers = { accept: 'application/json' };
  if (auth === 'query' && key) {
    const parsed = new URL(url);
    parsed.searchParams.set('key', key);
    target = parsed.toString();
  } else if (key) headers.authorization = auth === 'raw' ? key : 'Bearer ' + key;
  if (userAgent) headers['user-agent'] = userAgent;
  const controller = new AbortController(), timer = setTimeout(() => controller.abort(), timeoutMs);
  timer.unref?.();
  try {
    let response;
    try {
      response = await fetchImpl(target, { headers, signal: controller.signal, redirect: 'error' });
    } catch (error) {
      if (error?.name === 'AbortError') throw fail('TIMEOUT', '服务商请求超时', 504);
      throw fail('NETWORK', '无法连接服务商接口', 502);
    }
    if (!response.ok) {
      try { await response.body?.cancel(); } catch {}
      if (response.status === 401 || response.status === 403) throw fail('AUTH', '当前密钥无权访问该接口（HTTP ' + response.status + '）', 401);
      throw fail('HTTP_' + response.status, '服务商返回 HTTP ' + response.status, 502);
    }
    if (requireJsonContentType && !(response.headers.get('content-type') || '').includes('json')) {
      try { await response.body?.cancel(); } catch {}
      throw fail('NOT_JSON', '服务商返回了网页或验证页，当前路径不是可用的接口', 502);
    }
    const text = await readBoundedBodyText(response, {
      maxBytes,
      tooLarge: () => fail('SHAPE', '响应过大', 502),
      unsupported: () => fail('SHAPE', '返回了不支持的响应流', 502),
      streamless: async r => {
        const body = await r.text();
        if (Buffer.byteLength(body) > maxBytes) throw fail('SHAPE', '响应过大', 502);
        return body;
      },
      translate: error => error?.code ? error : fail('NETWORK', '响应中断，请稍后刷新', 502),
    });
    let data;
    try { data = JSON.parse(text); } catch { throw fail('NOT_JSON', '服务商响应不是有效 JSON', 502); }
    if (isBusinessError(data)) throw fail('API_ERROR', '服务商返回业务错误', 502);
    return data;
  } finally { clearTimeout(timer); }
}
