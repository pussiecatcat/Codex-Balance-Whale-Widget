import test from 'node:test';
import assert from 'node:assert/strict';

import { createBubblePalette } from '../desktop/ui/features/widget/bubble-palette.js';

function fixture() {
  const element = (tag = 'div') => ({
    tagName: tag, className: '', textContent: '', title: '', draggable: false,
    children: [], listeners: {},
    appendChild(child) { this.children.push(child); return child; },
    addEventListener(type, fn) { (this.listeners[type] = this.listeners[type] || []).push(fn); },
    click() { for (const fn of this.listeners.click || []) fn({ stopPropagation() {} }); },
  });
  const root = element('div');
  const state = { added: [], paletteKeys: [], imagePicker: 0, confirmed: [] };
  const palette = createBubblePalette({
    document: { createElement: element },
    getPaletteElement: () => root,
    getLibrary: () => [],
    setDragKey: () => {},
    bubbleModuleAdd: module => state.added.push(module),
    bubbleModuleNew: module => state.added.push(module),
    bubblePickImageToAdd: () => { state.imagePicker++; },
    bubblePaletteModule: key => { state.paletteKeys.push(key); return { type: key, fromPalette: true }; },
    bubbleCloneModule: module => ({ ...module, cloned: true }),
    bubbleDefaultSecondModules: () => [{ type: 'text', text: '随机语句来源' }],
    showConfirm: (message, run) => state.confirmed.push({ message, run }),
    bubbleLibDel: () => {},
  });
  palette.render();
  return { palette, root, state };
}

const chips = root => root.children.filter(child => child.className === 'dshwv-palchip');
const chipFor = (root, label) => chips(root).find(chip => chip.textContent === label);

test('every palette chip builds its module through bubblePaletteModule', () => {
  const { root, state } = fixture();
  for (const chip of chips(root)) chip.click();
  // The order is the entry table's, and each key is the chip's own.
  assert.deepEqual(state.paletteKeys, ['text', 'balance', 'today', 'quota5', 'quotaWeek', 'turn',
    'plan', 'session', 'peak', 'link', 'randimg']);
  // The random chip sits between peak and link in the entry table and adds a
  // cloned text module, so it contributes a text entry before link's.
  assert.deepEqual(state.added.map(module => module.type),
    ['text', 'balance', 'today', 'quota5', 'quotaWeek', 'turn', 'plan', 'session', 'peak',
      'text', 'link', 'randimg']);
  assert.ok(state.added.every(module => module.type !== undefined));
});

test('the two chips that are not plain module entries keep their own path', () => {
  const { root, state } = fixture();
  chipFor(root, '随机语句').click();
  assert.deepEqual(state.added, [{ type: 'text', text: '随机语句来源', cloned: true }]);
  assert.deepEqual(state.paletteKeys, []);

  chipFor(root, '图片/动图').click();
  assert.equal(state.imagePicker, 1);
  assert.deepEqual(state.added, [{ type: 'text', text: '随机语句来源', cloned: true }]);
});

test('the palette offers one chip per entry plus the new-module chip', () => {
  const { root } = fixture();
  assert.equal(chips(root).length, 13);
  const newChip = root.children.find(child => child.className === 'dshwv-paladd');
  assert.equal(newChip.textContent, '+ 新建模块');
  // The new-module chip goes through bubbleModuleAdd with a palette module too.
  assert.ok(newChip.listeners.click.length > 0);
});

test('module library chips clone the stored module and delete behind a confirmation', () => {
  const element = tag => ({
    tagName: tag, className: '', textContent: '', title: '', children: [], listeners: {},
    appendChild(child) { this.children.push(child); return child; },
    addEventListener(type, fn) { (this.listeners[type] = this.listeners[type] || []).push(fn); },
    click() { for (const fn of this.listeners.click || []) fn({ stopPropagation() {} }); },
  });
  const root = element('div');
  const state = { added: [], deleted: [], reRendered: 0 };
  const palette = createBubblePalette({
    document: { createElement: element },
    getPaletteElement: () => root,
    getLibrary: () => [{ id: 'lib_1', name: '我的组合', module: { type: 'text', text: '来自库' } }],
    setDragKey: () => {},
    bubbleModuleAdd: module => state.added.push(module),
    bubbleModuleNew: () => {},
    bubblePickImageToAdd: () => {},
    bubblePaletteModule: key => ({ type: key }),
    bubbleCloneModule: module => ({ ...module, cloned: true }),
    bubbleDefaultSecondModules: () => [],
    showConfirm: (message, run) => state.confirmed = { message, run },
    bubbleLibDel: id => state.deleted.push(id),
  });
  palette.render();
  const libraryChip = root.children.find(child => child.className === 'dshwv-libchip');
  const body = libraryChip.children[0];
  body.click();
  assert.deepEqual(state.added, [{ type: 'text', text: '来自库', cloned: true }]);
  const del = libraryChip.children[1];
  del.click();
  assert.match(state.confirmed.message, /我的组合/);
  assert.deepEqual(state.deleted, []);
  state.confirmed.run();
  assert.deepEqual(state.deleted, ['lib_1']);
});
