import { FIRST_MODULES, QUOTA_CARDS, SUBSCRIPTION_QUEUE, SECOND_MODULES, COMPANION_ITEMS, API_SECOND_MODULES } from './content.js';
const clone = value => JSON.parse(JSON.stringify(value));
export const CURRENT_DEFAULTS_VERSION = 1;

// Built-in bubble content and editor draft rules. No DOM or persisted state.
var BUBBLE_KIND_LABEL = {
  normal: '余额内容',
  random: '随机语句',
  custom: '自定义内容'
};
function bubbleDefaultFirstModules() { return clone(FIRST_MODULES); }
function bubbleDefaultQuotaCards() { return clone(QUOTA_CARDS); }
export function bubbleDefaultSubscriptionQueue() { return clone(SUBSCRIPTION_QUEUE); }
export function bubbleLegacySubscriptionDefault(items) {
  try {
    // The earlier one-window-per-click layout carried a source row and a plain
    // reset line, so its two steps did not line up.
    if (Array.isArray(items) && items.length === 2 && items.every(function (item) {
      var parts = item && Array.isArray(item.modules) ? item.modules : [];
      return parts.length === 4 && parts[0].type === 'text' && /剩余$/.test(String(parts[0].text || '')) &&
        parts[1].type === 'quota' && parts[1].tpl === '{quota_left_round}' &&
        parts[2].type === 'quota' && parts[2].tpl === '{quota_reset_short}后重置' && parts[3].type === 'source';
    })) return true;
    // Every consumption layout, whatever its sizes, showed the used share.
    if (Array.isArray(items) && items.length === 2 && items.every(function (item, index) {
      var parts = item && Array.isArray(item.modules) ? item.modules : [];
      return parts.length === 5 && parts[0].text === 'Codex 额度消耗' && parts[1].text === (index ? '7d' : '5h') &&
        parts[2].type === 'quota' && parts[2].tpl === '{quota_used_round}' && parts[3].text === '距离重置';
    })) return true;
    // The first badge layout showed the remaining share under a shorter title.
    if (Array.isArray(items) && items.length === 2 && items.every(function (item, index) {
      var parts = item && Array.isArray(item.modules) ? item.modules : [];
      return parts.length === 5 && parts[0].text === 'Codex 额度' && parts[1].text === (index ? '7d' : '5h') &&
        parts[2].type === 'quota' && parts[2].tpl === '{quota_left_round}' &&
        parts[3].text === '距离充值' && parts[4].type === 'quota' && parts[4].tpl === '{quota_reset_short}';
    })) return true;
    // The layout before the title badge named each window in its own title.
    if (Array.isArray(items) && items.length === 2 && items.every(function (item, index) {
      var parts = item && Array.isArray(item.modules) ? item.modules : [];
      return parts.length === 4 && parts[0].type === 'text' && parts[0].text === (index ? '每周额度' : '5 小时额度') &&
        parts[1].type === 'quota' && parts[1].tpl === '{quota_left_round}' &&
        parts[2].type === 'text' && parts[2].text === '距离充值' &&
        parts[3].type === 'quota' && /^\{quota_reset(_short)?\}$/.test(String(parts[3].tpl || ''));
    })) return true;
    if (!Array.isArray(items) || items.length !== 1 || !Array.isArray(items[0].modules)) return false;
    var modules = items[0].modules;
    if (modules.some(function (m) { return m && m.type === 'quota' && String(m.tpl || '').indexOf('{quota_source}') >= 0; })) return true;
    // The previous three-module default stacked the two gauges on separate
    // rows, which pushed the lower card outside the bubble body.
    if (modules.length === 3) {
      var plan = modules[0], short = modules[1], weekly = modules[2];
      var isPlan = plan && plan.type === 'plan' && plan.quotaStyle === 'header' && !plan.apiModelId && String(plan.tpl || '{plan_name}') === '{plan_name}';
      var isMeter = function (m, minutes, row) {
        return m && m.type === 'quota' && m.quotaStyle === 'meter' && !m.apiModelId &&
          m.windowDurationMins === minutes && m.row === row && !m.tpl;
      };
      return !!(isPlan && isMeter(short, 300, 1) && isMeter(weekly, 10080, 2));
    }
    if (modules.length !== 7) return false;
    var quotaModules = modules.filter(function (m) { return m && m.type === 'quota'; });
    var quotaTemplates = quotaModules.map(function (m) { return String(m.tpl || ''); }).sort().join('|');
    return quotaModules.length === 6 &&
      quotaModules.filter(function (m) { return m.windowDurationMins === 300; }).length === 3 &&
      quotaModules.filter(function (m) { return m.windowDurationMins === 10080; }).length === 3 &&
      quotaTemplates === ['5 小时', '每周', '距离重置 {quota_reset_short}', '距离重置 {quota_reset_short}', '{quota_left_round}', '{quota_left_round}'].sort().join('|');
  } catch (err) { return false; }
}

