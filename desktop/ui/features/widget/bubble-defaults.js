import { CURRENT_DEFAULTS_VERSION, bubbleDefaultQueue, bubbleLegacySubscriptionDefault } from './default-content.js';
import { bubbleRowsCanon } from './bubble-layout.js';

const clone = value => JSON.parse(JSON.stringify(value));
const stable = value => Array.isArray(value) ? value.map(stable) : value && typeof value === 'object'
  ? Object.fromEntries(Object.keys(value).sort().map(key => [key, stable(value[key])])) : value;
const equal = (left, right) => JSON.stringify(stable(left)) === JSON.stringify(stable(right));

export function defaultsKeys(subscription) {
  return subscription
    ? { items: 'subscriptionItems', version: 'subscriptionDefaultsVersion', edited: 'subscriptionDefaultsEdited' }
    : { items: 'items', version: 'defaultsVersion', edited: 'defaultsEdited' };
}

function currentShape(items) {
  // Compatibility for the last unversioned release, before semantic roles.
  return (items || []).map(step => ({ ...step, modules: step.modules?.map(module => {
    const result = { ...module };
    if (result.tightTitle) { result.role = 'title'; delete result.tightTitle; }
    if (result.titleBadge) { result.role = 'badge'; delete result.titleBadge; }
    return result;
  }) }));
}

function isCurrentDefault(items, subscription) {
  const expected = bubbleDefaultQueue(subscription);
  const candidate = currentShape(items);
  if (subscription) {
    for (const step of candidate) {
      if (!Array.isArray(step.modules)) continue;
      for (const module of step.modules) {
        if (module.type === 'quota' && module.tpl === '{quota_left_round}') module.role ||= 'hero';
        if (module.type === 'quota' && ['{quota_reset}', '{quota_reset_short}'].includes(module.tpl)) module.role ||= 'countdown';
        if (module.type === 'text' && module.text === '距离重置') module.role ||= 'chip';
      }
    }
  }
  for (const queue of [candidate, expected]) {
    for (const step of queue) if (Array.isArray(step.modules)) bubbleRowsCanon(step.modules);
  }
  return equal(candidate, expected);
}

// Configs saved before semantic roles carry tightTitle / titleBadge flags, and
// their countdowns carry no role at all. Rendering only reads `role`, so without
// this those bubbles lose the title, badge and countdown styling for good once
// the user has edited them (edited bubbles never receive new defaults).
const COUNTDOWN_TEMPLATES = new Set(['{quota_reset}', '{quota_reset_short}']);
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

export function resolveBubbleConfig(config) {
  if (!config) return { config: null, changed: false };
  const resolved = clone(config);
  normalizeLegacyRoles(resolved.items);
  normalizeLegacyRoles(resolved.subscriptionItems);
  for (const subscription of [false, true]) {
    const keys = defaultsKeys(subscription);
    const items = resolved[keys.items];
    const version = resolved[keys.version];
    if (!Number.isInteger(version)) {
      const builtin = !Array.isArray(items) || !items.length || isCurrentDefault(items, subscription) ||
        (subscription && bubbleLegacySubscriptionDefault(items));
      resolved[keys.version] = CURRENT_DEFAULTS_VERSION;
      resolved[keys.edited] = !builtin;
      if (builtin) resolved[keys.items] = bubbleDefaultQueue(subscription);
    } else if (resolved[keys.edited] === false && version < CURRENT_DEFAULTS_VERSION) {
      resolved[keys.items] = bubbleDefaultQueue(subscription);
      resolved[keys.version] = CURRENT_DEFAULTS_VERSION;
    }
  }
  return { config: resolved, changed: !equal(config, resolved) };
}

export function bubbleItemsForMode(config, subscription) {
  const resolved = resolveBubbleConfig(config).config;
  const items = resolved?.[defaultsKeys(subscription).items];
  return Array.isArray(items) && items.length ? items : bubbleDefaultQueue(subscription);
}

export function bubbleSavedMetadata(items, config, subscription, edited) {
  const keys = defaultsKeys(subscription);
  const current = isCurrentDefault(items, subscription);
  return {
    [keys.version]: CURRENT_DEFAULTS_VERSION,
    [keys.edited]: edited === false && current ? false : edited === true || config?.[keys.edited] === true || !current,
  };
}
