import test from 'node:test';
import assert from 'node:assert/strict';
import { createUsageAlerts } from '../desktop/ui/features/widget/usage-alerts.js';

function fixture() {
  const queued = [];
  let settings = { alert: { on: true, below: 10 }, budget: { on: true, amount: 5 } };
  const alerts = createUsageAlerts({
    document: {}, window: { WhaleAccountView: { mode: 'api' } },
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
