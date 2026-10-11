import test from 'node:test';
import assert from 'node:assert/strict';

import { createBubbleColorSelect } from '../desktop/ui/features/widget/bubble-color-select.js';

const SCHEMES = ['macaron', 'candy', 'rouge', 'bamboo', 'aurora', 'deepsea', 'sunset', 'forest',
  'champagne', 'lavender', 'mint', 'lava', 'galaxy', 'ink', 'indigo'];
const NAMES = ['马卡龙', '糖果', '酒红', '翠青', '极光幻彩', '深海蓝调', '落日熔金', '森林秘语',
  '香槟鎏金', '薰衣草梦境', '薄荷汽水', '岩浆熔岩', '银河星紫', '墨韵黑白', '靛蓝夜曲'];

function element(tag = 'div') {
  const node = {
    tagName: tag, className: '', textContent: '', title: '', type: '', value: '', children: [], style: {},
    listeners: {}, _html: '',
    set innerHTML(value) { this._html = value; if (value === '') this.children = []; },
    get innerHTML() { return this._html; },
    classList: {
      set: new Set(),
      add(name) { this.set.add(name); },
      remove(name) { this.set.delete(name); },
      contains(name) { return this.set.has(name); },
    },
    appendChild(child) { this.children.push(child); return child; },
    addEventListener(type, fn) { (this.listeners[type] = this.listeners[type] || []).push(fn); },
    fire(type, event = {}) { for (const fn of this.listeners[type] || []) fn({ stopPropagation() {}, ...event }); },
  };
  return node;
}

function fixture() {
  const created = [];
  const documentStub = {
    createElement(tag) { const node = element(tag); created.push(node); return node; },
    listeners: {},
    addEventListener(type, fn) { (this.listeners[type] = this.listeners[type] || []).push(fn); },
    fire(type, event) { for (const fn of this.listeners[type] || []) fn(event); },
  };
  const calls = { picked: [], opened: [] };
  const select = createBubbleColorSelect({
    document: documentStub,
    qRow: () => element('div'),
    qLabel: text => { const node = element('label'); node.textContent = text; return node; },
    // Mirrors the real caller: opening is delegated here, so this is where the
    // open class is applied. The module only ever takes it off, on pick.
    dshwDropOpen: (menu, head) => { menu.classList.add('dshwv-rgbopen'); calls.opened.push([menu, head]); },
  });
  const menu = () => created.find(candidate => candidate.className === 'dshwv-rgbmenu dshwv-qcolmenu');
  const head = () => created.find(candidate => candidate.className === 'dshwv-rgbhead');
  const swatch = () => created.find(candidate => candidate.className === 'dshwv-qcolorhost');
  return { select, calls, created, menu, head, swatch, documentStub };
}

// build() returns the row and a sync(); it is sync that labels the control and
// renders the swatch. Every caller pairs the two immediately, so the tests do too.
const build = (fx, current, onPick, opts) => {
  const control = fx.select.build(current, onPick || (value => fx.calls.picked.push(value)), opts);
  return { row: control.row, sync: (...args) => control.sync(...args) };
};

test('the menu lists solid and every scheme, ticking the current one', () => {
  const fx = fixture();
  const { row } = build(fx, 'macaron');
  assert.ok(row.children.length >= 2, 'a label and the control');
  const options = fx.menu().children;
  assert.equal(options.length, 16, 'solid plus 15 schemes');
  assert.deepEqual(options.map(option => option.textContent.replace(/^✓ /, '')), ['纯色', ...NAMES]);
  assert.equal(options.filter(option => option.textContent.startsWith('✓ ')).length, 1);
  assert.equal(options[1].textContent, '✓ 马卡龙');
  for (const key of SCHEMES) assert.equal(options.some(option => option.classList.contains('opt-' + key)), true, key);
  assert.equal(options[0].classList.contains('optgrad'), false, 'solid carries no gradient class');
});

