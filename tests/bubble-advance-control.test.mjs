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
    onChange: value => changes.push(value),
  });
  return { control, documentStub, created, changes };
}

test('the control exposes a labelled persisted checkbox', () => {
  const fx = fixture();
  assert.match(fx.control.element.className, /dshwv-bubadvance/);
  assert.equal(fx.control.input.checked, false);
    fx.control.setValue(true);
  assert.equal(fx.control.getValue(), true);
  fx.control.input.checked = false;
  fx.control.input.fire('change');
  assert.deepEqual(fx.changes, [false]);
});

test('the rule stays visible without a popover', () => {
  const fx = fixture();
  const text = fx.control.element.children[0].children[1];
  assert.equal(text.children[0].textContent, '点角色也能翻到下一条');
  assert.match(text.children[1].textContent, /点角色回到第 1 条/);
  assert.equal(fx.control.element.children.length, 1);
  assert.equal(fx.documentStub.body.children.length, 0);
});
