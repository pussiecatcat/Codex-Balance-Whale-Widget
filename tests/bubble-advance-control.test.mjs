import test from 'node:test';
import assert from 'node:assert/strict';

import { createBubbleAdvanceControl } from '../desktop/ui/features/widget/bubble-advance-control.js';

function element(tag = 'div') {
  return {
    tagName: tag, className: '', id: '', title: '', type: '', textContent: '', innerHTML: '', checked: false,
    style: {}, children: [], listeners: {}, attributes: {}, offsetHeight: 112,
    appendChild(child) { this.children.push(child); return child; },
    setAttribute(name, value) { this.attributes[name] = String(value); },
    addEventListener(type, listener) { (this.listeners[type] = this.listeners[type] || []).push(listener); },
    fire(type, event = {}) {
      for (const listener of this.listeners[type] || []) listener({ target: this, stopPropagation() {}, ...event });
    },
    contains(node) { return this === node || this.children.includes(node); },
    getBoundingClientRect() { return { left: 150, top: 200, right: 168, bottom: 218, width: 18, height: 18 }; },
  };
}

function fixture(area = { w: 800, h: 600 }) {
  const created = [], changes = [];
  const documentStub = {
    body: element('body'), activeElement: null, listeners: {},
    createElement(tag) { const node = element(tag); created.push(node); return node; },
    addEventListener(type, listener) { (this.listeners[type] = this.listeners[type] || []).push(listener); },
    fire(type, event = {}) { for (const listener of this.listeners[type] || []) listener(event); },
  };
  const control = createBubbleAdvanceControl({
    document: documentStub,
    viewport: () => area,
    onChange: value => changes.push(value),
  });
  return { control, documentStub, created, changes };
}

test('the control exposes a labelled persisted checkbox', () => {
  const fx = fixture();
  assert.match(fx.control.element.className, /dshwv-bubadvance/);
  assert.equal(fx.control.input.checked, false);
  assert.equal(fx.control.element.children[0].children[1].textContent, '点按角色推进泡泡队列');
  fx.control.setValue(true);
  assert.equal(fx.control.getValue(), true);
  fx.control.input.checked = false;
  fx.control.input.fire('change');
  assert.deepEqual(fx.changes, [false]);
});

test('hovering the question button opens the full queue explanation beside it', () => {
  const fx = fixture();
  fx.control.helpButton.fire('mouseenter');
  assert.equal(fx.control.popover.style.display, 'block');
  assert.equal(fx.control.popover.style.left, '150px');
  assert.equal(fx.control.popover.style.top, '226px');
  assert.equal(fx.control.helpButton.attributes['aria-expanded'], 'true');
  assert.match(fx.control.popover.innerHTML, /关闭（默认）/);
  assert.match(fx.control.popover.innerHTML, /点一下角色 = 往后推进一项/);
  assert.equal(fx.documentStub.body.children.includes(fx.control.popover), true);
});

test('the help bubble stays inside a narrow viewport and flips above the anchor', () => {
  const fx = fixture({ w: 260, h: 260 });
  fx.control.helpButton.getBoundingClientRect = () => ({ left: 240, top: 230, right: 258, bottom: 248, width: 18, height: 18 });
  fx.control.showHelp();
  assert.equal(fx.control.popover.style.width, '244px');
  assert.equal(fx.control.popover.style.left, '8px');
  assert.equal(fx.control.popover.style.top, '110px');
});

test('Escape and an outside press close the help bubble', () => {
  const fx = fixture();
  fx.control.showHelp();
  fx.documentStub.fire('keydown', { key: 'Escape' });
  assert.equal(fx.control.popover.style.display, 'none');
  assert.equal(fx.control.helpButton.attributes['aria-expanded'], 'false');
  fx.control.showHelp();
  fx.documentStub.fire('pointerdown', { target: element('div') });
  assert.equal(fx.control.popover.style.display, 'none');
});

test('clicking the question button pins the help bubble and a second click closes it', () => {
  const fx = fixture();
  fx.control.helpButton.fire('click');
  assert.equal(fx.control.popover.style.display, 'block');
  fx.control.helpButton.fire('click');
  assert.equal(fx.control.popover.style.display, 'none');
});
