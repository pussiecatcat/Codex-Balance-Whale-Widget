import test from 'node:test';
import assert from 'node:assert/strict';

import { createSnapEditor } from '../desktop/ui/features/widget/snap-editor.js';

// A permissive element stub: the editor builds a whole card at construction, and
// only ever sets styles, classes, text and listeners on it.
function element(tag = 'div') {
  const node = {
    tagName: tag, className: '', textContent: '', type: '', title: '', value: '', checked: false,
    draggable: false, hidden: false, disabled: false, min: '', step: '', style: {},
    children: [], listeners: {}, _html: '',
    set innerHTML(value) { this._html = value; if (value === '') this.children = []; },
    get innerHTML() { return this._html; },
    classList: {
      set: new Set(),
      add(name) { this.set.add(name); },
      remove(name) { this.set.delete(name); },
      contains(name) { return this.set.has(name); },
      toggle(name, on) { if (on) this.set.add(name); else this.set.delete(name); },
    },
    appendChild(child) { this.children.push(child); return child; },
    removeChild(child) { this.children = this.children.filter(item => item !== child); return child; },
    setAttribute(name, value) { this[name] = value; },
    removeAttribute(name) { delete this[name]; },
    getBoundingClientRect() { return { width: 190, height: 190, left: 10, top: 20, bottom: 210, right: 200 }; },
    addEventListener(type, fn) { (this.listeners[type] = this.listeners[type] || []).push(fn); },
    removeEventListener() {},
    fire(type, event = {}) { for (const fn of this.listeners[type] || []) fn({ stopPropagation() {}, preventDefault() {}, ...event }); },
    querySelectorAll() { return []; },
    focus() {}, setPointerCapture() {}, releasePointerCapture() {},
  };
  return node;
}

const VIEWPORT = { w: 800, h: 400 };
const TITLES = {
  T: '上侧吸附区：距屏幕顶部的宽度',
  L: '左侧吸附区：距屏幕左边的宽度',
  R: '右侧吸附区：距屏幕右边的宽度',
  B: '下侧吸附区：距屏幕底部的宽度',
  F: '翻转线：距屏幕左边的位置，线左侧的鲸鱼会左右翻转',
};
const DEFAULT_CONFIG = {
  mode: 'ratio',
  ratio: { L: 10, T: 0, R: 10, B: 15, F: 50 },
  px: { L: 80, T: 0, R: 80, B: 80, F: 400 },
};

function fixture(initial = DEFAULT_CONFIG, viewport = VIEWPORT) {
  let config = JSON.parse(JSON.stringify(initial));
  const calls = { saved: 0, closedPanels: 0, clamped: [], fixed: 0, checked: 0, expressed: 0, flipped: [] };
  const created = [];
  const documentStub = {
    createElement(tag) { const node = element(tag); created.push(node); return node; },
    body: element('body'),
    addEventListener() {}, removeEventListener() {},
  };
  const editor = createSnapEditor({
    document: documentStub,
    viewport: () => viewport,
    cloneSnap: source => JSON.parse(JSON.stringify(source)),
    clampSnapKey: (mode, key, value) => { calls.clamped.push([mode, key, value]); return value; },
    fixSnapConfig: () => { calls.fixed++; },
    getSnapConfig: () => config,
    setSnapConfig: next => { config = next; },
    saveSnapConfig: () => { calls.saved++; },
    closeRolePanel: () => { calls.closedPanels++; },
    closeAudioGroupPanel: () => { calls.closedPanels++; },
    setFlip: value => { calls.flipped.push(value); },
    express: () => { calls.expressed++; },
    snapCheck: () => { calls.checked++; },
  });
  return {
    editor, calls, created,
    num: key => created.find(node => node.className === 'dshwv-snapnum' && node.title === TITLES[key]),
    btn: label => created.find(node => node.className.startsWith('dshwv-snapbtn') && node.textContent === label),
    config: () => config,
  };
}

const type = (fx, key, value) => { const input = fx.num(key); input.value = String(value); input.fire('change'); };

test('opening the editor works on a clone, so the live config is untouched', () => {
  const { editor, calls, config } = fixture();
  editor.open();
  assert.equal(calls.closedPanels, 2, 'other floating panels close first');
  assert.equal(calls.saved, 0);
  assert.deepEqual(config().ratio, DEFAULT_CONFIG.ratio);
  editor.close(false);
  assert.deepEqual(config().ratio, DEFAULT_CONFIG.ratio);
  assert.equal(calls.saved, 0);
});

test('cancelling discards a typed edit; confirming keeps it', () => {
  const cancelled = fixture();
  cancelled.editor.open();
  type(cancelled, 'L', 25);
  cancelled.editor.close(false);
  assert.equal(cancelled.config().ratio.L, 10, 'the edit never reached the config');
  assert.equal(cancelled.calls.saved, 0);
  assert.equal(cancelled.calls.checked, 0);

  const confirmed = fixture();
  confirmed.editor.open();
  type(confirmed, 'L', 25);
  confirmed.editor.close(true);
  assert.equal(confirmed.config().ratio.L, 25);
  assert.equal(confirmed.calls.saved, 1);
  assert.equal(confirmed.calls.checked, 1, 'a ratio config is re-checked against the window');
  assert.equal(confirmed.calls.fixed, 1, 'the saved config is repaired in place');
});

