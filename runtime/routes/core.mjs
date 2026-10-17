import { VERSION, writeJson } from '../paths.mjs';
import { jsonResult } from '../http-shim.mjs';
import { MEDIA_POLICY } from '../../lib/media-validation.mjs';
import { pricingSchedule } from '../pricing-schedule.mjs';
import { exportWorkshop, importWorkshop } from '../../lib/workshop.mjs';

// Every endpoint the dispatcher answers itself, as a table rather than a chain
// of `if (url.pathname === ...)`. The widget host registers its own routes into
// the same lookup, so there is one precedence rule and one place to read.
//
// A handler receives one argument, `{ body, url }`. It used to be positional
// `(body, url)`, which quietly handed the body to any handler written as
// `url => ...` — that shipped once, and /api/quota answered 500 because
// `url.searchParams` was really a Buffer. One named argument cannot be
// half-right.
//
// `fallthrough: true` records a quirk of the code this replaced: those guards
// only matched the listed methods, so any other method continued into static
// resolution and ended as a 404 rather than a 405. Behaviour is preserved here
// rather than silently tightened, because the tab-leaking difference between the
// two is observable to callers.
export function createCoreRoutes(ctx) {
  const { whale, insights, fx, apiModels, soundSettings, watcher, displayMode, displayModeFile, buildVersion, statusInfo, onStop, onShow, dataDir, faultLog } = ctx;
  const json = body => JSON.parse(body.toString('utf8') || '{}');
  const routes = new Map();
  const route = (pathname, handlers, { fallthrough = false, methodNotAllowed = null } = {}) =>
    routes.set(pathname, { handlers, fallthrough, methodNotAllowed });

  route('/api/display-mode', {
    GET: () => jsonResult(200, { ok: true, mode: displayMode() }),
    POST: ({ body }) => {
      const input = json(body);
      if (!['api', 'subscription'].includes(input.mode)) return jsonResult(400, { ok: false, error: '请选择 API 或会员订阅额度模式' });
      writeJson(displayModeFile, { version: 1, mode: input.mode });
      return jsonResult(200, { ok: true, mode: input.mode });
    },
  });

  route('/api/insights', {
    GET: ({ url }) => insights.get({ force: url.searchParams.get('refresh') === '1' }).then(payload => jsonResult(200, payload)),
  }, { fallthrough: true });

  route('/api/quota', {
    GET: ({ url }) => insights.getQuota({ force: url.searchParams.get('refresh') === '1' }).then(payload => jsonResult(200, payload)),
  }, { fallthrough: true });

  route('/dsh-whale/wait.json', {
    GET: () => jsonResult(200, whale.waitStatus()),
  }, { fallthrough: true });

  route('/api/pricing', {
    GET: () => jsonResult(200, { ok: true, ...pricingSchedule(whale.config.resolve()) }),
  }, { fallthrough: true });

  route('/api/reconcile', {
    GET: () => jsonResult(200, whale.usageRecords()),
    POST: ({ body }) => {
      try { return jsonResult(200, whale.reconcileUsage(json(body))); }
      catch (error) { return jsonResult(error?.status === 409 ? 409 : 400, { ok: false, error: error?.message || '余额校正失败' }); }
    },
  });

  route('/api/models', {
    GET: () => jsonResult(200, apiModels.list()),
    PUT: ({ body }) => jsonResult(200, apiModels.save(json(body))),
    POST: ({ body }) => jsonResult(200, apiModels.save(json(body))),
    DELETE: ({ url, body }) => jsonResult(200, apiModels.delete(url.searchParams.get('id') || json(body).id)),
  });

  route('/api/models/value', {
    GET: async ({ url }) => {
      const id = url.searchParams.get('id');
      const model = apiModels.model(id);
      const template = model && apiModels.list().templates.find(item => item.id === model.template);
      const matches = (model?.matchIds?.length ? model.matchIds : template?.matchIds || []).map(value => String(value).toLowerCase());
      const usage = whale.apiModelUsage(matches);
      const quotaUsage = model?.manualQuota ? whale.apiModelUsage(matches, Date.now(), apiModels.quotaStart(model)) : null;
      const result = await apiModels.read(id, { usage: quotaUsage });
      return jsonResult(200, { ...usage, ...result, usageSource: usage.source, todayEstimate: apiModels.estimate(model, usage) });
    },
  }, { fallthrough: true });

  route('/api/models/probe', {
    POST: async ({ body }) => jsonResult(200, await apiModels.read(json(body).id, { probe: true })),
  }, { fallthrough: true });

  route('/api/workshop/export', {
    GET: () => jsonResult(200, exportWorkshop(dataDir)),
  }, { fallthrough: true });

  route('/api/workshop/import', {
    POST: ({ body }) => jsonResult(200, importWorkshop(dataDir, json(body))),
  }, { fallthrough: true });

  route('/api/status', {
    GET: () => jsonResult(200, {
      ok: true, version: VERSION, buildVersion, transport: 'local-ipc', webpage: false,
      provider: whale.config.publicInfo(),
      monitor: watcher?.status() || { watching: 0, activeTurns: 0 },
      dataDir, faults: faultLog.list(),
      ...statusInfo(),
    }),
  }, { fallthrough: true });

  route('/api/config', {
    GET: () => jsonResult(200, { ok: true, ...whale.config.settingsInfo() }),
    PUT: ({ body }) => { whale.config.save(json(body)); return jsonResult(200, { ok: true, ...whale.config.settingsInfo() }); },
  });

  route('/api/fx/usd-cny', {
    GET: async ({ url }) => {
      const manual = url.searchParams.get('refresh') === '1';
      try { return jsonResult(200, { ok: true, ...await fx.get(manual ? { force: true, reason: 'manual' } : {}) }); }
      catch (error) {
        const metadata = {};
        for (const key of ['cooldownRemainingMs', 'retryAfterMs']) if (Number.isFinite(error?.[key]) && error[key] >= 0) metadata[key] = error[key];
        for (const key of ['checkedAt', 'retrievedAt', 'nextDailyCheckAt']) if (error?.[key] === null || typeof error[key] === 'string' && Number.isFinite(Date.parse(error[key]))) metadata[key] = error[key];
        if (typeof error?.stale === 'boolean') metadata.stale = error.stale;
        return jsonResult(503, { ok: false, error: error?.message || '汇率暂时无法读取，请稍后重试', ...metadata });
      }
    },
  });

  route('/api/media-policy', {
    GET: () => jsonResult(200, { ok: true, policy: MEDIA_POLICY }),
  });

  route('/api/sound-settings', {
    GET: async () => {
      try { return jsonResult(200, await soundSettings.load()); }
      catch (error) { return settingsFailure(error); }
    },
    PUT: async ({ body }) => {
      try { return jsonResult(200, await soundSettings.save(json(body))); }
      catch (error) { return settingsFailure(error); }
    },
  }, { methodNotAllowed: { ok: false, code: 'METHOD_NOT_ALLOWED' } });

  route('/api/show', {
    POST: () => { onShow(); return jsonResult(200, { ok: true, desktop: 'shown' }); },
  }, { fallthrough: true });

  route('/api/stop', {
    POST: () => { setTimeout(onStop, 100); return jsonResult(200, { ok: true }); },
  }, { fallthrough: true });

  return routes;
}

function settingsFailure(error) {
  const status = Number.isInteger(error?.status) && error.status >= 400 && error.status <= 599 ? error.status : 500;
  return jsonResult(status, {
    ok: false,
    code: typeof error?.code === 'string' ? error.code : 'SETTINGS_OPERATION_FAILED',
    error: error?.message || '音效设置操作失败',
  });
}
