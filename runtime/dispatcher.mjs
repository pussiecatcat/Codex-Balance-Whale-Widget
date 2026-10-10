import fs from 'node:fs';
import path from 'node:path';
import { Readable, Writable } from 'node:stream';
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
  const stateFile = path.join(dataDir, 'ui-state.json');
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
      if (url.pathname === '/api/ui-state') {
        if (method === 'GET') return jsonResult(200, { ok: true, values: readJson(stateFile, {}) });
        if (method === 'PUT') {
          const input = parsed(), values = {};
          if (!input || Array.isArray(input) || typeof input !== 'object') return jsonResult(400, { ok: false });
          for (const [key, value] of Object.entries(input)) if (/^dshw[-v]/.test(key) && typeof value === 'string' && value.length < 1024 * 1024) values[key] = value;
          writeJson(stateFile, values); return jsonResult(200, { ok: true });
        }
        return jsonResult(405, { ok: false });
      }
      if (url.pathname === '/api/show' && method === 'POST') { onShow(); return jsonResult(200, { ok: true, desktop: 'shown' }); }
      if (url.pathname === '/api/stop' && method === 'POST') { setTimeout(onStop, 100); return jsonResult(200, { ok: true }); }
      const uiFiles = { '/': 'widget.html', '/widget.html': 'widget.html', '/client.js': 'client.js', '/api-models.js': 'api-models.js', '/ui.css': 'ui.css', '/render.js': 'render.js', '/input.js': 'input.js', '/alpha-worker.js': 'alpha-worker.js', '/money.js': 'money.js', '/quota.js': 'quota.js', '/sound-settings.js': 'sound-settings.js', '/select-enhancer.js': 'select-enhancer.js', '/wait-notice.js': 'wait-notice.js', '/media-guard.js': 'media-guard.js', '/turn-notice.js': 'turn-notice.js', '/gesture.js':'gesture.js', '/audio-engine.js':'audio-engine.js', '/preferences-v3.js':'preferences-v3.js', '/insights.js':'insights.js', '/workshop.js':'workshop.js',
        '/services/request.js': 'services/request.js', '/services/sound-reference.js': 'services/sound-reference.js',
        '/features/sound-settings/model.js': 'features/sound-settings/model.js', '/features/sound-settings/controller.js': 'features/sound-settings/controller.js', '/features/sound-settings/view.js': 'features/sound-settings/view.js',
        '/features/widget/default-content.js': 'features/widget/default-content.js', '/features/widget/bubble-layout.js': 'features/widget/bubble-layout.js',
        '/features/widget/custom-select.js': 'features/widget/custom-select.js', '/features/widget/usage-charts.js': 'features/widget/usage-charts.js',
        '/features/widget/bubble-editor-commands.js': 'features/widget/bubble-editor-commands.js',
        '/features/widget/bubble-scene.js': 'features/widget/bubble-scene.js',
        '/features/widget/bubble-notice-queue.js': 'features/widget/bubble-notice-queue.js',
        '/features/widget/bubble-interaction.js': 'features/widget/bubble-interaction.js',
        '/features/widget/input-policy.js': 'features/widget/input-policy.js',
        '/features/widget/task-end-sound.js': 'features/widget/task-end-sound.js',
        '/features/widget/name-marquee.js': 'features/widget/name-marquee.js',
        '/features/widget/role-manager.js': 'features/widget/role-manager.js',
        '/features/widget/character-interaction.js': 'features/widget/character-interaction.js',
        '/features/widget/asset-client.js': 'features/widget/asset-client.js',
        '/features/widget/anchors.js': 'features/widget/anchors.js',
        '/features/widget/resource-manager.js': 'features/widget/resource-manager.js',
        '/features/widget/menu-hover.js': 'features/widget/menu-hover.js',
        '/features/widget/bubble-editor-view.js': 'features/widget/bubble-editor-view.js',
        '/features/widget/bubble-editor-model.js': 'features/widget/bubble-editor-model.js',
        '/features/widget/usage-records-view.js': 'features/widget/usage-records-view.js',
        '/features/widget/usage-alerts.js': 'features/widget/usage-alerts.js',
        '/features/widget/snap-editor.js': 'features/widget/snap-editor.js',
        '/features/widget/bubble-color-select.js': 'features/widget/bubble-color-select.js',
        '/features/widget/bubble-palette.js': 'features/widget/bubble-palette.js',
        '/features/widget/bubble-quick-editors.js': 'features/widget/bubble-quick-editors.js',
        '/features/widget/usage-models-view.js': 'features/widget/usage-models-view.js',
        '/features/widget/usage-overview-view.js': 'features/widget/usage-overview-view.js',
        '/features/widget/fx-controls.js': 'features/widget/fx-controls.js',
        '/features/widget/usage-navigation.js': 'features/widget/usage-navigation.js',
        '/features/widget/bubble-content.js': 'features/widget/bubble-content.js',
        '/features/widget/bubble-template-help.js': 'features/widget/bubble-template-help.js',
        '/features/widget/bubble-rows-view.js': 'features/widget/bubble-rows-view.js',
        '/features/widget/turn-notice-poller.js': 'features/widget/turn-notice-poller.js' };
      uiFiles['/account-view.js']='account-view.js';
      uiFiles['/shape.js']='shape.js';
      uiFiles['/whale-widget.css']='whale-widget.css';
      let file;
      if (Object.hasOwn(uiFiles, url.pathname)) file = path.join(ROOT, 'desktop', 'ui', uiFiles[url.pathname]);
      else if (url.pathname.startsWith('/assets/')) {
        const name = decodeURIComponent(url.pathname.slice(8));
        if (!/^[A-Za-z0-9_.-]+$/.test(name) || !MIME[path.extname(name)]) return jsonResult(404, { ok: false });
        file = path.join(ROOT, 'assets', name);
      }
      if (file) return ['GET', 'HEAD'].includes(method) ? { status: 200, headers: { 'content-type': MIME[path.extname(file)] }, body: method === 'HEAD' ? Buffer.alloc(0) : fs.readFileSync(file) } : jsonResult(405, { ok: false });
      const handler = routes.get(url.pathname);
      if (!handler) return jsonResult(404, { ok: false, error: '未找到此功能' });
      if (/(?:role-pin|role-delete|bubble-img-upload)\.json$/.test(url.pathname) && !['POST', 'PUT'].includes(method)) return jsonResult(405, { ok: false });
      if (url.pathname === '/dsh-whale/bubble.json' && ['POST', 'PUT'].includes(method)) body = Buffer.from(JSON.stringify(stripRetiredModules(parsed())));
      const requestBytes = Buffer.isBuffer(body) ? body : bytes;
      const req = Readable.from(requestBytes.length ? [requestBytes] : []);
      Object.assign(req, { url: route, method, headers: { 'content-type': 'application/json', ...headers } });
      return await new Promise((resolve, reject) => {
        const chunks = [], responseHeaders = {};
        const res = new Writable({ write(chunk, _enc, done) { chunks.push(Buffer.from(chunk)); done(); } });
        res.statusCode = 200; res.headersSent = false;
        res.setHeader = (name, value) => { responseHeaders[name.toLowerCase()] = String(value); };
        res.writeHead = (status, h = {}) => { res.statusCode = status; res.headersSent = true; for (const [k, v] of Object.entries(h)) res.setHeader(k, v); return res; };
        res.on('finish', () => resolve({ status: res.statusCode, headers: responseHeaders, body: Buffer.concat(chunks) }));
        req.on('error', reject); res.on('error', reject);
        Promise.resolve(handler(req, res)).catch(reject);
      });
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
