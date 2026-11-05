import test from 'node:test';
import assert from 'node:assert/strict';
import { hasModelAlert, needsModelPolling, nextPollDelay } from '../desktop/ui/features/widget/model-polling.js';

test('only bound or alert models poll, and hidden widgets keep alert models only', () => {
  assert.equal(needsModelPolling({}, { bound: false, visible: true }), false);
  assert.equal(needsModelPolling({}, { bound: true, visible: true }), true);
  assert.equal(needsModelPolling({}, { bound: true, visible: false }), false);
  assert.equal(needsModelPolling({ alerts: { balanceBelow: 10 } }, { bound: false, visible: false }), true);
  assert.equal(needsModelPolling({ alerts: { dailyBudget: 1 } }, { bound: false, visible: true }), true);
  assert.equal(hasModelAlert({ alerts: { balanceBelow: '' } }), false, 'an empty threshold is not an alert');
});

test('provider failures back off up to five minutes', () => {
  assert.equal(nextPollDelay(1), 60000);
  assert.equal(nextPollDelay(2), 120000);
  assert.equal(nextPollDelay(3), 240000);
  assert.equal(nextPollDelay(9), 300000);
});
