import test from 'node:test';
import assert from 'node:assert/strict';
import { SoundSettingsController } from '../desktop/ui/features/sound-settings/controller.js';
import { createSoundService } from '../desktop/ui/services/sound.js';

function documentFixture() {
  const nodes = [], keyListeners = new Set();
  const document = {
    createElement(tagName) {
      const node = {
        tagName, dataset: {}, children: [], listeners: new Map(), className: '', textContent: '', value: '',
        append(...children) { for (const child of children) { child.parent = this; this.children.push(child); } },
        prepend(child) { child.parent = this; this.children.unshift(child); },
        replaceChildren(...children) { this.children = []; this.append(...children); },
        remove() { this.removed = true; if (this.parent) this.parent.children = this.parent.children.filter(child => child !== this); },
        setAttribute(name, value) { this[name] = value; },
        addEventListener(type, fn) { if (!this.listeners.has(type)) this.listeners.set(type, new Set()); this.listeners.get(type).add(fn); },
        removeEventListener(type, fn) { this.listeners.get(type)?.delete(fn); },
        emit(type) { return Promise.all([...(this.listeners.get(type) || [])].map(fn => fn({ target: this, stopPropagation() {}, preventDefault() {} }))); },
        closest() { return null; },
        get selectedOptions() { return this.children.filter(child => child.value === this.value); },
      };
      node.classList = { toggle() {}, add() {}, remove() {} };
      nodes.push(node);
      return node;
    },
    addEventListener(type, fn) { if (type === 'keydown') keyListeners.add(fn); },
    removeEventListener(type, fn) { if (type === 'keydown') keyListeners.delete(fn); },
  };
  document.body = document.createElement('body');
  return { document, nodes, keys: () => keyListeners.size, find: predicate => nodes.findLast(node => !node.removed && predicate(node)) };
}

function fixture() {
  const dom = documentFixture(), writes = [], applied = [];
  const saved = {
    schemaVersion: 1, revision: 'initial', size: { sound: true, vol: .9, soundSet: 'duck', turnCostOn: true, turnCostCloseMs: 5000 },
    usage: { taskEnd: { on: true, sel: 'preset:duck:press' } },
  };
  const windowRef = {
    document: dom.document,
    addEventListener() {}, removeEventListener() {}, dispatchEvent() {},
    CustomEvent: class { constructor(type, init) { this.type = type; this.detail = init.detail; } },
  };
  const controller = new SoundSettingsController({
    windowRef, documentRef: dom.document, sound: createSoundService(),
    menu: { mountMenuEntry: () => () => {} }, audioEditor: {}, promptEditor: {}, applySettings: value => applied.push(value),
    request: async (url, options = {}) => {
      if (url.endsWith('audio.json')) return { groups: [{ id: 'duck', name: '预设组' }], fragments: [] };
      if (options.method === 'PUT') { writes.push(options.body); return { ...options.body, revision: 'saved' }; }
      return structuredClone(saved);
    },
  }).start();
  return { controller, dom, writes, applied, saved };
}

test('sound panel input then cancel discards the draft and removes its keyboard listener', async () => {
  const { controller, dom, writes, saved } = fixture();
  await controller.open();
  const volume = dom.find(node => node.type === 'range');
  volume.value = '.2'; await volume.emit('input');
  await dom.find(node => node.tagName === 'button' && node.textContent === '取消').emit('click');
  assert.equal(writes.length, 0);
  assert.equal(saved.size.vol, .9);
  assert.equal(controller.view, null);
  assert.equal(dom.keys(), 0);
  controller.dispose();
});

test('sound panel save button persists the edited control once and applies the returned snapshot', async () => {
  const { controller, dom, writes, applied } = fixture();
  await controller.open();
  const volume = dom.nodes.find(node => node.type === 'range');
  volume.value = '.25'; await volume.emit('input');
  await dom.find(node => node.dataset.action === 'save-sound-settings').emit('click');
  assert.equal(writes.length, 1);
  assert.equal(writes[0].size.vol, .25);
  assert.equal(applied[0].revision, 'saved');
  assert.equal(controller.view, null);
  assert.equal(dom.keys(), 0);
  controller.dispose();
});
