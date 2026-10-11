import fs from 'node:fs';
import path from 'node:path';
import { ROOT, DATA_HOME, VERSION, readJson, writeJson } from './paths.mjs';
import { WhaleService } from './service.mjs';
import { SessionMonitor } from './session-monitor.mjs';
import { createWidgetHost } from '../lib/widget-host.mjs';
import { migrateData, stripRetiredModules } from './migration.mjs';
import { createFxService } from './fx.mjs';
import { MEDIA_POLICY } from '../lib/media-validation.mjs';
import { createInsightsService } from './insights.mjs';
import { pricingSchedule } from './pricing-schedule.mjs';
import { importWorkshop, exportWorkshop } from '../lib/workshop.mjs';
import { ApiModelRegistry } from './api-models.mjs';
import { SoundSettingsService } from './sound-settings.mjs';

export const UI_ORIGIN = 'whale://widget';
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'application/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.png': 'image/png', '.gif': 'image/gif', '.mp3': 'audio/mpeg' };
const UI_DIR = path.join(ROOT, 'desktop', 'ui');
const CSP = "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; media-src 'self' data: blob:; font-src 'self' data:; connect-src 'self'; worker-src 'self' blob:; object-src 'none'; base-uri 'none'; frame-ancestors 'none'";
const jsonResult = (status, payload) => ({ status, headers: { 'content-type': 'application/json; charset=utf-8' }, body: Buffer.from(JSON.stringify(payload)) });

