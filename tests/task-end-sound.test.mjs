import test from 'node:test';
import assert from 'node:assert/strict';
import { createTaskEndSound } from '../desktop/ui/features/widget/task-end-sound.js';

function fixture() {
  let settings = { taskEnd: { on: true, sel: 'grp:custom', volSet: true, vol: 0.35 } };
  const select = {
    value: '', options: [],
    set innerHTML(value) { if (value === '') this.options = []; },
    appendChild(option) { this.options.push(option); },
    remove(index) { this.options.splice(index, 1); },
  };
  const plays = [];
  const window = { WhaleFeedbackSources: {}, WhaleFeedback: { play: (...args) => plays.push(args) } };
  let refreshes = 0;
  const sound = createTaskEndSound({
    document: { createElement: () => ({ value: '', textContent: '' }) }, window,
    Audio: class {}, taskEndSelect: select, getTaskEndDrop: () => ({ refresh: () => refreshes++ }),
    getUsageSettings: () => settings, setUsageSettings: value => { settings = value; },
    getAudioGroups: () => [{ id: 'custom', name: '自定义' }],
    getAudioFragments: () => [{ id: 'clip', name: '片段' }, { id: 'preset', name: '跳过', preset: true }],
    audioGroupName: id => id, getSoundState: () => ({ on: true, volume: 0.8 }),
  });
  return { sound, select, window, plays, settings: () => settings, refreshes: () => refreshes };
}

test('task end sound options keep groups, presets and imported fragments distinct', () => {
  const state = fixture();
  state.sound.fillOptions(state.settings().taskEnd);
  assert.equal(state.select.value, 'grp:custom');
  assert.deepEqual(state.select.options.map(option => option.value), [
    'grp:custom', 'preset:duck:press', 'preset:duck:release',
    'preset:fx1:press', 'preset:fx1:release', 'frag:clip',
  ]);
  assert.equal(state.refreshes(), 1);
});

test('task end sound routes the selected group through the feedback channel and its own volume', () => {
  const state = fixture();
  state.sound.play();
  assert.deepEqual(state.plays, [['success', '/dsh-whale/sound/press.mp3?set=custom', 0.35]]);
});
