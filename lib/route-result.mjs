// Host handlers return transport-independent values; only the dispatcher knows
// whether these bytes go to an Electron protocol response or an IPC caller.
/**
 * @typedef {{status: number, headers: Object<string, string>, body: Buffer}} RouteResult
 * @param {number} status HTTP-compatible status consumed by either local transport.
 * @param {Object<string, string>} headers Header names are normalized to lowercase.
 * @param {string|Buffer|null} body
 * @returns {RouteResult}
 */
export function routeResult(status, headers = {}, body = null) {
  return { status, headers: Object.fromEntries(Object.entries(headers).map(([key, value]) => [key.toLowerCase(), String(value)])),
    body: body == null ? Buffer.alloc(0) : Buffer.isBuffer(body) ? body : Buffer.from(String(body)) };
}
