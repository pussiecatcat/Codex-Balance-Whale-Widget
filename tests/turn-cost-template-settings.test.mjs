import test from 'node:test';
import assert from 'node:assert/strict';
import { createTurnCostTemplateSaver } from '../desktop/ui/features/widget/turn-cost-template-settings.js';

test('saving the subscription template preserves the API template and reads settings if needed', async () => {
  const writes = [], reads = [];
  const save = createTurnCostTemplateSaver({
    getUsageSet: () => null,
    requestJson: async url => { reads.push(url); return { ok: true, usage: { turnCost: {
      lines: [{ type: 'text', text: 'API template' }], subscriptionLines: [{ type: 'text', text: 'old subscription' }],
    } } }; },
    saveUsage: async patch => { writes.push(patch); return { ok: true }; },
    settingsUrl: '/api/sound-settings',
  });

  await save({ templateMode: 'subscription', lines: [{ type: 'text', text: 'new subscription' }] });
  assert.deepEqual(reads, ['/api/sound-settings']);
  assert.deepEqual(writes[0].turnCost.lines, [{ type: 'text', text: 'API template' }]);
  assert.deepEqual(writes[0].turnCost.subscriptionLines, [{ type: 'text', text: 'new subscription' }]);
});

test('a template save error is reported without writing a partial template', async () => {
  const errors = [], writes = [];
  const save = createTurnCostTemplateSaver({
    getUsageSet: () => null,
    requestJson: async () => ({ ok: false, error: 'unavailable' }),
    saveUsage: async patch => writes.push(patch),
    settingsUrl: '/api/sound-settings',
    onError: error => errors.push(error.message),
  });
  assert.equal(await save({ templateMode: 'api', lines: [] }), null);
  assert.deepEqual(errors, ['unavailable']);
  assert.deepEqual(writes, []);
});
