import test from 'node:test';
import assert from 'node:assert/strict';
import { createAudioGroupEditor } from '../desktop/ui/features/widget/audio-group-editor.js';

function element(extra = {}) {
  return Object.assign({
    style: {}, value: '', textContent: '', children: [], listeners: {},
    addEventListener(type, fn) { this.listeners[type] = fn; },
    focus() { this.focused = true; },
  }, extra);
}

function build(overrides = {}) {
  const elements = {
    mask: element(), card: element(), title: element(), name: element(), play: element(),
    cancel: element(), save: element(), pressImport: element(), releaseImport: element(),
  };
  let press = '', release = '', groups = [{ id: 'g1', name: '旧组', press: 'p', release: 'r' }], fragments = [];
  const requests = [], played = [];
  class Audio {
    constructor(url) { this.url = url; this.currentTime = 0; this.duration = 0.05; }
    pause() {}
    play() { played.push(this.url); return Promise.resolve(); }
  }
  const editor = createAudioGroupEditor({
    Audio, requestJson: async (url, options) => { requests.push(options.body); return { ok: true, groups: [{ id: 'g1', name: options.body.name, press: options.body.press, release: options.body.release }], fragments }; },
    url: '/audio', elements,
    getGroups: () => groups, setGroups: value => { groups = value; },
    getFragments: () => fragments, setFragments: value => { fragments = value; },
    getPress: () => press, setPress: value => { press = value; },
    getRelease: () => release, setRelease: value => { release = value; },
    getSoundSet: () => 'g1', setSoundSet: () => {}, getVolume: () => 0.9,
    renderGroups: () => {}, refreshTaskEnd: () => {}, applySoundSet: () => {},
    slotPanel: { refresh: () => {}, close: () => {} }, startImport: () => {},
    requireSaved: value => value, assetFailure: error => { throw error; },
    ...overrides,
  });
  return { editor, elements, requests, played, get press() { return press; }, get release() { return release; }, get groups() { return groups; } };
}

test('the audio editor opens a group and saves the draft through the API', async () => {
  const fx = build();
  fx.editor.open(fx.elements && { id: 'g1', name: '新组', press: 'p1', release: 'r1' });
  assert.equal(fx.elements.title.textContent, '编辑音效组');
  assert.equal(fx.elements.name.value, '新组');
  assert.equal(fx.press, 'p1');
  assert.equal(fx.release, 'r1');
  assert.equal(fx.elements.mask.style.display, 'flex');

  fx.elements.name.value = '  改名  ';
  fx.editor.save();
  await new Promise(resolve => setTimeout(resolve, 0));
  assert.deepEqual(fx.requests[0], { action: 'save-group', id: 'g1', name: '改名', press: 'p1', release: 'r1' });
  assert.equal(fx.elements.mask.style.display, 'none');
  assert.equal(fx.groups[0].name, '改名');
});

test('an empty name is rejected and preview plays press then release', async () => {
  const fx = build();
  fx.editor.open({ id: 'g1', name: '旧组', press: 'p1', release: 'r1' });
  fx.elements.name.value = '   ';
  fx.editor.save();
  assert.equal(fx.elements.name.focused, true);
  assert.equal(fx.requests.length, 0);

  fx.editor.previewDown();
  assert.match(fx.played.at(-1), /p1/);
  fx.editor.previewUp();
  await new Promise(resolve => setTimeout(resolve, 0));
  assert.match(fx.played.at(-1), /r1/);
});
