import { bubbleDefaultQueue, bubbleDefaultSubscriptionQueue, bubbleLegacySubscriptionDefault,
  bubbleDefaultSecondModules, bubbleChoiceWeight, bubbleSingleFromItem,
  bubbleIsChoice, bubbleChoiceOptions, bubbleDefaultModules, bubbleParseDefaultItems } from './default-content.js';
import { bubbleRowsCanon } from './bubble-layout.js';

const clone = value => JSON.parse(JSON.stringify(value));

export function loadBubbleEditorDraft(config, subscriptionMode) {
  const library = Array.isArray(config?.lib) ? clone(config.lib) : [];
  let saved = subscriptionMode ? config?.subscriptionItems : config?.items;
  if (subscriptionMode && bubbleLegacySubscriptionDefault(saved)) saved = bubbleDefaultSubscriptionQueue();
  const source = Array.isArray(saved) && saved.length ? saved : bubbleDefaultQueue(subscriptionMode);
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
  return { items, library };
}

export function saveBubbleEditorStep(step) {
  if (bubbleIsChoice(step)) {
    const options = bubbleChoiceOptions(step).map(option => {
      const item = option?.item || {};
      const modules = Array.isArray(item.modules) ? item.modules : bubbleDefaultModules(item.kind === 'random' ? 'random' : 'normal');
      bubbleRowsCanon(modules);
      return { w: bubbleChoiceWeight(option), item: { kind: 'custom', modules } };
    });
    return { kind: 'choice', options };
  }
  const modules = Array.isArray(step.modules) ? step.modules : bubbleDefaultModules(step.kind);
  bubbleRowsCanon(modules);
  return { kind: 'custom', modules };
}

export function saveBubbleEditorDraft(items, library, config, subscriptionMode) {
  const savedItems = items.map(saveBubbleEditorStep);
  return { v: 1, editingMode: subscriptionMode ? 'subscription' : 'api',
    items: subscriptionMode ? config?.items || bubbleParseDefaultItems() : savedItems,
    subscriptionItems: subscriptionMode ? savedItems : config?.subscriptionItems || [],
    tapAdvance: config?.tapAdvance === true,
    subscriptionTapAdvance: config?.subscriptionTapAdvance !== false,
    lib: library };
}
