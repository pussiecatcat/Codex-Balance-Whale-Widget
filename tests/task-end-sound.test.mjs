import test from 'node:test';
import assert from 'node:assert/strict';
import { createTaskEndSound } from '../desktop/ui/features/audio/task-end-sound.js';

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
    document: { createElement: () => ({ value: '', textContent: '' }) },
    playFeedback: (...args) => { window.WhaleFeedback.play(...args); return true; },
    rememberSuccessSource: url => { window.WhaleFeedbackSources.success = url; },
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

function fallback({ selection = 'grp:custom', rejects = false } = {}) {
  const players = [], sources = [];
  class Audio {
    constructor(url) { this.url = url; this.plays = 0; this.pauses = 0; players.push(this); }
    play() { this.plays++; return rejects ? Promise.reject(new Error('unavailable')) : Promise.resolve(); }
    pause() { this.pauses++; }
  }
  const sound = createTaskEndSound({
    Audio, taskEndSelect: {}, getUsageSettings: () => ({ taskEnd: { on: true, sel: selection, volSet: true, vol: .25 } }),
    getSoundState: () => ({ on: true, volume: .8 }),
    getAudioGroups: () => [{ id: 'custom', press: 'a', release: 'b' }],
    rememberSuccessSource: url => sources.push(url),
  });
  return { sound, players, sources };
}

test('fallback sound plays release only after press ends and preserves event volume', () => {
  const { sound, players } = fallback();
  sound.play();
  assert.equal(players.length, 1);
  assert.match(players[0].url, /press\.mp3/);
  assert.equal(players[0].volume, .25);
  players[0].onended();
  assert.equal(players[0].onended, null);
  assert.equal(players[0].pauses, 1);
  assert.equal(players.length, 2);
  assert.match(players[1].url, /release\.mp3/);
  assert.equal(players[1].plays, 1);
  sound.dispose();
  assert.equal(players[1].pauses, 1);
});

test('disposing fallback sound stops playback and prevents a queued ended callback from starting release', () => {
  const { sound, players } = fallback();
  sound.play();
  const ended = players[0].onended;
  sound.dispose(); sound.dispose();
  assert.equal(players[0].pauses, 1);
  assert.equal(players[0].onended, null);
  ended(); sound.play();
  assert.equal(players.length, 1);
  assert.equal(players[0].plays, 1);
});

test('failed fallback playback releases its player without starting release audio', async () => {
  const { sound, players } = fallback({ rejects: true });
  sound.play();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(players.length, 1);
  assert.equal(players[0].onended, null);
  assert.equal(players[0].pauses, 1);
  sound.dispose();
  assert.equal(players[0].pauses, 1, 'rejected players are no longer retained');
});

test('fragment fallback remembers the source and releases media after playback', () => {
  const { sound, players, sources } = fallback({ selection: 'frag:clip' });
  sound.play();
  assert.deepEqual(sources, ['/dsh-whale/audio-fragment.wav?id=clip']);
  players[0].onended(); sound.dispose();
  assert.equal(players[0].pauses, 1);
});
