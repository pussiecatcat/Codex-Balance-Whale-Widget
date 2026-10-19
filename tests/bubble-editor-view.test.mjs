import test from 'node:test';
import assert from 'node:assert/strict';

import { bubbleDropZone, createBubbleEditorView } from '../desktop/ui/features/widget/bubble-editor-view.js';
import { loadBubbleEditorDraft, saveBubbleEditorDraft } from '../desktop/ui/features/widget/bubble-editor-model.js';

function element(tag = 'div') {
  const node = {
    tagName: tag, className: '', textContent: '', title: '', type: '', draggable: false, value: '',
    style: {}, children: [], listeners: {}, attributes: {}, _html: '', _bounds: null,
    set innerHTML(value) { this._html = value; if (value === '') this.children = []; },
    get innerHTML() { return this._html; },
    appendChild(child) { this.children.push(child); return child; },
    focus() { this.focused = true; },
    select() { this.selected = true; },
    setAttribute(name, value) { this.attributes[name] = value; },
    getAttribute(name) { return this.attributes[name] ?? null; },
    removeAttribute(name) { delete this.attributes[name]; },
    querySelector(selector) {
      const name = String(selector).replace(/^\./, '');
      return this.children.find(child => String(child.className || '').split(/\s+/).includes(name)) || null;
    },
    getBoundingClientRect() { return this._bounds || { width: 200, height: 40, left: 0, top: 0, right: 200, bottom: 40 }; },
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
  const body = element('body');
  const documentStub = { body, createElement(tag) { const node = element(tag); created.push(node); return node; } };
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
  return { view, items: () => items, firstChip, moreList, calls, created, body };
}

const chipIn = row => row.children.find(child => /dshwv-bubchip/.test(child.className));
const delIn = row => row.children.find(child => child.className === 'dshwv-bubmini');
const handleIn = row => row.children.find(child => String(child.className).split(/\s+/).includes('dshwv-bubdrag'));
const choiceChipsIn = row => {
  const wrap = row.children.find(child => child.className === 'dshwv-choicerow');
  return wrap ? wrap.children.flatMap(group => group.children.filter(child => /dshwv-choicechip/.test(child.className))) : [];
};
const choiceGroupsIn = row => {
  const wrap = row.children.find(child => child.className === 'dshwv-choicerow');
  return wrap ? wrap.children.filter(child => child.className === 'dshwv-choicegrp') : [];
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

test('a normal bubble can start dragging from the roomy row as well as its accessible handle', () => {
  const fx = pairedDropFixture();
  const [source, target] = fx.moreList.children;
  const handle = handleIn(source);
  assert.equal(source.draggable, true);
  assert.equal(chipIn(source).draggable, true);
  assert.equal(handle.draggable, true);
  assert.equal(handle.tagName, 'button');
  assert.equal(handle.attributes.role, 'button');
  assert.equal(handle.attributes['aria-label'], '拖动第2次点击泡泡');

  source.fire('dragstart');
  target.fire('dragover', { clientX: 70, clientY: 20 });
  assert.equal(target.attributes['data-drop-zone'], 'pairL', 'the whole row is an easy drag target');
  source.fire('dragend');

  chipIn(source).fire('dragstart');
  target.fire('dragover', { clientX: 140, clientY: 20 });
  assert.equal(target.attributes['data-drop-zone'], 'pairR', 'the whole edit chip is also an easy merge target');
  chipIn(source).fire('dragend');

  handle.fire('dragstart');
  target.fire('dragover', { clientX: 70, clientY: 20 });
  assert.equal(target.attributes['data-drop-zone'], 'pairL');
  handle.fire('dragend');
  assert.equal(target.attributes['data-drop-zone'], undefined);
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

test('editing both A/B weights updates the matching option and survives save plus reload', () => {
  const fx = fixture([{ kind: 'normal' }, choice()]);
  fx.view.renderMore();
  const groups = choiceGroupsIn(fx.moreList.children[0]);
  const weights = groups.map(group => group.children.find(child => /dshwv-winput/.test(child.className)));
  const weight = weights[0];

  weight.fire('focus');
  assert.equal(weight.selected, true, 'the old value is selected for one-step replacement');
  weight.value = '10';
  weight.fire('input');
  assert.equal(fx.items()[1].options[0].w, 10, 'typing updates the draft before blur');

  weights[1].value = '9';
  weights[1].fire('input');
  assert.equal(fx.items()[1].options[1].w, 9, 'editing B updates B rather than the A option');

  weight.value = '9x9';
  weight.fire('input');
  assert.equal(weight.value, '99', 'non-digits are removed without waiting for blur');
  assert.equal(fx.items()[1].options[0].w, 99);

  weight.value = '10';
  weight.fire('input');

  const saved = saveBubbleEditorDraft(fx.items(), [], {}, false, false);
  const reopened = loadBubbleEditorDraft(saved, false);
  assert.deepEqual(reopened.items[1].options.map(option => option.w), [10, 9]);

  weight.value = '';
  weight.fire('input');
  assert.equal(fx.items()[1].options[0].w, 10, 'clearing is allowed while replacing the value');
  weight.fire('blur');
  assert.equal(weight.value, '1', 'an empty field normalizes only when editing finishes');
  assert.equal(fx.items()[1].options[0].w, 1);
});

test('A/B edit buttons stay buttons, drag from the whole chip, and retain keyboard side handles', () => {
  const fx = fixture([{ kind: 'normal' }, choice(), custom('三')]);
  fx.view.renderMore();
  const [choiceRow, target] = fx.moreList.children;
  const groups = choiceGroupsIn(choiceRow);
  const chips = choiceChipsIn(choiceRow);
  const sideHandles = groups.map(group => group.children.find(child =>
    String(child.className).split(/\s+/).includes('dshwv-choice-drag')));

  assert.deepEqual(chips.map(chip => chip.draggable), [true, true]);
  assert.deepEqual(sideHandles.map(handle => handle.draggable), [true, true]);
  assert.deepEqual(sideHandles.map(handle => handle.tagName), ['button', 'button']);
  assert.deepEqual(sideHandles.map(handle => handle.attributes['aria-label']), ['拖动 A 泡泡', '拖动 B 泡泡']);
  assert.ok(sideHandles.every(handle => handle.attributes.role === 'button'));

  chips[0].fire('dragstart');
  target.fire('dragover', { clientX: 70, clientY: 5 });
  assert.equal(target.attributes['data-drop-label'], '排到前面', 'the full A/B chip is an easy drag target');
  chips[0].fire('dragend');

  sideHandles[0].fire('dragstart');
  target.fire('dragover', { clientX: 70, clientY: 5 });
  assert.equal(target.attributes['data-drop-label'], '排到前面');
  target.fire('drop', { clientX: 70, clientY: 5 });
  assert.deepEqual(fx.items().map(step => step.modules?.[0]?.text), [undefined, 'B', 'A', '三']);
});

test('keyboard drag mode reorders a row, restores focus, and announces the result', () => {
  const fx = fixture([{ kind: 'normal' }, custom('二'), custom('三')]);
  fx.view.renderMore();
  const firstHandle = handleIn(fx.moreList.children[0]);
  const live = fx.created.find(node => node.className === 'dshwv-sr-only');

  firstHandle.fire('click');
  assert.equal(firstHandle.attributes['aria-pressed'], 'true');
  firstHandle.fire('keydown', { key: 'ArrowDown' });
  assert.equal(fx.moreList.children[1].attributes['data-drop-label'], '排到后面');
  firstHandle.fire('keydown', { key: 'Enter' });

  assert.deepEqual(fx.items().map(step => step.modules?.[0]?.text), [undefined, '三', '二']);
  assert.equal(handleIn(fx.moreList.children[1]).focused, true);
  assert.match(live.textContent, /已移动/);
});

test('keyboard drag mode can choose A/B pairing and can be cancelled', () => {
  const fx = fixture([{ kind: 'normal' }, custom('二'), custom('三')]);
  fx.view.renderMore();
  const firstHandle = handleIn(fx.moreList.children[0]);

  firstHandle.fire('click');
  firstHandle.fire('keydown', { key: 'ArrowDown' });
  firstHandle.fire('keydown', { key: 'ArrowRight' });
  assert.equal(fx.moreList.children[1].attributes['data-drop-label'], '放到 B');
  firstHandle.fire('keydown', { key: 'Escape' });
  assert.deepEqual(fx.items().map(step => step.kind), ['normal', 'custom', 'custom']);
  assert.equal(firstHandle.attributes['aria-pressed'], 'false');

  firstHandle.fire('click');
  firstHandle.fire('keydown', { key: 'ArrowDown' });
  firstHandle.fire('keydown', { key: 'ArrowLeft' });
  firstHandle.fire('keydown', { key: ' ' });
  assert.deepEqual(fx.items().map(step => step.kind), ['normal', 'choice']);
  assert.deepEqual(fx.items()[1].options.map(option => option.item.modules[0].text), ['二', '三']);
});

test('keyboard activation can split either A/B side before or after its group', () => {
  const fx = fixture([{ kind: 'normal' }, choice()]);
  fx.view.renderMore();
  const groups = choiceGroupsIn(fx.moreList.children[0]);
  const sideHandle = groups[1].children.find(child => /dshwv-choice-drag/.test(child.className));

  sideHandle.fire('click');
  sideHandle.fire('keydown', { key: 'ArrowUp' });
  sideHandle.fire('keydown', { key: 'Enter' });

  assert.deepEqual(fx.items().map(step => step.modules?.[0]?.text), [undefined, 'B', 'A']);
  assert.equal(handleIn(fx.moreList.children[0]).focused, true);
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

const CHIP_BOUNDS = { width: 140, height: 24, left: 34, top: 8, right: 174, bottom: 32 };

test('drop geometry gives the bubble body priority for easy left/right pairing', () => {
  const row = { width: 200, height: 100, left: 0, top: 0, right: 200, bottom: 100 };
  const content = { width: 140, height: 60, left: 34, top: 20, right: 174, bottom: 80 };

  assert.equal(bubbleDropZone(row, content, { x: 80, y: 5 }), 'before');
  assert.equal(bubbleDropZone(row, content, { x: 80, y: 23 }), 'pairL');
  assert.equal(bubbleDropZone(row, content, { x: 80, y: 25 }), 'pairL');
  assert.equal(bubbleDropZone(row, content, { x: 140, y: 75 }), 'pairR');
  assert.equal(bubbleDropZone(row, content, { x: 80, y: 77 }), 'pairL');
  assert.equal(bubbleDropZone(row, content, { x: 80, y: 95 }), 'after');

  const shortRow = { width: 200, height: 44, left: 0, top: 0, right: 200, bottom: 44 };
  const shortContent = { width: 140, height: 36, left: 34, top: 4, right: 174, bottom: 40 };
  assert.equal(bubbleDropZone(shortRow, shortContent, { x: 80, y: 3 }), 'before');
  assert.equal(bubbleDropZone(shortRow, shortContent, { x: 80, y: 5 }), 'pairL', 'nearly the whole visible chip pairs');
  assert.equal(bubbleDropZone(shortRow, shortContent, { x: 140, y: 39 }), 'pairR');
  assert.equal(bubbleDropZone(shortRow, shortContent, { x: 140, y: 42 }), 'after');
});

function pairedDropFixture() {
  const fx = fixture([{ kind: 'normal' }, custom('二'), custom('三')]);
  fx.view.renderMore();
  chipIn(fx.moreList.children[1])._bounds = CHIP_BOUNDS;
  return fx;
}

test('dropping in the middle-left of another bubble pairs them with the dragged bubble as A', () => {
  const fx = pairedDropFixture();
  const [dragged, target] = fx.moreList.children;
  handleIn(dragged).fire('dragstart');
  target.fire('dragover', { clientX: 70, clientY: 20 });
  target.fire('drop', { clientX: 70, clientY: 20 });

  assert.deepEqual(fx.items().map(step => step.kind), ['normal', 'choice']);
  assert.deepEqual(fx.items()[1].options.map(option => option.item.modules[0].text), ['二', '三']);
});

test('dropping in the middle-right of another bubble pairs them with the dragged bubble as B', () => {
  const fx = pairedDropFixture();
  const [dragged, target] = fx.moreList.children;
  handleIn(dragged).fire('dragstart');
  target.fire('dragover', { clientX: 145, clientY: 20 });
  target.fire('drop', { clientX: 145, clientY: 20 });

  assert.deepEqual(fx.items().map(step => step.kind), ['normal', 'choice']);
  assert.deepEqual(fx.items()[1].options.map(option => option.item.modules[0].text), ['三', '二']);
});

test('the final pointer position at drop decides which side is paired', () => {
  const fx = pairedDropFixture();
  const [dragged, target] = fx.moreList.children;
  handleIn(dragged).fire('dragstart');
  target.fire('dragover', { clientX: 70, clientY: 20 });
  target.fire('drop', { clientX: 145, clientY: 20 });

  assert.deepEqual(fx.items()[1].options.map(option => option.item.modules[0].text), ['三', '二']);
});

test('drag targets expose readable intent and clear it on leave and drag end', () => {
  const fx = pairedDropFixture();
  const [dragged, target] = fx.moreList.children;
  handleIn(dragged).fire('dragstart');

  target.fire('dragover', { clientX: 70, clientY: 20 });
  assert.equal(target.attributes['data-drop-zone'], 'pairL');
  assert.equal(target.attributes['data-drop-label'], '放到 A');
  assert.equal(target.attributes['aria-label'], '放到 A');

  target.fire('dragleave');
  assert.equal(target.attributes['data-drop-zone'], undefined);
  assert.equal(target.attributes['data-drop-label'], undefined);
  assert.equal(target.attributes['aria-label'], undefined);
  assert.equal(target.style.boxShadow, '');

  target.fire('dragover', { clientX: 70, clientY: 5 });
  assert.equal(target.attributes['data-drop-label'], '排到前面');
  target.fire('dragover', { clientX: 70, clientY: 35 });
  assert.equal(target.attributes['data-drop-label'], '排到后面');
  dragged.fire('dragend');
  assert.equal(target.attributes['data-drop-zone'], undefined);
  assert.equal(target.attributes['data-drop-label'], undefined);
  assert.equal(target.attributes['aria-label'], undefined);
});

test('pairing over an existing A/B row says which side will be replaced', () => {
  const fx = fixture([{ kind: 'normal' }, custom('二'), choice()]);
  fx.view.renderMore();
  const [dragged, target] = fx.moreList.children;
  handleIn(dragged).fire('dragstart');

  target.fire('dragover', { clientX: 70, clientY: 20 });
  assert.equal(target.attributes['data-drop-label'], '替换 A');
  target.fire('dragover', { clientX: 145, clientY: 20 });
  assert.equal(target.attributes['data-drop-label'], '替换 B');
});

test('dropping on the handle-side padding still reorders instead of pairing', () => {
  const fx = pairedDropFixture();
  const [dragged, target] = fx.moreList.children;
  handleIn(dragged).fire('dragstart');
  target.fire('dragover', { clientX: 8, clientY: 30 });
  target.fire('drop', { clientX: 8, clientY: 30 });

  assert.deepEqual(fx.items().map(step => step.modules?.[0]?.text), [undefined, '三', '二']);
});

test('dragging an existing A/B row by its handle always reorders the whole row', () => {
  const fx = fixture([{ kind: 'normal' }, choice(), custom('三')]);
  fx.view.renderMore();
  const [choiceRow, target] = fx.moreList.children;
  chipIn(target)._bounds = CHIP_BOUNDS;
  const handle = choiceRow.children.find(child => child.className === 'dshwv-bubdrag');
  handle.fire('dragstart');
  target.fire('dragover', { clientX: 70, clientY: 30 });
  target.fire('drop', { clientX: 70, clientY: 30 });

  assert.deepEqual(fx.items().map(step => step.kind), ['normal', 'custom', 'choice']);
});
