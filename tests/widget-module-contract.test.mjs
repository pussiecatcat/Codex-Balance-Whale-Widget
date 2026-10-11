import { test } from 'node:test';
import assert from 'node:assert/strict';

import { createUsageAlerts } from '../desktop/ui/features/widget/usage-alerts.js';
import { bubbleDropShadow } from '../desktop/ui/features/widget/bubble-editor-view.js';
import { bubbleLegacySubscriptionDefault, bubbleDefaultSubscriptionQueue, bubbleUpgradeLegacySteps } from '../desktop/ui/features/widget/default-content.js';

// The widget monolith destructures these by name; a member dropped from the
// module's return leaves the monolith calling an unbound identifier at runtime.

test('usage-alerts exposes every member the monolith destructures', () => {
  const alerts = createUsageAlerts({});
  for (const name of ['usageAlertModsResolved', 'usageFillText', 'checkUsageAlerts',
    'showUsagePopup', 'usageTurnCostLines', 'usageWaitLinesOf', 'usageTodayKeyStr']) {
    assert.equal(typeof alerts[name], 'function', 'usageAlerts.' + name + ' must stay exported');
  }
});

test('usageAlertModsResolved returns one resolved module per input module', () => {
  const alerts = createUsageAlerts({
    WhaleMoney: { formatNumber: (value) => String(value) },
    whaleMoneyTemplates: { set() {} },
    whaleCurrencySymbol: () => '$',
    getCurrency: () => 'USD',
    fmt: (value) => String(value),
    bubbleTokenValue: (value) => String(value ?? ''),
    getLastTurnNotice: () => null,
    getUsageSet: () => ({}),
    getBubbleNoticeQueue: () => ({ push: () => false }),
    getAlertTtl: () => 0,
  });
  const out = alerts.usageAlertModsResolved([{ type: 'text', text: '余额 {below}' }, {}], 3, 7, null);
  assert.equal(out.length, 2);
  assert.equal(out[0].type, 'text');
  assert.equal(out[0].text, '余额 3');
});

test('bubbleDropShadow maps each drop zone to its indicator, and unknown zones to none', () => {
  assert.equal(bubbleDropShadow('before'), '0 -4px 0 #203170');
  assert.equal(bubbleDropShadow('after'), '0 4px 0 #203170');
  assert.equal(bubbleDropShadow('pairL'), 'inset 5px 0 0 #203170, inset 0 0 0 1px rgba(32,49,112,.35)');
  assert.equal(bubbleDropShadow('pairR'), 'inset -5px 0 0 #203170, inset 0 0 0 1px rgba(32,49,112,.35)');
  assert.equal(bubbleDropShadow('join'), '');
  assert.equal(bubbleDropShadow(undefined), '');
});

// A bubble still holding the old six-line quota default is replaced by the compact
// one wherever it is read - the render path and the editor's draft both ask this
// detector - and nothing else is touched. A bubble that merely resembles the old
// default, or that someone has edited since, is left exactly as the user left it.
// Nothing pinned this before, so a change could have dropped the migration quietly.
test('the old six-line quota default is recognised, and only it', () => {
  const legacy = [{ kind: 'custom', modules: [
    { type: 'plan', tpl: '{plan_name}' },
    { type: 'quota', windowDurationMins: 300, tpl: '5 小时' },
    { type: 'quota', windowDurationMins: 300, tpl: '{quota_left_round}' },
    { type: 'quota', windowDurationMins: 300, tpl: '距离重置 {quota_reset_short}' },
    { type: 'quota', windowDurationMins: 10080, tpl: '每周' },
    { type: 'quota', windowDurationMins: 10080, tpl: '{quota_left_round}' },
    { type: 'quota', windowDurationMins: 10080, tpl: '距离重置 {quota_reset_short}' },
  ] }];
  assert.equal(bubbleLegacySubscriptionDefault(legacy), true);

  const compact = bubbleDefaultSubscriptionQueue();
  assert.equal(compact[0].modules.length, 3, 'the replacement is the plan header plus one meter per window');
  assert.deepEqual(compact[0].modules.filter(mod => mod.quotaStyle === 'meter').map(mod => mod.windowDurationMins), [300, 10080]);

  const edited = structuredClone(legacy);
  edited[0].modules[2].tpl = '{quota_left} 剩余';
  assert.equal(bubbleLegacySubscriptionDefault(edited), false, 'an edited bubble belongs to the user and stays untouched');
  assert.equal(bubbleLegacySubscriptionDefault([{ kind: 'custom', modules: [{ type: 'quota', tpl: '{quota_source}' }] }]), true,
    'the older shape that printed its own source is still caught wherever it appears');
});

// A real queue holds the built-in quota bubble beside steps the user added, so the
// swap happens per step: the whole-queue test this replaced only matched a
// single-step queue, which is why a two-step one kept its seven-line bubble.
test('the upgrade swaps only the built-in step, wherever it sits in the queue', () => {
  const legacyStep = () => ({ kind: 'custom', modules: [
    { type: 'plan', tpl: '{plan_name}' },
    { type: 'quota', windowDurationMins: 300, tpl: '5 小时' },
    { type: 'quota', windowDurationMins: 300, tpl: '{quota_left_round}' },
    { type: 'quota', windowDurationMins: 300, tpl: '距离重置 {quota_reset_short}' },
    { type: 'quota', windowDurationMins: 10080, tpl: '每周' },
    { type: 'quota', windowDurationMins: 10080, tpl: '{quota_left_round}' },
    { type: 'quota', windowDurationMins: 10080, tpl: '距离重置 {quota_reset_short}' },
  ] });
  const mine = { kind: 'custom', modules: [{ type: 'text', text: '我自己的' }] };

  const upgraded = bubbleUpgradeLegacySteps([legacyStep(), mine]);
  assert.equal(upgraded.length, 2, 'the queue keeps its length');
  assert.equal(upgraded[0].modules.length, 3, 'the built-in bubble became the header plus two meters');
  assert.equal(upgraded[1], mine, 'the user’s own step is the very same object');

  const untouched = [mine];
  assert.equal(bubbleUpgradeLegacySteps(untouched), untouched, 'a queue with nothing to swap comes back as it was');

  const edited = [structuredClone(legacyStep())];
  edited[0].modules[2].tpl = '{quota_left} 剩余';
  assert.equal(bubbleUpgradeLegacySteps(edited)[0].modules.length, 7, 'a bubble edited since is left alone');
});
