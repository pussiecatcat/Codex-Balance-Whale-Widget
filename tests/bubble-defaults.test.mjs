import test from 'node:test';
import assert from 'node:assert/strict';
import { CURRENT_DEFAULTS_VERSION, bubbleDefaultQueue } from '../desktop/ui/shared/bubble-config/defaults.js';
import { resolveBubbleConfig, bubbleItemsForMode } from '../desktop/ui/shared/bubble-config/resolve.js';
import { migrateBubbleConfig } from '../desktop/ui/shared/bubble-config/migrate.js';
import { saveBubbleEditorDraft, trackBubbleDraft } from '../desktop/ui/features/widget/bubble-editor-model.js';

const custom = [{ kind: 'custom', modules: [{ type: 'text', text: 'my own bubble' }] }];
function migrateAndResolve(input) {
  const migrated = migrateBubbleConfig(input);
  const resolved = resolveBubbleConfig(migrated.config);
  return { config: resolved.config, changed: migrated.changed || resolved.changed };
}

test('edited queues are preserved across defaults upgrades independently for each mode', () => {
  const input = { v: 1, items: custom, lib: [], defaultsVersion: 0, defaultsEdited: true,
    subscriptionItems: custom, subscriptionDefaultsVersion: 0, subscriptionDefaultsEdited: false };
  const migrated = migrateAndResolve(input);
  assert.deepEqual(migrated.config.items, custom);
  assert.equal(migrated.config.defaultsVersion, 0);
  assert.deepEqual(migrated.config.subscriptionItems, bubbleDefaultQueue(true));
  assert.equal(migrated.config.subscriptionDefaultsVersion, CURRENT_DEFAULTS_VERSION);
  assert.equal(migrated.changed, true);
  assert.equal(migrateAndResolve(migrated.config).changed, false);
  assert.deepEqual(input.subscriptionItems, custom, 'migration does not mutate caller data');
});

test('unversioned custom queues gain edited metadata and never become a default', () => {
  const { config } = migrateAndResolve({ v: 1, items: custom, subscriptionItems: custom, lib: [] });
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
  const { config, changed } = migrateAndResolve({ v: 1, items: [], subscriptionItems: queue, lib: [] });
  assert.equal(changed, true);
  assert.equal(config.defaultsEdited, false);
  assert.equal(config.subscriptionDefaultsEdited, false);
  assert.deepEqual(config.subscriptionItems, bubbleDefaultQueue(true));
  assert.equal(resolveBubbleConfig(config).changed, false);
});

test('saving an editor change marks defaults edited; explicit reset can restore automatic upgrades', () => {
  const config = migrateAndResolve({ v: 1, items: [], subscriptionItems: [], lib: [] }).config;
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
  const first = migrateAndResolve(input);
  assert.equal(first.config.defaultsVersion, CURRENT_DEFAULTS_VERSION + 1, 'a newer defaults version is kept');
  assert.equal(migrateAndResolve(first.config).changed, false);
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

test('edited bubbles saved before semantic roles get their roles back', () => {
  const step = { kind: 'custom', modules: [
    { type: 'text', text: '我的标题', size: 4, tightTitle: true, row: 1 },
    { type: 'text', text: '5h', size: 1, titleBadge: true, row: 1 },
    { type: 'quota', windowDurationMins: 300, tpl: '{quota_reset}', row: 3 },
    { type: 'quota', windowDurationMins: 300, tpl: '{quota_reset}', quotaStyle: 'meter' },
  ] };
  const input = { v: 1, items: [], lib: [], subscriptionItems: [step], subscriptionDefaultsVersion: CURRENT_DEFAULTS_VERSION, subscriptionDefaultsEdited: true };
  const { config, changed } = migrateAndResolve(input);
  const modules = config.subscriptionItems[0].modules;
  assert.equal(changed, true);
  assert.deepEqual(modules.map(module => module.role), ['title', 'badge', 'countdown', undefined]);
  assert.equal('tightTitle' in modules[0] || 'titleBadge' in modules[1], false);
  assert.equal(modules[0].text, '我的标题', 'the user edit itself is kept');
  assert.equal(resolveBubbleConfig(config).changed, false, 'normalizing twice changes nothing');
});

test('schema 2 migration drops tapAdvance, keeps edits and runs once', () => {
  const edited = [{ kind: 'custom', modules: [{ type: 'text', text: '保留我' }] }];
  const input = { v: 1, items: edited, lib: [], tapAdvance: true, subscriptionTapAdvance: true, subscriptionItems: edited };
  const first = migrateBubbleConfig(input);
  assert.equal(first.changed, true);
  assert.equal(first.config.schema, 2);
  assert.equal('tapAdvance' in first.config, false);
  assert.equal('subscriptionTapAdvance' in first.config, false);
  assert.deepEqual(first.config.items, edited);
  const second = migrateBubbleConfig(first.config);
  assert.equal(second.changed, false, 'a second migration is a no-op');
});

test('a legacy built-in queue is replaced by the current default and marked unedited', () => {
  const legacy = [{ kind: 'custom', modules: [
    { type: 'text', text: '5 小时剩余', size: 4 },
    { type: 'quota', windowDurationMins: 300, tpl: '{quota_left_round}' },
    { type: 'quota', windowDurationMins: 300, tpl: '{quota_reset_short}后重置' },
    { type: 'source', tpl: '{source_line}' },
  ] }, { kind: 'custom', modules: [
    { type: 'text', text: '每周剩余', size: 4 },
    { type: 'quota', windowDurationMins: 10080, tpl: '{quota_left_round}' },
    { type: 'quota', windowDurationMins: 10080, tpl: '{quota_reset_short}后重置' },
    { type: 'source', tpl: '{source_line}' },
  ] }];
  const { config } = migrateBubbleConfig({ v: 1, items: [], subscriptionItems: legacy, lib: [] });
  assert.equal(config.subscriptionDefaultsEdited, false);
  assert.deepEqual(config.subscriptionItems, bubbleDefaultQueue(true));
  assert.equal(config.schema, 2);
});
