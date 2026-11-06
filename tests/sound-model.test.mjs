import test from 'node:test';
import assert from 'node:assert/strict';
import { COMPLETION_DEFAULT, completionMode, completionPatch } from '../desktop/ui/shared/sound-model.js';
import { SIZE_SETTINGS_DEFAULTS } from '../runtime/size-settings.mjs';
import { usageDefaults } from '../runtime/ledger.mjs';

test('completion mode and patch round-trip all four combinations', () => {
  for (const mode of ['off', 'bubble', 'custom', 'both']) {
    assert.equal(completionMode(completionPatch(mode)), mode);
  }
});

test('the default completion mode matches the runtime defaults', () => {
  const usage = usageDefaults();
  assert.equal(completionMode({ turnCostOn: SIZE_SETTINGS_DEFAULTS.turnCostOn, taskEndOn: usage.events.taskEnd?.on ?? usage.taskEnd.on }), COMPLETION_DEFAULT);
});
