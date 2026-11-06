import { CURRENT_DEFAULTS_VERSION, bubbleDefaultQueue, bubbleLegacySubscriptionDefault } from './defaults.js';
import { bubbleRowsCanon } from './layout.js';

const clone = value => JSON.parse(JSON.stringify(value));
const stable = value => Array.isArray(value) ? value.map(stable) : value && typeof value === 'object'
  ? Object.fromEntries(Object.keys(value).sort().map(key => [key, stable(value[key])])) : value;
const equal = (left, right) => JSON.stringify(stable(left)) === JSON.stringify(stable(right));
const COUNTDOWN_TEMPLATES = new Set(['{quota_reset}', '{quota_reset_short}']);

export const BUBBLE_SCHEMA = 2;

// Configs saved before semantic roles carry tightTitle / titleBadge flags, and
// their countdowns carry no role at all. Rendering only reads `role`.
export function normalizeLegacyRoles(items) {
  let changed = false;
  for (const step of Array.isArray(items) ? items : []) {
    for (const module of Array.isArray(step?.modules) ? step.modules : []) {
      if (!module || typeof module !== 'object') continue;
      if (module.tightTitle) { if (!module.role) module.role = 'title'; delete module.tightTitle; changed = true; }
      if (module.titleBadge) { if (!module.role) module.role = 'badge'; delete module.titleBadge; changed = true; }
      if (!module.role && module.type === 'quota' && !module.quotaStyle && !module.apiModelId && COUNTDOWN_TEMPLATES.has(module.tpl)) {
        module.role = 'countdown'; changed = true;
      }
    }
  }
  return changed;
}

export function isCurrentDefault(items, subscription) {
  const candidate = clone(items || []);
  const expected = bubbleDefaultQueue(subscription);
  if (subscription) {
    for (const step of candidate) {
      if (!Array.isArray(step.modules)) continue;
      for (const module of step.modules) {
        if (module.type === 'quota' && module.tpl === '{quota_left_round}') module.role ||= 'hero';
        if (module.type === 'quota' && COUNTDOWN_TEMPLATES.has(module.tpl)) module.role ||= 'countdown';
        if (module.type === 'text' && module.text === '距离重置') module.role ||= 'chip';
      }
    }
  }
  for (const queue of [candidate, expected]) {
    for (const step of queue) if (Array.isArray(step.modules)) bubbleRowsCanon(step.modules);
  }
  return equal(candidate, expected);
}

// One ordered list of migrations. Every read path migrates first and then uses
// the current schema; no renderer or editor keeps its own compatibility branch.
export const BUBBLE_MIGRATIONS = Object.freeze([
  {
    to: 2,
    run(config) {
      const next = clone(config);
      for (const key of ['tapAdvance', 'subscriptionTapAdvance']) delete next[key];
      normalizeLegacyRoles(next.items);
      normalizeLegacyRoles(next.subscriptionItems);
      for (const subscription of [false, true]) {
        const keys = subscription
          ? { items: 'subscriptionItems', version: 'subscriptionDefaultsVersion', edited: 'subscriptionDefaultsEdited' }
          : { items: 'items', version: 'defaultsVersion', edited: 'defaultsEdited' };
        const items = next[keys.items];
        const version = next[keys.version];
        if (!Number.isInteger(version)) {
          const builtin = !Array.isArray(items) || !items.length || isCurrentDefault(items, subscription) ||
            (subscription && bubbleLegacySubscriptionDefault(items));
          next[keys.version] = CURRENT_DEFAULTS_VERSION;
          next[keys.edited] = !builtin;
          if (builtin) next[keys.items] = bubbleDefaultQueue(subscription);
        } else if (next[keys.edited] === false && version < CURRENT_DEFAULTS_VERSION) {
          next[keys.items] = bubbleDefaultQueue(subscription);
          next[keys.version] = CURRENT_DEFAULTS_VERSION;
        }
      }
      next.schema = BUBBLE_SCHEMA;
      return next;
    },
  },
]);

export function migrateBubbleConfig(config) {
  if (!config || typeof config !== 'object') return { config: null, changed: false };
  const from = Number.isInteger(config.schema) ? config.schema : 1;
  let current = clone(config);
  for (const step of BUBBLE_MIGRATIONS) if (step.to > from) current = step.run(current);
  if (!Number.isInteger(current.schema)) current.schema = BUBBLE_SCHEMA;
  return { config: current, changed: !equal(config, current) };
}