// ==== [气泡默认内容] ====
export function bubbleDefaultSecondModules() { return clone(SECOND_MODULES); }
function bubbleParseDefaultItems() { return clone(COMPANION_ITEMS); }
function bubbleDefaultApiSecondModules() { return clone(API_SECOND_MODULES); }
export function bubbleDefaultQueue(isSubscription = false) {
  if (isSubscription) return bubbleDefaultSubscriptionQueue();
  return [
    { kind: 'custom', modules: bubbleDefaultFirstModules() },
    { kind: 'custom', modules: bubbleDefaultApiSecondModules() }
  ];
}
export function bubbleDefaultCompanionQueue(isSubscription = false) {
  if (!isSubscription) return bubbleParseDefaultItems();
  return [
    { kind: 'custom', modules: bubbleDefaultSubscriptionQueue()[0].modules },
    { kind: 'custom', modules: bubbleDefaultSecondModules() }
  ];
}
export function bubblePresetItems(name, isSubscription = false) {
  if (name === 'minimal') {
    return [{
      kind: 'custom',
      modules: isSubscription
        ? [{ type: 'quota', quotaStyle: 'meter', windowDurationMins: 300 }]
        : [{ type: 'balance', size: 20, rgb: 'indigo', color: '#203170', tpl: '{balance_api}' }]
    }];
  }
  if (name === 'companion') return bubbleDefaultCompanionQueue(isSubscription);
  if (name === 'quota-cards') return isSubscription ? bubbleDefaultQuotaCards() : bubbleDefaultQueue(false);
  if (name === 'quota') return isSubscription ? bubbleDefaultSubscriptionQueue() : bubbleDefaultQueue(false);
  if (isSubscription) return bubbleDefaultSubscriptionQueue();
  return bubbleDefaultQueue(false);
}
function bubbleKindLabel(kind) {
  return BUBBLE_KIND_LABEL[kind === 'random' ? 'random' : kind === 'custom' ? 'custom' : 'normal'];
}
export function bubbleDefaultModules(kind) {
  if (kind === 'random') return bubbleDefaultSecondModules();
  if (kind === 'normal') return bubbleDefaultFirstModules();
  return [{
    type: 'text',
    text: '新内容',
    size: 6
  }];
}
export function bubbleModuleListLabel(m) {
  m = m || ({});
  if (m.type === 'quota') return m.windowDurationMins === 10080 ? '每周额度' : '5 小时额度';
  if (m.type === 'turn') return '上轮 token 用量';
  if (m.type === 'plan') return 'Codex 套餐';
  if (m.type === 'session') return '当前会话';
  if (m.type === 'peak' || m.type === 'nextpeak') return 'DeepSeek 峰谷时段';
  if (m.type === 'text') return '文本: ' + (String(m.text || '').slice(0, 24) || '(空)');
  if (m.type === 'link') return '超链接: ' + (String(m.text || '').slice(0, 24) || '打开链接');
  if (m.type === 'random') return m.name || '随机语句';
  if (m.type === 'balance') return '余额数值';
  if (m.type === 'today') return '今日已观测';
  if (m.type === 'image') return '图片/动图';
  if (m.type === 'randimg') return '随机图片' + (m.imgs && m.imgs.length ? '(' + m.imgs.length + '张)' : '(空)');
  return '模块';
}
export function bubbleEditEnsureModules(item) {
  if (Array.isArray(item.modules)) return;
  if (item.kind === 'custom') {
    item.modules = [];
    return;
  }
  item.modules = bubbleDefaultModules(item.kind);
}
export function bubbleRowLabel(it) {
  if (it.modules && it.modules.length) return bubbleKindLabel('custom') + ' · ' + it.modules.length + '个模块';
  return bubbleKindLabel(it.kind);
}
export function bubbleIsChoice(step) {
  return !!(step && step.kind === 'choice');
}
export function bubbleChoiceOptions(step) {
  return step && step.kind === 'choice' && Array.isArray(step.options) ? step.options : [];
}
export function bubbleChoiceWeight(o) {
  return Math.min(99, Math.max(1, Math.round(Number(o && o.w) || 1)));
}
export function bubblePickChoiceItem(step, random = Math.random) {
  const options = bubbleChoiceOptions(step);
  if (!options.length) return null;
  let total = 0;
  for (const option of options) total += bubbleChoiceWeight(option);
  const threshold = random() * total;
  let accumulated = 0;
  for (const option of options) {
    accumulated += bubbleChoiceWeight(option);
    if (threshold < accumulated) return option?.item || null;
  }
  return options[options.length - 1]?.item || null;
}
export function bubbleSingleFromItem(itm) {
  return {
    kind: 'custom',
    modules: itm && Array.isArray(itm.modules) ? itm.modules : []
  };
}
export function bubbleStepToBubble(step) {
  if (bubbleIsChoice(step)) {
    var o0 = bubbleChoiceOptions(step)[0];
    step = o0 ? o0.item : null;
  }
  var mods = step && Array.isArray(step.modules) ? step.modules : bubbleDefaultModules(step && step.kind === 'random' ? 'random' : 'normal');
  return {
    kind: 'custom',
    modules: JSON.parse(JSON.stringify(mods))
  };
}