// Dispatch original resource handlers entirely in process; no HTTP listener exists.
export function createDispatcher({ dataDir = DATA_HOME, service = null, monitor = true, autoRefresh = true, fetchImpl, fxFetchImpl = fetchImpl, onStop = () => {}, onShow = () => {}, statusInfo = () => ({}) } = {}) {
  fs.mkdirSync(dataDir, { recursive: true });
  migrateData(dataDir);
  const whale = service || new WhaleService({ dataDir, ...(fetchImpl ? { fetchImpl } : {}) });
  const fx = createFxService({ dataDir, ...(fxFetchImpl ? { fetchImpl: fxFetchImpl } : {}) });
  const insights = createInsightsService(whale.config);
  const apiModels = new ApiModelRegistry({ dataDir, env: whale.config.env, ...(fetchImpl ? { fetchImpl } : {}) });
  const soundSettings = new SoundSettingsService({ dataDir, whale });
  const displayModeFile = path.join(dataDir, 'display-mode.json');
  const displayMode = () => readJson(displayModeFile, {}).mode === 'api' ? 'api' : 'subscription';
  const routes = new Map(), effects = [];
  createWidgetHost(dataDir).apply({ whale, webServer: { register: r => { routes.set(r.path, r.handler); return () => routes.delete(r.path); }, tapIndex: () => () => {} }, effect: f => effects.push(f()) });
  const watcher = monitor ? new SessionMonitor(whale) : null;
  watcher?.start();
  const timer = autoRefresh ? setInterval(() => { if (displayMode() === 'api') whale.getBalance().catch(() => {}); }, 60000) : null;
  timer?.unref();
  if (autoRefresh) {
    if (displayMode() === 'api') whale.getBalance().catch(() => {});
    fx.start().catch(() => {});
  }
  const buildVersion = readJson(path.join(ROOT, '.codex-plugin', 'plugin.json'), {}).version || VERSION;
  let closing = false, closeJob = null;

  async function dispatch(route, { method = 'GET', body = null, headers = {} } = {}) {
    const result = await run(route, { method, body, headers });
    result.headers = { 'cache-control': 'no-store', 'x-content-type-options': 'nosniff', 'content-security-policy': CSP, ...result.headers };
    return result;
  }
  async function run(route, { method, body, headers }) {
    try {
      if (closing) return jsonResult(503, { ok: false, error: '挂件正在退出，请稍后重新打开' });
      if (typeof route !== 'string' || !route.startsWith('/') || route.startsWith('//') || /[\\\x00-\x1f]/.test(route)) return jsonResult(400, { ok: false, error: '无效的本地操作' });
      const url = new URL(route, UI_ORIGIN);
      if (!['GET', 'POST', 'PUT', 'DELETE', 'HEAD'].includes(method)) return jsonResult(405, { ok: false });
      const bytes = body == null ? Buffer.alloc(0) : Buffer.isBuffer(body) ? body : Buffer.from(typeof body === 'string' ? body : JSON.stringify(body));
      if (bytes.length > 32 * 1024 * 1024) return jsonResult(413, { ok: false, error: '导入文件过大' });
      const parsed = () => JSON.parse(bytes.toString('utf8') || '{}');
      if (url.pathname === '/api/display-mode') {
        if (method === 'GET') return jsonResult(200, {ok:true,mode:displayMode()});
        if (method !== 'POST') return jsonResult(405, {ok:false});
        const input=parsed();
        if (!['api','subscription'].includes(input.mode)) return jsonResult(400,{ok:false,error:'请选择 API 或会员订阅额度模式'});
        writeJson(displayModeFile,{version:1,mode:input.mode});
        return jsonResult(200,{ok:true,mode:input.mode});
      }
      if (url.pathname === '/api/insights' && method === 'GET') return jsonResult(200, await insights.get({force:url.searchParams.get('refresh')==='1'}));
      if (url.pathname === '/api/quota' && method === 'GET') return jsonResult(200, await insights.getQuota({force:url.searchParams.get('refresh')==='1'}));
      if (url.pathname === '/dsh-whale/wait.json' && method === 'GET') return jsonResult(200, whale.waitStatus());
      if (url.pathname === '/api/pricing' && method === 'GET') return jsonResult(200, {ok:true,...pricingSchedule(whale.config.resolve())});
      if (url.pathname === '/api/reconcile') {
        if (method === 'GET') return jsonResult(200, whale.usageRecords());
        if (method !== 'POST') return jsonResult(405, { ok: false });
        try { return jsonResult(200, whale.reconcileUsage(parsed())); }
        catch (error) { return jsonResult(error?.status === 409 ? 409 : 400, { ok: false, error: error?.message || '余额校正失败' }); }
      }
      if (url.pathname === '/api/models') {
        if (method === 'GET') return jsonResult(200, apiModels.list());
        if (method === 'PUT' || method === 'POST') return jsonResult(200, apiModels.save(parsed()));
        if (method === 'DELETE') return jsonResult(200, apiModels.delete(url.searchParams.get('id') || parsed().id));
        return jsonResult(405, { ok: false });
      }
      if (url.pathname === '/api/models/value' && method === 'GET') {
        const id = url.searchParams.get('id'), model = apiModels.model(id), template = model && apiModels.list().templates.find(item => item.id === model.template);
        const matches = (model?.matchIds?.length ? model.matchIds : template?.matchIds || []).map(value => String(value).toLowerCase());
        const usage = whale.apiModelUsage(matches);
        const quotaUsage = model?.manualQuota ? whale.apiModelUsage(matches, Date.now(), apiModels.quotaStart(model)) : null;
        const result = await apiModels.read(id, { usage: quotaUsage });
        return jsonResult(200, { ...usage, ...result, usageSource: usage.source, todayEstimate: apiModels.estimate(model, usage) });
      }
      if (url.pathname === '/api/models/probe' && method === 'POST') return jsonResult(200, await apiModels.read(parsed().id, { probe: true }));
      if (url.pathname === '/api/workshop/export' && method === 'GET') return jsonResult(200, exportWorkshop(dataDir));
      if (url.pathname === '/api/workshop/import' && method === 'POST') return jsonResult(200, importWorkshop(dataDir, parsed()));
      if (url.pathname === '/api/status' && method === 'GET') return jsonResult(200, { ok: true, version: VERSION, buildVersion, transport: 'local-ipc', webpage: false, provider: whale.config.publicInfo(), monitor: watcher?.status() || { watching: 0, activeTurns: 0 }, dataDir, ...statusInfo() });
      if (url.pathname === '/api/config') {
        if (method === 'GET') return jsonResult(200, { ok: true, ...whale.config.settingsInfo() });
        if (method === 'PUT') { whale.config.save(parsed()); return jsonResult(200, { ok: true, ...whale.config.settingsInfo() }); }
        return jsonResult(405, { ok: false });
      }
      if (url.pathname === '/api/fx/usd-cny') {
        if (method !== 'GET') return jsonResult(405, { ok: false });
        const manual = url.searchParams.get('refresh') === '1';
        try { return jsonResult(200, { ok: true, ...await fx.get(manual ? { force: true, reason: 'manual' } : {}) }); }
        catch (error) {
          const metadata = {};
          for (const key of ['cooldownRemainingMs', 'retryAfterMs']) if (Number.isFinite(error?.[key]) && error[key] >= 0) metadata[key] = error[key];
          for (const key of ['checkedAt', 'retrievedAt', 'nextDailyCheckAt']) if (error?.[key] === null || typeof error?.[key] === 'string' && Number.isFinite(Date.parse(error[key]))) metadata[key] = error[key];
          if (typeof error?.stale === 'boolean') metadata.stale = error.stale;
          return jsonResult(503, { ok: false, error: error?.message || '汇率暂时无法读取，请稍后重试', ...metadata });
        }
      }
      if (url.pathname === '/api/media-policy') {
        if (method !== 'GET') return jsonResult(405, { ok: false });
        return jsonResult(200, { ok: true, policy: MEDIA_POLICY });
      }
      if (url.pathname === '/api/sound-settings') {
        if (method !== 'GET' && method !== 'PUT') return jsonResult(405, { ok: false, code: 'METHOD_NOT_ALLOWED' });
        try {
          return jsonResult(200, method === 'GET' ? await soundSettings.load() : await soundSettings.save(parsed()));
        } catch (error) {
          const status = Number.isInteger(error?.status) && error.status >= 400 && error.status <= 599 ? error.status : 500;
          return jsonResult(status, {
            ok: false,
            code: typeof error?.code === 'string' ? error.code : 'SETTINGS_OPERATION_FAILED',
            error: error?.message || '音效设置操作失败',
          });
        }
      }
      if (url.pathname === '/api/show' && method === 'POST') { onShow(); return jsonResult(200, { ok: true, desktop: 'shown' }); }
      if (url.pathname === '/api/stop' && method === 'POST') { setTimeout(onStop, 100); return jsonResult(200, { ok: true }); }
      // Resolve widget assets from desktop/ui/ by path rather than from an
      // explicit table. Every new module used to need a hand-written entry here,
      // and a forgotten one failed only at runtime, as a 404 inside the widget.
      // desktop/ui/ holds only .js, .css and .html, and the extension must be one
      // MIME knows, so the reachable set matches what the table allowed.
      let file = null;
      try {
        const rel = decodeURIComponent(url.pathname === '/' ? 'widget.html' : url.pathname.slice(1));
        if (rel && !rel.includes('\\') && !rel.split('/').some(part => !part || part === '.' || part === '..')) {
          const candidate = path.resolve(UI_DIR, rel);
          // The file must exist here, not later: an /assets/* request also resolves
          // under desktop/ui/ by extension, and leaving file set would shadow the
          // assets branch below.
          if (candidate.startsWith(UI_DIR + path.sep) && MIME[path.extname(candidate)] &&
              fs.existsSync(candidate) && fs.statSync(candidate).isFile()) file = candidate;
        }
      } catch {}
      if (!file && url.pathname.startsWith('/assets/')) {
        const name = decodeURIComponent(url.pathname.slice(8));
        if (!/^[A-Za-z0-9_.-]+$/.test(name) || !MIME[path.extname(name)]) return jsonResult(404, { ok: false });
        file = path.join(ROOT, 'assets', name);
      }
      if (file) {
        // A path that resolves but has no file behind it is a 404, not a throw.
        if (!fs.existsSync(file) || !fs.statSync(file).isFile()) file = null;
        else return ['GET', 'HEAD'].includes(method) ? { status: 200, headers: { 'content-type': MIME[path.extname(file)] }, body: method === 'HEAD' ? Buffer.alloc(0) : fs.readFileSync(file) } : jsonResult(405, { ok: false });
      }
      const handler = routes.get(url.pathname);
      if (!handler) return jsonResult(404, { ok: false, error: '未找到此功能' });
      if (/(?:role-pin|role-delete|bubble-img-upload)\.json$/.test(url.pathname) && !['POST', 'PUT'].includes(method)) return jsonResult(405, { ok: false });
      if (url.pathname === '/dsh-whale/bubble.json' && ['POST', 'PUT'].includes(method)) body = Buffer.from(JSON.stringify(stripRetiredModules(parsed())));
      const requestBytes = Buffer.isBuffer(body) ? body : bytes;
      const req = { url: route, method, headers: { 'content-type': 'application/json', ...headers }, body: requestBytes };
      // Plain collectors rather than Writable/Readable: the widget host handlers
      // only ever call writeHead and end, and the response is assembled from those.
      const responseHeaders = {};
      let status = 200, payload = Buffer.alloc(0);
      const res = {
        setHeader(name, value) { responseHeaders[String(name).toLowerCase()] = String(value); },
        writeHead(code, headers = {}) { status = code; for (const [name, value] of Object.entries(headers)) res.setHeader(name, value); return res; },
        end(value) { payload = value == null ? Buffer.alloc(0) : Buffer.isBuffer(value) ? value : Buffer.from(String(value)); },
      };
      await handler(req, res);
      return { status, headers: responseHeaders, body: payload };
    } catch { return jsonResult(400, { ok: false, error: '操作失败，请检查设置或导入文件' }); }
  }
  function close() {
    if (closeJob) return closeJob;
    closing = true; clearInterval(timer);
    closeJob = (async () => {
      const failures = [];
      insights.close();
      try { await fx.close(); } catch (error) { failures.push(error); }
      try { await watcher?.stop({ timeoutMs: 1200 }); } catch (error) { failures.push(error); }
      try { await whale.close?.({ timeoutMs: 3000 }); } catch (error) { failures.push(error); }
      for (const effect of effects.splice(0)) {
        try { if (typeof effect === 'function') await effect(); else await effect?.close?.(); }
        catch (error) { failures.push(error); }
      }
      if (failures.length) throw new AggregateError(failures, '部分挂件组件未能正常关闭');
    })();
    return closeJob;
  }
  return { dispatch, whale, watcher, soundSettings, close };
}
