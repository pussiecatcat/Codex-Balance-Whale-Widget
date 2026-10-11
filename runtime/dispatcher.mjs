import fs from 'node:fs';
import path from 'node:path';
import { ROOT, VERSION, readJson } from './paths.mjs';
import { createComposition } from './composition.mjs';
import { UI_ORIGIN, MIME, ASSET_MIME, jsonResult, withSecurityHeaders } from './http-shim.mjs';
import { createCoreRoutes } from './routes/core.mjs';
import { stripRetiredModules } from './migration.mjs';
import { toResponse } from '../lib/route-response.mjs';
import { DomainError } from '../lib/errors.mjs';
import { createFaultLog } from './faults.mjs';

export { UI_ORIGIN };

const UI_DIR = path.join(ROOT, 'desktop', 'ui');
const ASSETS_DIR = path.join(ROOT, 'assets');
const MAX_BODY_BYTES = 32 * 1024 * 1024;
const METHODS = ['GET', 'POST', 'PUT', 'DELETE', 'HEAD'];
const READ_METHODS = ['GET', 'HEAD'];

const decode = value => { try { return decodeURIComponent(value); } catch { return null; } };
const mimeFor = file => MIME[path.extname(file)] || ASSET_MIME[path.extname(file)];

// Resolve a widget file by path instead of from a hand-kept table. Every new
// module used to need an entry here, and a forgotten one failed only at runtime
// as a 404 inside the widget. desktop/ui/ holds only .js, .css and .html, and the
// extension must be one MIME knows, so the reachable set matches what the table
// allowed. The file must exist now: an /assets/* request also resolves under
// desktop/ui/ by extension, and a candidate left in place would shadow it.
function resolveUiFile(pathname) {
  const relative = decode(pathname === '/' ? 'widget.html' : pathname.slice(1));
  if (!relative || relative.includes('\\')) return null;
  if (relative.split('/').some(part => !part || part === '.' || part === '..')) return null;
  const candidate = path.resolve(UI_DIR, relative);
  if (!candidate.startsWith(UI_DIR + path.sep) || !MIME[path.extname(candidate)]) return null;
  try { return fs.statSync(candidate).isFile() ? candidate : null; } catch { return null; }
}

function resolveAssetFile(pathname) {
  const name = decode(pathname.slice('/assets/'.length));
  if (!name || !/^[A-Za-z0-9_.-]+$/.test(name) || !ASSET_MIME[path.extname(name)]) return { rejected: true };
  return { file: path.join(ASSETS_DIR, name) };
}

// Dispatch original resource handlers entirely in process; no HTTP listener and
// no web page exist. Composition lives in composition.mjs and the endpoints in
// routes/core.mjs, so this file is only the request path: validate, route,
// serve, or report.
export function createDispatcher(options = {}) {
  // dataDir and the service overrides ride through to createComposition, which
  // owns their defaults.
  const { onStop = () => {}, onShow = () => {}, statusInfo = () => ({}) } = options;
  const app = createComposition(options);
  const faults = createFaultLog();
  const buildVersion = readJson(path.join(ROOT, '.codex-plugin', 'plugin.json'), {}).version || VERSION;
  const routes = createCoreRoutes({ ...app, buildVersion, statusInfo, onStop, onShow, faultLog: faults });
  let closing = false, closeJob = null;

  async function run(route, { method, body, headers }) {
    let context = '';
    try {
      if (closing) return jsonResult(503, { ok: false, error: '挂件正在退出，请稍后重新打开' });
      if (typeof route !== 'string' || !route.startsWith('/') || route.startsWith('//') || /[\\\x00-\x1f]/.test(route)) return jsonResult(400, { ok: false, error: '无效的本地操作' });
      const url = new URL(route, UI_ORIGIN);
      context = url.pathname;
      if (!METHODS.includes(method)) return jsonResult(405, { ok: false });
      const bytes = body == null ? Buffer.alloc(0) : Buffer.isBuffer(body) ? body : Buffer.from(typeof body === 'string' ? body : JSON.stringify(body));
      if (bytes.length > MAX_BODY_BYTES) return jsonResult(413, { ok: false, error: '导入文件过大' });

      const endpoint = routes.get(url.pathname);
      if (endpoint) {
        const handler = endpoint.handlers[method];
        if (handler) return await handler({ body: bytes, url });
        // Earlier these guards matched the listed methods only, so any other
        // method carried on into static resolution and finished as a 404.
        if (!endpoint.fallthrough) return jsonResult(405, endpoint.methodNotAllowed ?? { ok: false });
      }

      let file = resolveUiFile(url.pathname);
      if (!file && url.pathname.startsWith('/assets/')) {
        const asset = resolveAssetFile(url.pathname);
        if (asset.rejected) return jsonResult(404, { ok: false });
        file = asset.file;
      }
      if (file) {
        // A path that resolves but has no file behind it is a miss, not a throw.
        if (!fs.existsSync(file) || !fs.statSync(file).isFile()) file = null;
        else if (!READ_METHODS.includes(method)) return jsonResult(405, { ok: false });
        else return { status: 200, headers: { 'content-type': mimeFor(file) }, body: method === 'HEAD' ? Buffer.alloc(0) : fs.readFileSync(file) };
      }

      // The host declares each route: the methods it answers, how large a body it
      // accepts, and whether its payload passes the migration filter. Those three
      // rules used to sit between a path regex here and the handlers themselves,
      // so a route could answer a method it never meant to answer.
      const declaration = app.widgetRoutes.get(url.pathname);
      if (!declaration) return jsonResult(404, { ok: false, error: '未找到此功能' });
      if (!declaration.methods.includes(method)) return jsonResult(405, { ok: false });
      if (declaration.bodyLimit && bytes.length > declaration.bodyLimit) return jsonResult(413, { ok: false, error: '导入文件过大' });
      const requestBody = declaration.stripRetired && ['POST', 'PUT'].includes(method)
        ? Buffer.from(JSON.stringify(stripRetiredModules(JSON.parse(bytes.toString('utf8') || '{}'))))
        : bytes;
      // The handler answers with a value, and lib/route-response.mjs is the one
      // place that turns a value into a status, headers and body.
      return toResponse(await declaration.handler({ url: route, method, headers: { 'content-type': 'application/json', ...headers }, body: requestBody }), method);
    } catch (error) {
      // A DomainError is something the caller can act on and carries its own
      // status. Anything else is a defect here: it must not be reported as a bad
      // request with a message telling the user to check settings that are fine.
      if (error instanceof DomainError) return jsonResult(error.status, { ok: false, code: error.code, error: error.message });
      const ref = faults.record(error, context);
      process.stderr.write(`[whale] ${ref} ${context}\n${error?.stack || error}\n`);
      return jsonResult(500, { ok: false, code: 'INTERNAL', error: '挂件内部错误，请查看运行日志', ref });
    }
  }

  async function dispatch(route, options = {}) {
    const { method = 'GET', body = null, headers = {} } = options;
    return withSecurityHeaders(await run(route, { method, body, headers }));
  }

  function close() {
    if (closeJob) return closeJob;
    closing = true;
    closeJob = app.close();
    return closeJob;
  }

  return { dispatch, whale: app.whale, watcher: app.watcher, soundSettings: app.soundSettings, faults, close };
}