test('each typed value is clamped through the shared helper for the active mode', () => {
  const fx = fixture();
  fx.editor.open();
  type(fx, 'L', 25);
  type(fx, 'F', 50);
  assert.deepEqual(fx.calls.clamped, [['ratio', 'L', 25], ['ratio', 'F', 50]]);
});

test('a non-numeric entry is ignored rather than stored as NaN', () => {
  const fx = fixture();
  fx.editor.open();
  const input = fx.num('L');
  input.value = 'abc';
  input.fire('change');
  fx.editor.close(true);
  assert.equal(fx.config().ratio.L, 10);
});

test('edits are ignored while the mode is off', () => {
  const off = { mode: 'off', ratio: DEFAULT_CONFIG.ratio, px: DEFAULT_CONFIG.px };
  const fx = fixture(off);
  fx.editor.open();
  type(fx, 'L', 40);
  assert.deepEqual(fx.calls.clamped, [], 'an off config has nothing to clamp');
  fx.editor.close(true);
  assert.deepEqual(fx.config(), off);
});

test('the reset button restores the ratio defaults and confirming saves them', () => {
  const fx = fixture();
  fx.editor.open();
  type(fx, 'L', 25);
  type(fx, 'B', 40);
  fx.btn('重置').fire('click');
  fx.editor.close(true);
  assert.deepEqual(fx.config().ratio, DEFAULT_CONFIG.ratio);
});

test('the cancel button closes without saving and the confirm button saves', () => {
  const fx = fixture();
  fx.editor.open();
  type(fx, 'L', 30);
  fx.btn('取消').fire('click');
  assert.equal(fx.calls.saved, 0);
  assert.equal(fx.config().ratio.L, 10);

  fx.editor.open();
  type(fx, 'L', 30);
  fx.btn('确认').fire('click');
  assert.equal(fx.calls.saved, 1);
  assert.equal(fx.config().ratio.L, 30);
});

test('confirming without having opened the editor writes nothing', () => {
  const { editor, calls, config } = fixture();
  editor.close(true);
  assert.equal(calls.saved, 0);
  assert.equal(calls.checked, 0);
  assert.deepEqual(config(), DEFAULT_CONFIG);
});

test('the saved config is a copy, so later edits to the draft cannot reach it', () => {
  const { editor, config } = fixture();
  editor.open();
  editor.close(true);
  const saved = config();
  saved.ratio.L = 999;
  editor.open();
  editor.close(true);
  assert.equal(config().ratio.L, 999, 'the second save replaced the object wholesale');
  assert.notEqual(config().ratio, saved);
});

test('a config saved in pixel mode keeps its own L/T/R/B/F', () => {
  const pixels = { mode: 'px', ratio: DEFAULT_CONFIG.ratio, px: { L: 5, T: 6, R: 7, B: 8, F: 400 } };
  const { editor, config } = fixture(pixels);
  editor.open();
  editor.close(true);
  assert.deepEqual(config().px, pixels.px);
});

test('confirming a switched-off config releases the flip instead of re-checking', () => {
  const off = { mode: 'off', ratio: DEFAULT_CONFIG.ratio, px: DEFAULT_CONFIG.px };
  const { editor, calls } = fixture(off);
  editor.open();
  editor.close(true);
  assert.equal(calls.saved, 1);
  assert.deepEqual(calls.flipped, [false]);
  assert.equal(calls.expressed, 1);
  assert.equal(calls.checked, 0);
});

test('the preview is sized from the viewport aspect ratio within fixed bounds', () => {
  const fx = fixture();
  fx.editor.open();
  const preview = fx.created.find(node => node.className === 'dshwv-snappreview');
  // 800x400 is 2:1, too wide for the 210x190 box, so the width caps and the
  // height follows the ratio: 210 x 105.
  assert.equal(preview.style.width, '210px');
  assert.equal(preview.style.height, '105px');
  const grid = fx.created.find(node => node.className === 'dshwv-snapgrid');
  assert.equal(grid.style.gridTemplateColumns, '72px 210px 72px');
  assert.equal(grid.style.gridTemplateRows, '26px 105px 26px');
});

test('a tall viewport is capped by height instead of width', () => {
  const fx = fixture(DEFAULT_CONFIG, { w: 400, h: 800 });
  fx.editor.open();
  const preview = fx.created.find(node => node.className === 'dshwv-snappreview');
  // 400x800 is 0.5:1, so the height caps and the width follows: 95 x 190.
  assert.equal(preview.style.height, '190px');
  assert.equal(preview.style.width, '95px');
});
