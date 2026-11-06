import test from 'node:test';
import assert from 'node:assert/strict';
import { createBubbleEditorController } from '../desktop/ui/features/widget/bubble-editor-controller.js';
import { createItemEditor } from '../desktop/ui/features/widget/item-editor.js';
import { loadBubbleEditorDraft, saveBubbleEditorDraft } from '../desktop/ui/features/widget/bubble-editor-model.js';
import { bubbleDefaultQueue, bubbleIsChoice, bubbleChoiceOptions, bubbleChoiceWeight, bubbleEditEnsureModules } from '../desktop/ui/features/widget/default-content.js';
import { resolveBubbleConfig } from '../desktop/ui/features/widget/bubble-defaults.js';
import { bubbleRowsCanon } from '../desktop/ui/features/widget/bubble-layout.js';

function fixture() {
  const state = { items: [], lib: [], editorSnap: null };
  const mask = { style: { display: 'none' } };
  let config = resolveBubbleConfig({ v: 1, items: [], subscriptionItems: [], lib: [] }).config;
  let mode = 'subscription';
  const errors = [], saved = [];
  const controller = createBubbleEditorController({
    state, view: { renderFirst() {}, renderMore() {} }, getMask: () => mask, getMode: () => mode,
    getConfig: () => config, isConfigLoaded: () => true, loadConfig: async () => true,
    saveConfig(value, done) { config = value; saved.push(value); done(true); },
    draftOf: loadBubbleEditorDraft, draftSave: saveBubbleEditorDraft, defaultQueue: bubbleDefaultQueue,
    showConfirm: (_message, run) => run(), assetFailure: error => errors.push(error), closeRolePanel() {}, closeAudioGroupPanel() {},
  });
  return { state, mask, controller, saved, errors, setMode(value) { mode = value; } };
}
const tick = () => new Promise(resolve => setImmediate(resolve));

test('bubble editor opens and closes repeatedly without retaining a session or calling removed helpers', async () => {
  const fx = fixture();
  for (let count = 0; count < 3; count++) {
    fx.controller.open(); await tick();
    assert.equal(fx.mask.style.display, 'flex');
    assert.equal(fx.controller.dirty(), false);
    fx.controller.close();
    assert.equal(fx.mask.style.display, 'none');
    assert.equal(fx.state.editorSnap, null);
  }
  assert.deepEqual(fx.errors, []);
});

test('opening an item does not mark defaults edited; edits and undo do, while reset restores defaults', async () => {
  const fx = fixture(); fx.controller.open(); await tick();
  const itemEditor = createItemEditor({ document: {}, state: fx.state, target: () => fx.state.items[0],
    stepLabel: () => 'first', isChoice: bubbleIsChoice, choiceOptions: bubbleChoiceOptions, choiceWeight: bubbleChoiceWeight,
    ensureModules: bubbleEditEnsureModules, rowsCanon: bubbleRowsCanon, zClean() {},
    ctx: { itemTitleEl: {}, itemMask: { style: {} }, renderPal() {}, renderPv() {} } });
  itemEditor.openBubbleItem(0, -1);
  fx.controller.save();
  assert.equal(fx.saved.at(-1).subscriptionDefaultsEdited, false);
  fx.controller.open(); await tick();
  const oldText = fx.state.items[0].modules[0].text;
  fx.state.items[0].modules[0].text = 'edited';
  fx.state.items[0].modules[0].text = oldText;
  fx.setMode('api');
  fx.controller.save();
  assert.equal(fx.saved.at(-1).editingMode, 'subscription', 'opening mode owns the save');
  assert.equal(fx.saved.at(-1).subscriptionDefaultsEdited, true);
  fx.setMode('subscription'); fx.controller.open(); await tick();
  fx.controller.reset(); fx.controller.save();
  assert.equal(fx.saved.at(-1).subscriptionDefaultsEdited, false);
  assert.deepEqual(fx.errors, []);
});
