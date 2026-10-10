import test from 'node:test';
import assert from 'node:assert/strict';

import { createBubbleQuickEditors } from '../desktop/ui/features/widget/bubble-quick-editors.js';

function element(tag = 'div') {
  const node = {
    tagName: tag, className: '', textContent: '', title: '', type: '', value: '', placeholder: '',
    maxLength: 0, draggable: false, style: {}, children: [], listeners: {}, _html: '',
    set innerHTML(value) { this._html = value; if (value === '') this.children = []; },
    get innerHTML() { return this._html; },
    appendChild(child) { this.children.push(child); return child; },
    setAttribute() {}, removeAttribute() {},
    addEventListener(type, fn) { (this.listeners[type] = this.listeners[type] || []).push(fn); },
    fire(type, event = {}) { for (const fn of this.listeners[type] || []) fn({ stopPropagation() {}, preventDefault() {}, target: this, ...event }); },
    getBoundingClientRect() { return { width: 120, height: 24, left: 0, top: 0, right: 120, bottom: 24 }; },
    querySelectorAll() { return []; },
    focus() {}, sync() {}, refresh() {}, destroy() {},
  };
  return node;
}

function fixture() {
  const created = [];
  const documentStub = {
    createElement(tag) { const node = element(tag); created.push(node); return node; },
    createTextNode(text) { const node = element('#text'); node.textContent = text; created.push(node); return node; },
    addEventListener() {}, removeEventListener() {},
  };
  const box = element();
  const calls = { closed: 0, rendered: 0, placed: [], helped: [] };
  const editors = createBubbleQuickEditors({
    document: documentStub, window: {},
    qeditClose: () => { calls.closed++; },
    qeditEnsure: () => box,
    qRow: () => element('div'),
    qLabel: text => { const node = element('label'); node.textContent = text; return node; },
    bubbleFontEditRow: () => element('div'),
    qColorSelectBuild: () => element('div'),
    renderBubblePv: () => { calls.rendered++; },
    qeditPlace: (row, offset, flag) => calls.placed.push([offset, flag]),
    getPreviewElement: () => element('div'),
    bubbleTplHelpToggle: (...args) => calls.helped.push(args),
  });
  const inputs = () => created.filter(node => node.tagName === 'input');
  return { editors, calls, box, created, inputs };
}

const lastInputWithClass = (fx, className) => [...fx.inputs()].reverse().find(node => node.className === className);
const byClass = (fx, className) => fx.created.filter(node => node.className === className);

test('the text editor refuses anything that is not text or a link', () => {
  const fx = fixture();
  fx.editors.openText(null);
  fx.editors.openText({ type: 'balance', size: 11 });
  assert.equal(fx.calls.closed, 0, 'no editor was closed for a step it does not own');
  assert.equal(fx.box.innerHTML, '', 'the box was never touched');
});

test('the text editor types straight into the step, with a space for an empty field', () => {
  const fx = fixture();
  const step = { type: 'text', text: '原名' };
  fx.editors.openText(step);
  assert.equal(fx.calls.closed, 1, 'any open editor closes first');
  const content = lastInputWithClass(fx, 'dshwv-qedit-content');
  assert.equal(content.value, '原名');
  assert.equal(content.maxLength, 60);

  content.value = '新名';
  content.fire('input');
  assert.equal(step.text, '新名');
  assert.equal(fx.calls.rendered, 1, 'the preview follows the typing');

  // Clearing the field stores a single space rather than an empty string, which
  // is what keeps the module rendered instead of collapsing.
  content.value = '';
  content.fire('input');
  assert.equal(step.text, ' ');
});

test('a link step gets its own URL field; a text step does not', () => {
  const link = fixture();
  const step = { type: 'link', text: '打开', url: 'https://example.test/' };
  link.editors.openText(step);
  const fields = link.inputs().filter(node => node.className === 'dshwv-qedit-content');
  assert.equal(fields.length, 2, 'text and URL');
  assert.equal(fields[1].value, 'https://example.test/');
  fields[1].value = 'https://other.test/';
  fields[1].fire('input');
  assert.equal(step.url, 'https://other.test/');

  const plain = fixture();
  plain.editors.openText({ type: 'text', text: '只有文字' });
  assert.equal(plain.inputs().filter(node => node.className === 'dshwv-qedit-content').length, 1);
});

test('the module editor owns the data modules and refuses the ones it does not', () => {
  const fx = fixture();
  for (const type of ['image', 'random', 'text']) fx.editors.openModule({ type });
  assert.equal(fx.calls.closed, 0);

  fx.editors.openModule({ type: 'balance', size: 11, tpl: '{balance_api}' });
  assert.equal(fx.calls.closed, 1);
  assert.ok(fx.box.children.length > 0);
});

test('the placeholder field is seeded from the module and types straight into it', () => {
  const fx = fixture();
  const step = { type: 'balance', size: 11, tpl: '{balance_api}' };
  fx.editors.openModule(step);
  const field = lastInputWithClass(fx, 'dshwv-qedit-content');
  assert.equal(field.value, '{balance_api}');
  assert.equal(field.placeholder, '例: {balance_api}');

  field.value = '{balance_api} · {quota_left_round}';
  field.fire('input');
  assert.equal(step.tpl, '{balance_api} · {quota_left_round}');
  assert.equal(fx.calls.rendered, 1);
});

// The help button is the module side of the deferred wiring fixed earlier: it
// hands the caller its own element, which is why the dependency must resolve
// bubbleTplHelpToggle at click time rather than at construction.
test('the placeholder help button hands the caller the module and its own element', () => {
  const fx = fixture();
  const step = { type: 'balance', size: 11, tpl: '{balance_api}' };
  fx.editors.openModule(step);
  const help = byClass(fx, 'dshwv-tplq');
  assert.equal(help.length, 1, 'exactly one help button per editor');
  assert.equal(help[0].textContent, '?');
  assert.equal(help[0].title, '可用占位符用法');
  help[0].fire('click');
  assert.deepEqual(fx.calls.helped, [[step, help[0]]]);
});

test('the editor clears whatever the previous one left in the box', () => {
  const fx = fixture();
  const stale = element('div');
  fx.box.children.push(stale);
  fx.editors.openText({ type: 'text', text: 'x' });
  assert.equal(fx.box.children.includes(stale), false, 'the previous controls are gone');
  assert.ok(fx.box.children.length > 0, 'and the new ones are in their place');
});
