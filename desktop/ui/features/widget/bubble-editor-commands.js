import {
  bubbleIsChoice, bubbleChoiceOptions, bubbleSingleFromItem, bubbleStepToBubble,
} from './default-content.js';

// Draft commands mutate only the supplied editor draft. Views decide when to repaint.
export function moveBubbleStep(items, index, direction) {
  const target = index + direction;
  if (index < 1 || target < 1 || target >= items.length) return false;
  [items[index], items[target]] = [items[target], items[index]];
  return true;
}

export function deleteBubbleStep(items, index) {
  if (index < 1 || index >= items.length || items.length <= 1) return false;
  items.splice(index, 1);
  return true;
}

export function addBubbleStep(items) {
  items.push({ kind: 'custom', modules: [] });
  return true;
}

export function reorderBubbleStep(items, from, to, zone) {
  if (from < 1 || to < 1 || from >= items.length || to >= items.length || from === to) return false;
  const target = items[to];
  const removed = items.splice(from, 1)[0];
  const targetIndex = items.indexOf(target);
  const at = zone === 'after' ? targetIndex + 1 : targetIndex;
  items.splice(Math.max(1, Math.min(at, items.length)), 0, removed);
  return true;
}

export function splitBubbleChoiceSide(items, from, side, to, zone) {
  const step = items[from];
  if (!bubbleIsChoice(step) || (zone !== 'before' && zone !== 'after')) return false;
  const options = bubbleChoiceOptions(step);
  if (side < 0 || side >= options.length || to < 1 || to >= items.length) return false;
  const moved = bubbleSingleFromItem(options[side].item || {});
  const rest = options.filter((_, index) => index !== side);
  if (from === to) {
    if (!rest.length) return false;
    items.splice(from, 1, bubbleSingleFromItem(rest[0].item));
    items.splice(zone === 'before' ? from : from + 1, 0, moved);
    return true;
  }
  const target = items[to];
  if (rest.length === 1) items.splice(from, 1, bubbleSingleFromItem(rest[0].item));
  else items.splice(from, 1);
  const targetIndex = items.indexOf(target);
  const at = zone === 'after' ? targetIndex + 1 : targetIndex;
  items.splice(Math.max(1, Math.min(at, items.length)), 0, moved);
  return true;
}

export function pairBubbleSteps(items, from, to, zone) {
  const source = items[from], target = items[to];
  if (!source || !target || from < 1 || to < 1 || from === to || bubbleIsChoice(source)) return false;
  if (bubbleIsChoice(target)) return { replaceSide: zone === 'pairL' ? 0 : 1 };
  const sourceItem = bubbleStepToBubble(source), targetItem = bubbleStepToBubble(target);
  const options = zone === 'pairL'
    ? [{ w: 1, item: sourceItem }, { w: 1, item: targetItem }]
    : [{ w: 1, item: targetItem }, { w: 1, item: sourceItem }];
  items.splice(Math.max(from, to), 1);
  items.splice(Math.min(from, to), 1);
  const at = from < to ? to - 1 : to;
  items.splice(Math.max(1, Math.min(at, items.length)), 0, { kind: 'choice', options });
  return true;
}

export function replaceBubbleChoiceSide(items, from, to, side) {
  const source = items[from], target = items[to];
  if (!source || !target || bubbleIsChoice(source) || !bubbleIsChoice(target)) return false;
  const options = bubbleChoiceOptions(target);
  if (!options.length) return false;
  options[side < options.length ? side : 0].item = bubbleStepToBubble(source);
  items.splice(from, 1);
  return true;
}

export function moveBubbleStepToEnd(items, from, side) {
  if (from < 1 || from >= items.length) return false;
  if (side >= 0) {
    const step = items[from];
    if (!bubbleIsChoice(step)) return false;
    const options = bubbleChoiceOptions(step);
    if (side >= options.length) return false;
    const moved = options[side].item || {};
    const rest = options.filter((_, index) => index !== side);
    if (rest.length === 1) items.splice(from, 1, bubbleSingleFromItem(rest[0].item));
    else if (rest.length >= 2) step.options = rest;
    else items.splice(from, 1);
    items.push(bubbleSingleFromItem(moved));
    return true;
  }
  if (items.length <= 1) return false;
  items.push(items.splice(from, 1)[0]);
  return true;
}

export function unpairBubbleStep(items, index) {
  const step = items[index];
  if (!bubbleIsChoice(step)) return false;
  const singles = bubbleChoiceOptions(step).map(option => bubbleStepToBubble(option.item));
  if (!singles.length) return false;
  items.splice(index, 1, ...singles);
  return true;
}
