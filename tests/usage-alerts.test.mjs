import test from 'node:test';
import assert from 'node:assert/strict';
import { createUsageAlerts } from '../desktop/ui/features/widget/usage-alerts.js';

function fixture(mode = 'api') {
  const queued = [];
  let settings = { alert: { on: true, below: 10 }, budget: { on: true, amount: 5 } };
  const alerts = createUsageAlerts({
    document: {}, window: {}, getAccountMode: () => mode,
    WhaleMoney: { formatNumber: value => Number(value).toFixed(2), symbol: () => '$' },
    whaleMoneyTemplates: new WeakMap(), fmt: value => String(value),
    bubbleTokenValue: value => value == null ? '—' : String(value),
    whaleCurrencySymbol: () => '$', getUsageSet: () => settings,
    getLastTurnNotice: () => null, getCurrency: () => 'USD',
    getBubbleNoticeQueue: () => ({ push: item => { queued.push(item); return true; } }),
    getAlertTtl: () => 6500, now: () => Date.UTC(2026, 9, 10),
  });
  return { alerts, queued, setSettings: value => { settings = value; } };
}

test('usage alert templates interpolate amounts and turn fields without shared draft state', () => {
  const { alerts } = fixture();
  assert.equal(alerts.usageTodayKeyStr(), '2026-10-10');
  assert.equal(alerts.usageFillText('{currency}{amount} · {turn_title}', null, 3.5, 'USD',
    { label: '本轮消耗' }), '$3.50 · 本轮消耗');
  const a = alerts.usageRemindDefaultLines(true);
  a[0].text = 'changed';
  assert.match(alerts.usageRemindDefaultLines(true)[0].text, /余额/);
});

test('API and subscription task-end templates load and reset independently', () => {
  const { alerts, setSettings } = fixture('api');
  const apiLines = [{ type: 'text', text: 'API custom' }];
  const subscriptionLines = [{ type: 'text', text: 'Subscription custom' }];
  setSettings({ turnCost: { lines: apiLines, subscriptionLines } });
  assert.equal(alerts.usageTurnCostLines('api'), apiLines);
  assert.equal(alerts.usageTurnCostLines('subscription'), subscriptionLines);
  assert.equal(alerts.usageTurnCostDefaultLines('api').length, 3);
  assert.equal(alerts.usageTurnCostDefaultLines('subscription').length, 4);
});

test('subscription task-end bubble fills session, per-turn quota use, and cache hit variables', () => {
  const { alerts } = fixture('subscription');
  const notice = { sessionLabel: 'project', sessionId: 'session-abcdef', fiveHourQuotaPercent: 2,
    weeklyQuotaPercent: 0.4, cacheHitPercent: 86 };
  assert.equal(alerts.usageFillText('{turn_title}\n{turn_primary}\n{turn_quota}\n{turn_detail}', null, null, 'USD', notice),
    'Session · project · abcdef\n本轮消耗\n5h 2% · 周 0.4%\n缓存命中 86%');
  const lines = alerts.usageTurnCostLines('subscription');
  assert.deepEqual(lines.map(line => line.text), ['{turn_title}', '{turn_primary}', '{turn_quota}', '{turn_detail}']);
  assert.equal(lines[2].nowrap, true);
});

test('small quota use never rounds down to a visible zero', () => {
  const { alerts } = fixture('subscription');
  assert.equal(alerts.usageFillText('{turn_quota}', null, null, 'USD', {
    fiveHourQuotaPercent: 0.04, weeklyQuotaPercent: 1.254,
  }), '5h 0.04% · 周 1.25%');
  assert.equal(alerts.usageFillText('{turn_quota}', null, null, 'USD', {
    fiveHourQuotaPercent: 0.004, weeklyQuotaPercent: 0,
  }), '5h <0.01% · 周 0%');
});

test('usage alerts dedupe a low balance and daily budget independently', () => {
  const { alerts, queued, setSettings } = fixture();
  alerts.checkUsageAlerts(8, 6);
  alerts.checkUsageAlerts(8, 6);
  assert.deepEqual(queued.map(item => item.rank), [2, 1]);
  assert.ok(queued.every(item => item.ttlMs === 6500));
  alerts.checkUsageAlerts(12, 6);
  alerts.checkUsageAlerts(8, 6);
  assert.equal(queued.length, 3);
  setSettings(null);
  alerts.checkUsageAlerts(8, 6);
  assert.equal(queued.length, 3);
});
