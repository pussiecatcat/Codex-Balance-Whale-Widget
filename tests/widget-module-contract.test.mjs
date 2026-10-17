import { test } from 'node:test';
import assert from 'node:assert/strict';

import { createUsageAlerts } from '../desktop/ui/features/widget/usage-alerts.js';
import { bubbleDropShadow } from '../desktop/ui/features/widget/bubble-editor-view.js';

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
  assert.equal(bubbleDropShadow('before'), '0 -3px 0 #203170');
  assert.equal(bubbleDropShadow('after'), '0 3px 0 #203170');
  assert.equal(bubbleDropShadow('pairL'), 'inset 3px 0 0 #203170');
  assert.equal(bubbleDropShadow('pairR'), 'inset -3px 0 0 #203170');
  assert.equal(bubbleDropShadow('join'), '');
  assert.equal(bubbleDropShadow(undefined), '');
});
