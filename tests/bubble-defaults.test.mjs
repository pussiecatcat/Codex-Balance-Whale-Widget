import test from 'node:test';
import assert from 'node:assert/strict';
import { CURRENT_DEFAULTS_VERSION, bubbleDefaultQueue } from '../desktop/ui/features/widget/default-content.js';
import { resolveBubbleConfig, bubbleItemsForMode } from '../desktop/ui/features/widget/bubble-defaults.js';
import { saveBubbleEditorDraft, trackBubbleDraft } from '../desktop/ui/features/widget/bubble-editor-model.js';

const custom = [{ kind: 'custom', modules: [{ type: 'text', text: 'my own bubble' }] }];

test('edited queues are preserved across defaults upgrades independently for each mode', () => {
  const input = { v: 1, items: custom, lib: [], defaultsVersion: 0, defaultsEdited: true,
    subscriptionItems: custom, subscriptionDefaultsVersion: 0, subscriptionDefaultsEdited: false };
  const migrated = resolveBubbleConfig(input);
  assert.deepEqual(migrated.config.items, custom);
  assert.equal(migrated.config.defaultsVersion, 0);
  assert.deepEqual(migrated.config.subscriptionItems, bubbleDefaultQueue(true));
  assert.equal(migrated.config.subscriptionDefaultsVersion, CURRENT_DEFAULTS_VERSION);
  assert.equal(migrated.changed, true);
  assert.equal(resolveBubbleConfig(migrated.config).changed, false);
  assert.deepEqual(input.subscriptionItems, custom, 'migration does not mutate caller data');
});

test('unversioned custom queues gain edited metadata and never become a default', () => {
  const { config } = resolveBubbleConfig({ v: 1, items: custom, subscriptionItems: custom, lib: [] });
  assert.deepEqual(config.items, custom);
  assert.deepEqual(config.subscriptionItems, custom);
  assert.equal(config.defaultsEdited, true);
  assert.equal(config.subscriptionDefaultsEdited, true);
  assert.equal(resolveBubbleConfig(config).changed, false);
});

test('unversioned built-in queues migrate once to versioned semantic roles', () => {
  const queue = bubbleDefaultQueue(true);
  for (const step of queue) {
    step.modules[0].tightTitle = true; delete step.modules[0].role;
    step.modules[1].titleBadge = true; delete step.modules[1].role;
    for (const module of step.modules.slice(2)) delete module.role;
  }
  const { config, changed } = resolveBubbleConfig({ v: 1, items: [], subscriptionItems: queue, lib: [] });
  assert.equal(changed, true);
  assert.equal(config.defaultsEdited, false);
  assert.equal(config.subscriptionDefaultsEdited, false);
  assert.deepEqual(config.subscriptionItems, bubbleDefaultQueue(true));
  assert.equal(resolveBubbleConfig(config).changed, false);
});

test('saving an editor change marks defaults edited; explicit reset can restore automatic upgrades', () => {
  const config = resolveBubbleConfig({ v: 1, items: [], subscriptionItems: [], lib: [] }).config;
  const changed = saveBubbleEditorDraft(bubbleDefaultQueue(false), [], config, false, undefined, true);
  assert.equal(changed.defaultsEdited, true, 'even an edit later restored to the same text is recorded');
  const reset = saveBubbleEditorDraft(bubbleDefaultQueue(false), [], changed, false, undefined, false);
  assert.equal(reset.defaultsEdited, false);
  const customSave = saveBubbleEditorDraft(custom, [], reset, false, undefined, false);
  assert.equal(customSave.defaultsEdited, true, 'a false flag cannot classify custom content as a default');
  assert.deepEqual(bubbleItemsForMode(customSave, false), custom);
});

test('a newer defaults version is never downgraded', () => {
  const input = { v: 1, items: custom, lib: [], defaultsVersion: CURRENT_DEFAULTS_VERSION + 1, defaultsEdited: false,
    subscriptionItems: bubbleDefaultQueue(true), subscriptionDefaultsVersion: CURRENT_DEFAULTS_VERSION, subscriptionDefaultsEdited: false };
  assert.equal(resolveBubbleConfig(input).changed, false);
});


test('draft mutation tracking records nested edits even when values are restored', () => {
  let edited = false;
  const draft = trackBubbleDraft(bubbleDefaultQueue(false), () => { edited = true; });
  const original = draft[0].modules[0].text;
  draft[0].modules[0].text = 'changed';
  draft[0].modules[0].text = original;
  assert.equal(edited, true);
  edited = false;
  draft[0].modules[0].text = original;
  assert.equal(edited, false, 'reads and no-op assignments do not opt out');
  draft.push({ kind: 'custom', modules: [] });
  assert.equal(edited, true);
});
