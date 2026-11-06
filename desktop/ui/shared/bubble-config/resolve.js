import { CURRENT_DEFAULTS_VERSION, bubbleDefaultQueue } from './defaults.js';
import { isCurrentDefault } from './migrate.js';

const clone = value => JSON.parse(JSON.stringify(value));
const equal = (left, right) => JSON.stringify(left) === JSON.stringify(right);

export function defaultsKeys(subscription) {
  return subscription
    ? { items: 'subscriptionItems', version: 'subscriptionDefaultsVersion', edited: 'subscriptionDefaultsEdited' }
    : { items: 'items', version: 'defaultsVersion', edited: 'defaultsEdited' };
}

// The input must already have gone through migrateBubbleConfig(). This function
// only fills the current defaults version and decides whether the user edited
// the queue; it carries no compatibility for old shapes.
export function resolveBubbleConfig(config) {
  if (!config) return { config: null, changed: false };
  const resolved = clone(config);
  for (const subscription of [false, true]) {
    const keys = defaultsKeys(subscription);
    const items = resolved[keys.items];
    const version = resolved[keys.version];
    if (!Number.isInteger(version)) {
      const builtin = !Array.isArray(items) || !items.length || isCurrentDefault(items, subscription);
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