test('sync labels the control with the current value', () => {
  const fx = fixture();
  const { sync } = build(fx, 'macaron');
  sync('macaron');
  assert.equal(fx.head().textContent, '马卡龙');
  sync('solid');
  assert.equal(fx.head().textContent, '纯色');
  sync('indigo');
  assert.equal(fx.head().textContent, '靛蓝夜曲');
});

test('an unknown value falls back to solid, or to none when that is allowed', () => {
  const plain = fixture();
  build(plain, 'not-a-scheme').sync('not-a-scheme');
  assert.equal(plain.head().textContent, '纯色');

  const allowNone = fixture();
  build(allowNone, 'not-a-scheme', null, { allowNone: true }).sync('not-a-scheme');
  assert.equal(allowNone.head().textContent, '无');
});

test('allowNone adds the none option ahead of solid', () => {
  const fx = fixture();
  build(fx, 'none', null, { allowNone: true }).sync('none');
  assert.equal(fx.head().textContent, '无');
  assert.equal(fx.menu().children.length, 17);
  assert.equal(fx.menu().children[0].textContent, '✓ 无');
  assert.equal(fx.menu().children[1].textContent, '纯色');
});

test('picking an option reports the scheme key and closes the menu', () => {
  const fx = fixture();
  build(fx, 'solid');
  const aurora = fx.menu().children.find(option => option.textContent.includes('极光幻彩'));
  aurora.fire('click');
  assert.deepEqual(fx.calls.picked, ['aurora']);
  assert.equal(fx.menu().classList.contains('dshwv-rgbopen'), false, 'the menu closes on pick');
});

test('sync swaps the swatch between a colour input and nothing', () => {
  const fx = fixture();
  const { sync } = build(fx, 'solid');
  sync('solid');
  assert.ok(fx.swatch().children.length > 0, 'solid mode renders a colour input');
  sync('deepsea');
  assert.equal(fx.swatch().children.length, 0, 'a scheme mode clears the swatch');
});

test('the colour input and the default button both report through the sync callback', () => {
  const fx = fixture();
  const sets = [];
  const { sync } = build(fx, 'solid');
  sync('solid', '#123456', value => sets.push(value));
  const input = fx.swatch().children.find(node => node.type === 'color');
  assert.equal(input.value, '#123456');
  input.value = '#abcdef';
  input.fire('input');
  assert.deepEqual(sets, ['#abcdef']);
  fx.swatch().children.find(node => node.className === 'dshwv-bubmini').fire('click');
  assert.deepEqual(sets, ['#abcdef', '#203170'], 'the reset button restores the default hex');
});

test('opening the menu is delegated to the caller, and a second click closes it', () => {
  const fx = fixture();
  build(fx, 'solid');
  fx.head().fire('click');
  assert.equal(fx.calls.opened.length, 1, 'the module asks the caller to place the menu');
  assert.equal(fx.calls.opened[0][0], fx.menu());
  assert.equal(fx.calls.opened[0][1], fx.head());
  assert.equal(fx.menu().classList.contains('dshwv-rgbopen'), true);
  fx.head().fire('click');
  assert.equal(fx.menu().classList.contains('dshwv-rgbopen'), false, 'a second click closes it');
  assert.equal(fx.calls.opened.length, 1, 'and does not re-open');
});

test('a pointer away from the control closes an open menu', () => {
  const fx = fixture();
  build(fx, 'solid');
  fx.head().fire('click');
  fx.documentStub.fire('pointerdown', { target: { closest: () => null } });
  assert.equal(fx.menu().classList.contains('dshwv-rgbopen'), false);
});

test('the document-level dismiss handler is installed once, not once per picker', () => {
  const fx = fixture();
  build(fx, 'solid');
  build(fx, 'macaron');
  build(fx, 'indigo');
  assert.equal(fx.documentStub.listeners.pointerdown.length, 1);
});
