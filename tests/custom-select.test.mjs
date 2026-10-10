import test from 'node:test';
import assert from 'node:assert/strict';

import { createCustomSelectController } from '../desktop/ui/features/widget/custom-select.js';

function element(tag = 'div') {
  const node = {
    tagName: tag, className: '', textContent: '', title: '', type: '', value: '', disabled: false,
    style: {}, children: [], parentNode: null, listeners: {}, attributes: {}, _html: '',
    set innerHTML(value) { this._html = value; if (value === '') this.children = []; },
    get innerHTML() { return this._html; },
    classList: {
      set: new Set(),
      add(name) { this.set.add(name); },
      remove(name) { this.set.delete(name); },
      contains(name) { return this.set.has(name); },
    },
    appendChild(child) { this.children.push(child); child.parentNode = this; return child; },
    removeChild(child) { this.children = this.children.filter(item => item !== child); child.parentNode = null; return child; },
    insertBefore(child, before) { const at = this.children.indexOf(before); this.children.splice(at < 0 ? 0 : at, 0, child); child.parentNode = this; return child; },
    setAttribute(name, value) { this.attributes[name] = value; },
    contains(target) { return target === this || this.children.includes(target); },
    addEventListener(type, fn) { (this.listeners[type] = this.listeners[type] || []).push(fn); },
    fire(type, event = {}) { for (const fn of this.listeners[type] || []) fn({ preventDefault() {}, stopPropagation() {}, target: this, ...event }); },
  };
  return node;
}

function select(options, { value, disabled = false, parent } = {}) {
  const node = element('select');
  node.options = options.map(option => ({ value: option.value, textContent: option.label, disabled: !!option.disabled }));
  const initial = value === undefined ? node.options[0]?.value : value;
  let index = Math.max(0, node.options.findIndex(option => option.value === initial));
  node.value = node.options[index]?.value ?? initial;
  // A real <select> keeps the two in step: the module moves selectedIndex and
  // reads value, so a stub treating them as unrelated fields hides the logic.
  Object.defineProperty(node, 'selectedIndex', {
    get: () => index,
    set: (next) => { index = next; node.value = node.options[next]?.value ?? ''; },
  });
  node.disabled = disabled;
  node.dispatchCount = 0;
  node.dispatchEvent = () => { node.dispatchCount++; };
  if (parent) parent.appendChild(node);
  return node;
}

function fixture() {
  const created = [];
  const documentStub = {
    body: element('body'),
    createElement(tag) { const node = element(tag); created.push(node); return node; },
    listeners: {},
    addEventListener(type, fn) { (this.listeners[type] = this.listeners[type] || []).push(fn); },
    fire(type, event) { for (const fn of this.listeners[type] || []) fn(event); },
  };
  const windowStub = { listeners: {}, addEventListener(type, fn) { (this.listeners[type] = this.listeners[type] || []).push(fn); }, fire(type) { for (const fn of this.listeners[type] || []) fn(); } };
  const calls = { drops: [] };
  let clock = 1000;
  const controller = createCustomSelectController({
    document: documentStub, window: windowStub,
    dropOpen: (menu, btn) => calls.drops.push([menu, btn]),
    makeNameCell: (className, text) => { const node = element('span'); node.className = className; node.textContent = text; return node; },
    bindNameMarquee: () => {},
    now: () => clock,
  });
  const byClass = className => created.filter(node => node.className === className);
  const btn = () => byClass('dshwv-custbtn').pop();
  const menu = () => byClass('dshwv-rgbmenu dshwv-custmenu').pop();
  const open = () => { btn().fire('click'); };
  return { controller, documentStub, windowStub, created, calls, byClass, btn, menu, open, setClock: value => { clock = value; } };
}

test('enhancing a select wraps it, hides it, and is idempotent', () => {
  const fx = fixture();
  const parent = element('div');
  const sel = select([{ value: 'usd', label: '美元' }, { value: 'cny', label: '人民币' }], { parent });
  const drop = fx.controller.enhance(sel, { allowNone: false });
  // enhance() calls sync() itself, so the label is right from the first paint.
  assert.deepEqual(Object.keys(drop).sort(), ['button', 'close', 'menu', 'refresh', 'sync']);
  assert.equal(drop.button, fx.btn());
  assert.equal(fx.byClass('dshwv-custlab')[0].textContent, '美元');
  const wrap = fx.byClass('dshwv-custwrap')[0];
  assert.equal(parent.children.includes(wrap), true, 'the wrapper replaces the select in place');
  assert.equal(wrap.children.includes(sel), true, 'the real select stays inside, hidden');
  assert.equal(sel.style.display, 'none');
  assert.equal(fx.controller.enhance(sel), drop, 'enhancing twice returns the same controller');
});

test('a select with no parent, or none at all, gets a no-op controller', () => {
  const fx = fixture();
  const orphan = select([{ value: 'a', label: 'A' }]);
  const drop = fx.controller.enhance(orphan, {});
  assert.equal(typeof drop.sync, 'function');
  drop.sync(); drop.refresh();
  assert.equal(orphan.__dshwCust, undefined, 'an orphan is left untouched');

  const none = fx.controller.enhance(null, {});
  assert.equal(typeof none.refresh, 'function');
  assert.equal(fx.created.length, 0, 'nothing was built');
});

