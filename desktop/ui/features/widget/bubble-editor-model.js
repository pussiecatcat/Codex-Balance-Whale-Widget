import { bubbleDefaultQueue,
  bubbleDefaultSecondModules, bubbleChoiceWeight, bubbleSingleFromItem,
  bubbleIsChoice, bubbleChoiceOptions, bubbleDefaultModules } from './default-content.js';
import { bubbleRowsCanon } from './bubble-layout.js';
import { bubbleItemsForMode, bubbleSavedMetadata, resolveBubbleConfig } from './bubble-defaults.js';

const clone = value => JSON.parse(JSON.stringify(value));

// Track mutations rather than comparing final JSON: edit → undo still opts out
// of automatic default upgrades, until the user explicitly restores defaults.
export function trackBubbleDraft(value, changed) {
  const proxies = new WeakMap();
  function wrap(target) {
    if (!target || typeof target !== 'object') return target;
    if (proxies.has(target)) return proxies.get(target);
    const proxy = new Proxy(target, {
      get(object, key) { return wrap(Reflect.get(object, key)); },
      set(object, key, next) {
        if (!Object.is(object[key], next)) changed();
        return Reflect.set(object, key, next);
      },
      deleteProperty(object, key) {
        if (Object.hasOwn(object, key)) changed();
        return Reflect.deleteProperty(object, key);
      },
    });
    proxies.set(target, proxy);
    proxies.set(proxy, proxy);
    return proxy;
  }
  return wrap(value);
}

export function loadBubbleEditorDraft(config, subscriptionMode) {
  const library = Array.isArray(config?.lib) ? clone(config.lib) : [];
  const source = bubbleItemsForMode(config, subscriptionMode);
  const items = [];
  for (const step of source) {
    if (step?.kind === 'choice' && Array.isArray(step.options)) {
      const options = step.options.slice(0, 2).map(option => {
        const item = option?.item || {};
        return { w: bubbleChoiceWeight(option), item: { kind: 'custom',
          modules: Array.isArray(item.modules) ? clone(item.modules) : item.kind === 'random' ? bubbleDefaultSecondModules() : [] } };
      });
      if (options.length === 1) { items.push(bubbleSingleFromItem(options[0].item)); continue; }
      if (options.length >= 2) { items.push({ kind: 'choice', options }); continue; }
    }
    items.push({ kind: step?.kind === 'random' ? 'random' : step?.kind === 'custom' ? 'custom' : 'normal',
      modules: step?.modules ? clone(step.modules) : undefined });
  }
  for (const step of items) {
    const entries = step.kind === 'choice' ? step.options.map(option => option.item) : [step];
    for (const item of entries) if (Array.isArray(item.modules)) bubbleRowsCanon(item.modules);
  }
  const tapAdvance = subscriptionMode
    ? config?.subscriptionTapAdvance === true
    : config?.tapAdvance === true;
  return { items, library, tapAdvance };
}

function saveBubbleEditorStep(step) {
  if (bubbleIsChoice(step)) {
    const options = bubbleChoiceOptions(step).map(option => {
      const item = option?.item || {};
      const modules = Array.isArray(item.modules) ? clone(item.modules) : bubbleDefaultModules(item.kind === 'random' ? 'random' : 'normal');
      bubbleRowsCanon(modules);
      return { w: bubbleChoiceWeight(option), item: { kind: 'custom', modules } };
    });
    return { kind: 'choice', options };
  }
  const modules = Array.isArray(step.modules) ? clone(step.modules) : bubbleDefaultModules(step.kind);
  bubbleRowsCanon(modules);
  return { kind: 'custom', modules };
}

export function saveBubbleEditorDraft(items, library, config, subscriptionMode, _retiredTapAdvance, defaultsEdited) {
  const savedItems = items.map(saveBubbleEditorStep);
  const resolved = resolveBubbleConfig(config).config || {};
  return { v: 1, editingMode: subscriptionMode ? 'subscription' : 'api',
    items: subscriptionMode ? config?.items || bubbleDefaultQueue(false) : savedItems,
    subscriptionItems: subscriptionMode ? savedItems : config?.subscriptionItems || [],
    defaultsVersion: resolved.defaultsVersion,
    defaultsEdited: resolved.defaultsEdited,
    subscriptionDefaultsVersion: resolved.subscriptionDefaultsVersion,
    subscriptionDefaultsEdited: resolved.subscriptionDefaultsEdited,
    ...bubbleSavedMetadata(savedItems, resolved, subscriptionMode, defaultsEdited),
    lib: library };
}
