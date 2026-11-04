import test from 'node:test';
import assert from 'node:assert/strict';
import { pricingSchedule, readPricingCalendar } from '../runtime/pricing-schedule.mjs';

const at = value => Date.parse(value);
const deepseek = { baseUrl: 'https://api.deepseek.com' };

test('peak windows come from the data calendar', () => {
  assert.equal(pricingSchedule(deepseek, at('2026-09-22T10:00:00+08:00')).phase, 'peak');
  assert.equal(pricingSchedule(deepseek, at('2026-09-22T13:00:00+08:00')).phase, 'off-peak');
  assert.equal(pricingSchedule(deepseek, at('2026-10-02T10:00:00+08:00')).phase, 'off-peak');
  assert.equal(pricingSchedule(deepseek, at('2026-09-19T10:00:00+08:00')).phase, 'off-peak');
  assert.equal(pricingSchedule(deepseek, at('2026-09-18T10:00:00+08:00')).phase, 'unknown');
  assert.equal(pricingSchedule({ baseUrl: 'https://api.example.com' }, Date.now()).visible, false);
});

test('an unlisted year stays visibly stale instead of inventing rules', () => {
  const value = pricingSchedule(deepseek, at('2027-01-05T10:00:00+08:00'));
  assert.equal(value.phase, 'unknown');
  assert.equal(value.stale, true);
  assert.match(value.note, /规则需更新/);
});

test('the calendar names its source and check date', () => {
  const calendar = readPricingCalendar();
  assert.match(calendar.source, /^https:\/\//);
  assert.match(calendar.rulesCheckedAt, /^\d{4}-\d{2}-\d{2}$/);
  assert.ok(calendar.years && Object.hasOwn(calendar.years, '2026'));
});
