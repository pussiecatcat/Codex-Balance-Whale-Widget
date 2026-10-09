export class RequestError extends Error {
  constructor(message, { kind = 'network', status = 0, payload = null, cause } = {}) {
    super(message, cause ? { cause } : undefined);
    this.name = 'RequestError';
    this.kind = kind;
    this.status = status;
    this.payload = payload;
  }
}

function messageOf(payload, fallback) {
  return payload && typeof payload.error === 'string' && payload.error.trim()
    ? payload.error.trim()
    : fallback;
}

export async function requestJson(url, options = {}) {
  const {
    method = 'GET', body, signal, timeoutMs = 10000,
    fetchImpl = globalThis.fetch,
  } = options;
  if (typeof fetchImpl !== 'function') throw new RequestError('请求接口不可用', { kind: 'network' });

  const controller = new AbortController();
  let timedOut = false;
  const abort = () => controller.abort(signal?.reason);
  if (signal?.aborted) abort();
  else signal?.addEventListener('abort', abort, { once: true });
  const timer = Number.isFinite(timeoutMs) && timeoutMs > 0
    ? setTimeout(() => { timedOut = true; controller.abort(); }, timeoutMs)
    : 0;

  try {
    let response;
    try {
      response = await fetchImpl(url, {
        method,
        cache: 'no-store',
        headers: body === undefined ? {} : { 'Content-Type': 'application/json' },
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: controller.signal,
      });
    } catch (error) {
      if (controller.signal.aborted) {
        throw new RequestError(timedOut ? '请求超时' : '请求已取消', {
          kind: timedOut ? 'timeout' : 'aborted', cause: error,
        });
      }
      throw new RequestError(error?.message || '网络请求失败', { kind: 'network', cause: error });
    }

    let payload;
    try {
      const text = await response.text();
      payload = text ? JSON.parse(text) : {};
    } catch (error) {
      throw new RequestError('服务返回了无效数据', {
        kind: 'parse', status: Number(response.status) || 0, cause: error,
      });
    }
    if (!response.ok) {
      throw new RequestError(messageOf(payload, '请求失败'), {
        kind: 'http', status: Number(response.status) || 0, payload,
      });
    }
    if (payload && payload.ok === false) {
      throw new RequestError(messageOf(payload, '操作未完成'), {
        kind: 'business', status: Number(response.status) || 0, payload,
      });
    }
    return payload;
  } finally {
    if (timer) clearTimeout(timer);
    signal?.removeEventListener('abort', abort);
  }
}
