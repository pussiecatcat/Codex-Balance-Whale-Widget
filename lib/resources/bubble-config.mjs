import path from 'node:path';
import { createHash } from 'node:crypto';
import nodeFs from 'node:fs';
import { resolveBubbleConfig, bubbleSavedMetadata, defaultsKeys } from '../../desktop/ui/shared/bubble-config/resolve.js';
import { BUBBLE_SCHEMA, migrateBubbleConfig } from '../../desktop/ui/shared/bubble-config/migrate.js';
import { json } from '../route-response.mjs';
import { BODY_LIMITS } from './shared.mjs';

export function declareRoutes(ctx, deps) {
  const { fs, dataRoot, readLibrary, libraryWarning, readBodyMax, writeResourceJson } = deps;
  const FILE = path.join(dataRoot, '.dshw-bubble.json');
  function backupBubbleSchema(source) {
    const backup = path.join(path.dirname(source), '.dshw-bubble.schema1-backup.json');
    try {
      if (typeof fs.copyFileSync === 'function') fs.copyFileSync(source, backup, nodeFs.constants.COPYFILE_EXCL);
    } catch (error) { if (error?.code !== 'EEXIST' && error?.code !== 'ENOENT') { /* best effort */ } }
  }
  function loadBubbleConfig(strict = false) {
    const saved = readLibrary(FILE, null, value => value && value.v === 1 && Array.isArray(value.items) && Array.isArray(value.lib), strict, 512 * 1024);
    const migrated = migrateBubbleConfig(saved);
    if (migrated.changed && !strict) {
      backupBubbleSchema(FILE);
      writeResourceJson(FILE, migrated.config, { fs });
    }
    const resolved = resolveBubbleConfig(migrated.config);
    if (resolved.changed && !strict) writeResourceJson(FILE, resolved.config, { fs });
    return resolved.config;
  }
  function writeBubbleConfig(cfg) {
    loadBubbleConfig(true);
    return writeResourceJson(FILE, { ...cfg, schema: BUBBLE_SCHEMA }, { fs });
  }
  const revisionOf = config => createHash('sha256').update(JSON.stringify(config)).digest('hex');
  const disposers = [];
  disposers.push(ctx.declareRoute({
    path: '/dsh-whale/bubble.json',
    methods: ['GET', 'HEAD', 'POST', 'PUT'],
    bodyLimit: BODY_LIMITS.bubbleConfig,
    stripRetired: true,
    handler: async (req) => {
      try {
        if (req.method === 'POST' || req.method === 'PUT') {
          const parsed = JSON.parse(await readBodyMax(req, BODY_LIMITS.bubbleConfig));
          if (!parsed || typeof parsed !== 'object' || !Array.isArray(parsed.items) || !Array.isArray(parsed.lib)) {
            return json({ ok: false, error: 'invalid bubble config' }, 400);
          }
          const previous = loadBubbleConfig();
          if (typeof parsed.expectedRevision === 'string' && parsed.expectedRevision !== revisionOf(previous)) {
            return json({ ok: false, code: 'SETTINGS_CONFLICT', error: '气泡内容已在其他位置修改，请重新载入后再保存' }, 409);
          }
          const cfg = { v: 1, items: parsed.editingMode === 'subscription' ? previous?.items || [] : parsed.items, lib: parsed.lib };
          const subscriptionItems = parsed.editingMode === 'api' ? previous?.subscriptionItems
            : Array.isArray(parsed.subscriptionItems) ? parsed.subscriptionItems : previous?.subscriptionItems;
          if (Array.isArray(subscriptionItems)) cfg.subscriptionItems = subscriptionItems;
          const modes = parsed.editingMode === 'api' ? [false] : parsed.editingMode === 'subscription' ? [true] : [false, true];
          const migrated = resolveBubbleConfig({ ...previous, ...cfg }).config;
          for (const key of ['defaultsVersion', 'defaultsEdited', 'subscriptionDefaultsVersion', 'subscriptionDefaultsEdited']) cfg[key] = migrated[key];
          for (const subscription of modes) {
            const items = subscription ? cfg.subscriptionItems : cfg.items;
            if (Array.isArray(items)) Object.assign(cfg, bubbleSavedMetadata(items, previous, subscription, parsed[defaultsKeys(subscription).edited]));
          }
          cfg.schema = BUBBLE_SCHEMA;
          writeBubbleConfig(cfg);
          const saved = loadBubbleConfig();
          return json({ ok: true, config: saved, revision: revisionOf(saved) });
        }
        const cfg = loadBubbleConfig();
        return json({ ok: true, config: cfg, revision: revisionOf(cfg), ...libraryWarning(FILE) });
      } catch (err) {
        return json({ ok: false, error: String((err && err.message) || err).slice(0, 200) }, 400);
      }
    },
  }));
  return disposers;
}
