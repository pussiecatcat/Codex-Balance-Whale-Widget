import fs from 'node:fs';
import path from 'node:path';
import { DATA_HOME, readJson } from './paths.mjs';
import { WhaleService } from './service.mjs';
import { SessionMonitor } from './session-monitor.mjs';
import { createWidgetHost } from '../lib/widget-host.mjs';
import { migrateData } from './migration.mjs';
import { createFxService } from './fx.mjs';
import { createInsightsService } from './insights.mjs';
import { ApiModelRegistry } from './api-models.mjs';
import { ProviderStore } from './provider-store.mjs';
import { SoundSettingsService } from './sound-settings.mjs';

// Builds every long-lived service and hands back one container. The dispatcher
// used to construct all of this inline, which made a routing file also the
// place to look for service wiring; keeping the two apart means a new
// collaborator is added here and a new endpoint is added in routes/.
export function createComposition({
  dataDir = DATA_HOME,
  service = null,
  insightsService = null,
  monitor = true,
  autoRefresh = true,
  fetchImpl,
  fxFetchImpl = fetchImpl,
} = {}) {
  fs.mkdirSync(dataDir, { recursive: true });
  migrateData(dataDir);
  // One store instance backs both the Codex API settings and the DIY model
  // registry, so a save from either editor cannot overwrite the other's data.
  const displayModeFile = path.join(dataDir, 'display-mode.json');
  const displayMode = () => readJson(displayModeFile, {}).mode === 'api' ? 'api' : 'subscription';
  const providerStore = new ProviderStore({ dataDir });
  try { providerStore.migrateLegacy(); } catch { /* a broken legacy file fails when it is read */ }
  const whale = service || new WhaleService({ dataDir, store: providerStore, mode: displayMode, ...(fetchImpl ? { fetchImpl } : {}) });
  const fx = createFxService({ dataDir, ...(fxFetchImpl ? { fetchImpl: fxFetchImpl } : {}) });
  const insights = insightsService || createInsightsService(whale.config);
  const apiModels = new ApiModelRegistry({ dataDir, store: whale.config?.store || providerStore, env: whale.config.env, ...(fetchImpl ? { fetchImpl } : {}) });
  try { apiModels.migrate(); } catch {}
  const soundSettings = new SoundSettingsService({ dataDir, whale });

  // The widget host declares each route — the methods it answers, how large a
  // body it accepts, whether its payload passes the migration filter — instead
  // of registering into a web-server facade the dispatcher then had to emulate.
  const widgetRoutes = new Map();
  const effects = [];
  createWidgetHost(dataDir).apply({
    whale,
    declareRoute: declaration => { widgetRoutes.set(declaration.path, declaration); return () => widgetRoutes.delete(declaration.path); },
    effect: effect => effects.push(effect()),
  });

  const watcher = monitor ? new SessionMonitor(whale) : null;
  watcher?.start();

  // Poll for a new balance only while the API surface is the one on screen.
  const timer = autoRefresh ? setInterval(() => { if (displayMode() === 'api') whale.getBalance().catch(() => {}); }, 60000) : null;
  timer?.unref();
  if (autoRefresh) {
    if (displayMode() === 'api') whale.getBalance().catch(() => {});
    fx.start().catch(() => {});
  }

  async function close() {
    clearInterval(timer);
    const failures = [];
    insights.close();
    try { await fx.close(); } catch (error) { failures.push(error); }
    try { await watcher?.stop({ timeoutMs: 1200 }); } catch (error) { failures.push(error); }
    try { await whale.close?.({ timeoutMs: 3000 }); } catch (error) { failures.push(error); }
    // Each effect is either a disposer or an object with close(); both shapes are
    // still in use by the widget host.
    for (const effect of effects.splice(0)) {
      try { if (typeof effect === 'function') await effect(); else await effect?.close?.(); }
      catch (error) { failures.push(error); }
    }
    if (failures.length) throw new AggregateError(failures, '部分挂件组件未能正常关闭');
  }

  return { dataDir, whale, fx, insights, apiModels, soundSettings, watcher, widgetRoutes, effects, displayMode, displayModeFile, close };
}