test('sync labels the button from the current option and mirrors the disabled state', () => {
  const fx = fixture();
  const parent = element('div');
  const sel = select([{ value: 'usd', label: '美元' }, { value: 'cny', label: '人民币' }], { value: 'cny', parent });
  fx.controller.enhance(sel, {});
  fx.controller.sync(sel);
  const label = fx.byClass('dshwv-custlab')[0];
  assert.equal(label.textContent, '人民币');

  sel.value = 'usd';
  fx.controller.sync(sel);
  assert.equal(label.textContent, '美元');

  sel.value = 'gone';
  fx.controller.sync(sel);
  assert.equal(label.textContent, '—', 'an unknown value shows a dash rather than an empty button');

  sel.disabled = true;
  fx.controller.sync(sel);
  assert.equal(fx.btn().disabled, true);
});

test('the menu lists every option, marks the current one, and skips disabled ones on pick', () => {
  const fx = fixture();
  const parent = element('div');
  const sel = select([{ value: 'a', label: 'A' }, { value: 'b', label: 'B', disabled: true }, { value: 'c', label: 'C' }], { parent });
  fx.controller.enhance(sel, {});
  fx.open();
  const items = fx.menu().children;
  assert.equal(items.length, 3);
  assert.equal(items[0].attributes['aria-selected'], 'true');
  assert.equal(items[2].classList.contains('dshwv-rgbcur'), false);
  assert.equal(items[1].classList.contains('dshwv-custdisabled'), true);

  items[1].fire('click');
  assert.equal(sel.value, 'a', 'a disabled option is ignored');
  assert.equal(sel.dispatchCount, 0);

  items[2].fire('click');
  assert.equal(sel.value, 'c');
  assert.equal(sel.dispatchCount, 1, 'picking dispatches a change so the app reacts');
  assert.equal(fx.byClass('dshwv-custlab')[0].textContent, 'C');
});

test('arrow keys walk the options, skip disabled ones and wrap around', () => {
  const fx = fixture();
  const parent = element('div');
  const sel = select([{ value: 'a', label: 'A' }, { value: 'b', label: 'B', disabled: true }, { value: 'c', label: 'C' }], { parent });
  fx.controller.enhance(sel, {});
  const button = fx.btn();
  button.fire('keydown', { key: 'ArrowDown' });
  assert.equal(sel.value, 'c', 'the disabled B is skipped');
  button.fire('keydown', { key: 'ArrowDown' });
  assert.equal(sel.value, 'a', 'and it wraps back to the top');
  button.fire('keydown', { key: 'ArrowUp' });
  assert.equal(sel.value, 'c', 'up wraps the other way');
  assert.equal(sel.dispatchCount, 3, 'each move dispatches a change');
  button.fire('keydown', { key: 'Enter' });
  assert.equal(sel.dispatchCount, 3, 'other keys are left alone');
});

test('a select whose options are all disabled does not spin forever', () => {
  const fx = fixture();
  const parent = element('div');
  const sel = select([{ value: 'a', label: 'A', disabled: true }], { parent });
  fx.controller.enhance(sel, {});
  fx.btn().fire('keydown', { key: 'ArrowDown' });
  assert.equal(sel.dispatchCount, 0);
});

test('closing takes the menu out of the body and resets the button state', () => {
  const fx = fixture();
  const parent = element('div');
  const sel = select([{ value: 'a', label: 'A' }], { parent });
  fx.controller.enhance(sel, {});
  fx.open();
  const menu = fx.menu();
  assert.equal(fx.documentStub.body.children.includes(menu), true, 'opening attaches the menu to the body');
  assert.equal(fx.btn().attributes['aria-expanded'], 'true');
  fx.documentStub.listeners.pointerdown[0]({ target: element('div') });
  assert.equal(fx.documentStub.body.children.includes(menu), false);
  assert.equal(fx.btn().attributes['aria-expanded'], 'false');
});

test('closing when nothing is open is a no-op', () => {
  const fx = fixture();
  assert.doesNotThrow(() => fx.controller.close());
  assert.equal(fx.controller.sync(null), undefined);
  assert.equal(fx.controller.refresh({}), undefined, 'a select without a controller is left alone');
});

test('Escape and a window resize both close the popup', () => {
  const fx = fixture();
  const parent = element('div');
  const sel = select([{ value: 'a', label: 'A' }], { parent });
  fx.controller.enhance(sel, {});
  fx.open();
  assert.equal(fx.documentStub.body.children.length, 1, 'the popup is up');
  assert.equal(fx.documentStub.listeners.keydown.length, 1);
  assert.equal(fx.windowStub.listeners.resize.length, 1);
  fx.documentStub.listeners.keydown[0]({ key: 'Escape' });
  fx.windowStub.fire('resize');
  assert.equal(fx.documentStub.body.children.length, 0, 'nothing is left attached');
});

test('the document listeners are bound once no matter how many selects are enhanced', () => {
  const fx = fixture();
  for (let index = 0; index < 3; index++) {
    const parent = element('div');
    fx.controller.enhance(select([{ value: 'a', label: 'A' }], { parent }), {});
  }
  assert.equal(fx.documentStub.listeners.pointerdown.length, 1);
  assert.equal(fx.documentStub.listeners.keydown.length, 1);
  assert.equal(fx.windowStub.listeners.resize.length, 1);
});
