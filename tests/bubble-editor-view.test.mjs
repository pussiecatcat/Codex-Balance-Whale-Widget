import test from 'node:test';
import assert from 'node:assert/strict';

import { createBubbleEditorView } from '../desktop/ui/features/widget/bubble-editor-view.js';

function element(tag = 'div') {
  const node = {
    tagName: tag, className: '', textContent: '', title: '', type: '', draggable: false, value: '',
    style: {}, children: [], listeners: {}, attributes: {}, _html: '',
    set innerHTML(value) { this._html = value; if (value === '') this.children = []; },
    get innerHTML() { return this._html; },
    appendChild(child) { this.children.push(child); return child; },
    setAttribute(name, value) { this.attributes[name] = value; },
    getBoundingClientRect() { return { width: 200, height: 40, left: 0, top: 0, right: 200, bottom: 40 }; },
    addEventListener(type, fn) { (this.listeners[type] = this.listeners[type] || []).push(fn); },
    fire(type, event = {}) { for (const fn of this.listeners[type] || []) fn({ stopPropagation() {}, preventDefault() {}, dataTransfer: { setData() {} }, ...event }); },
  };
  return node;
}

// Real bubble-editor-commands are used, so the draft mutations are the same ones
// the app performs; the view's own contract is what the assertions pin.
function fixture(initialItems) {
  const items = JSON.parse(JSON.stringify(initialItems));
  const created = [];
  const documentStub = { createElement(tag) { const node = element(tag); created.push(node); return node; } };
  const firstChip = element();
  const moreList = element();
  const calls = { opened: [], confirmed: [] };
  const view = createBubbleEditorView({
    document: documentStub,
    getItems: () => items,
    getFirstChip: () => firstChip,
    getMoreList: () => moreList,
    openItem: (index, side) => calls.opened.push([index, side]),
    confirm: (message, run) => calls.confirmed.push({ message, run }),
  });
  return { view, items: () => items, firstChip, moreList, calls, created };
}

const chipIn = row => row.children.find(child => /dshwv-bubchip/.test(child.className));
const delIn = row => row.children.find(child => child.className === 'dshwv-bubmini');
const choiceChipsIn = row => {
  const wrap = row.children.find(child => child.className === 'dshwv-choicerow');
  return wrap ? wrap.children.flatMap(group => group.children.filter(child => /dshwv-choicechip/.test(child.className))) : [];
};
const custom = text => ({ kind: 'custom', modules: [{ type: 'text', text }] });
const choice = () => ({ kind: 'choice', options: [{ item: custom('A'), w: 1 }, { item: custom('B'), w: 1 }] });

test('the first chip describes the first step, defaulting when the draft is empty', () => {
  const filled = fixture([custom('首泡'), custom('次泡')]);
  filled.view.renderFirst();
  assert.equal(filled.firstChip.textContent, '首次点击 · 编辑内容');
  assert.match(filled.firstChip.title, /^点击编辑该泡泡的内容模块\(.+\)$/);

  const empty = fixture([]);
  empty.view.renderFirst();
  assert.match(empty.firstChip.title, /^点击编辑该泡泡的内容模块\(.+\)$/);
});

test('the list renders one editable row per step after the first', () => {
  const fx = fixture([{ kind: 'normal' }, custom('二'), custom('三')]);
  fx.view.renderMore();
  assert.equal(fx.moreList.children.length, 2);
  const rows = fx.moreList.children;
  assert.equal(chipIn(rows[0]).textContent, '第2次点击 · 编辑内容');
  assert.equal(chipIn(rows[1]).textContent, '第3次点击 · 编辑内容');
  assert.deepEqual(rows.map(row => row.attributes['data-i']), ['1', '2']);
});

test('clicking a row chip opens that step and pressing its ✕ deletes it', () => {
  const fx = fixture([{ kind: 'normal' }, custom('二'), custom('三')]);
  fx.view.renderMore();
  chipIn(fx.moreList.children[0]).fire('click');
  assert.deepEqual(fx.calls.opened, [[1, -1]]);

  delIn(fx.moreList.children[0]).fire('click');
  assert.deepEqual(fx.items().map(step => step.modules?.[0]?.text), [undefined, '三']);
  assert.equal(fx.moreList.children.length, 1, 'the list re-rendered after the delete');
});

test('adding appends a custom step and re-renders', () => {
  const fx = fixture([{ kind: 'normal' }]);
  fx.view.renderMore();
  assert.equal(fx.moreList.children.length, 0);
  fx.view.add();
  assert.equal(fx.items().length, 2);
  assert.deepEqual(fx.items()[1], { kind: 'custom', modules: [] });
  assert.equal(fx.moreList.children.length, 1);
});

test('a delete the command rejects leaves the draft and the list alone', () => {
  const fx = fixture([{ kind: 'normal' }, custom('二')]);
  fx.view.renderMore();
  const before = JSON.stringify(fx.items());
  fx.view.delete(0);
  assert.equal(JSON.stringify(fx.items()), before, 'the first bubble cannot be deleted');
  assert.equal(fx.moreList.children.length, 1, 'nothing re-rendered');
});

test('deleting the last remaining step is refused rather than emptying the draft', () => {
  const fx = fixture([{ kind: 'normal' }]);
  fx.view.delete(1);
  assert.equal(fx.items().length, 1);
});

test('moving swaps neighbours and re-renders', () => {
  const fx = fixture([{ kind: 'normal' }, custom('二'), custom('三')]);
  fx.view.renderMore();
  fx.view.move(1, 1);
  assert.deepEqual(fx.items().map(step => step.modules?.[0]?.text), [undefined, '三', '二']);
  assert.equal(fx.moreList.children.length, 2);
});

test('a move off the end is refused', () => {
  const fx = fixture([{ kind: 'normal' }, custom('二'), custom('三')]);
  fx.view.move(2, 1);
  assert.deepEqual(fx.items().map(step => step.modules?.[0]?.text), [undefined, '二', '三']);
});

test('a choice step renders an A/B chip pair that opens the matching side', () => {
  const fx = fixture([{ kind: 'normal' }, choice()]);
  fx.view.renderMore();
  const chips = choiceChipsIn(fx.moreList.children[0]);
  assert.equal(chips.length, 2);
  assert.equal(chips[0].textContent, 'A · 编辑内容');
  chips[1].fire('click');
  assert.deepEqual(fx.calls.opened, [[1, 1]]);
});

test('dropping with nothing dragged changes neither the draft nor the list', () => {
  const fx = fixture([{ kind: 'normal' }, custom('二')]);
  fx.view.renderMore();
  const before = JSON.stringify(fx.items());
  fx.view.dropToEnd();
  assert.equal(JSON.stringify(fx.items()), before);
  const row = fx.moreList.children[0];
  row.fire('drop');
  assert.equal(JSON.stringify(fx.items()), before);
});

test('an empty draft renders an empty list without throwing', () => {
  const fx = fixture([]);
  fx.view.renderMore();
  assert.equal(fx.moreList.children.length, 0);
});
