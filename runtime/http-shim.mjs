// The dispatcher speaks a small slice of HTTP without owning a server: the
// renderer reaches it over the privileged `whale://` scheme and the CLI over the
// named pipe, and both get the same { status, headers, body } result.
export const UI_ORIGIN = 'whale://widget';

// Extensions servable from desktop/ui/. `.json` is deliberately absent: nothing
// there should be readable as data, and tests pin that /package.json is a 404.
export const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.png': 'image/png',
  '.gif': 'image/gif',
  '.mp3': 'audio/mpeg',
};

// assets/ is media only. It also holds the widget's front-end source
// (assets/whale-widget.js), which is served through its own /dsh-whale/widget.js
// route; while `.js` was allowed here the same file answered to two names.
export const ASSET_MIME = Object.freeze({
  '.png': 'image/png',
  '.gif': 'image/gif',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
});

export const CSP = "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; media-src 'self' data: blob:; font-src 'self' data:; connect-src 'self'; worker-src 'self' blob:; object-src 'none'; base-uri 'none'; frame-ancestors 'none'";

export function jsonResult(status, payload) {
  return { status, headers: { 'content-type': 'application/json; charset=utf-8' }, body: Buffer.from(JSON.stringify(payload)) };
}

// Attached to every dispatch result. `no-store` because these responses carry
// balances and ledger rows, and the policy because the renderer loads this
// content into a privileged scheme.
export function withSecurityHeaders(result) {
  result.headers = {
    'cache-control': 'no-store',
    'x-content-type-options': 'nosniff',
    'content-security-policy': CSP,
    ...result.headers,
  };
  return result;
}
