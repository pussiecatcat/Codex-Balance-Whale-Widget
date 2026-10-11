import test from 'node:test';
import assert from 'node:assert/strict';

import { createBubbleRowsView } from '../desktop/ui/features/widget/bubble-rows-view.js';

function element(tag = 'div') {
  const node = {
    tagName: tag, className: '', textContent: '', style: { props: {} }, children: [], offsetWidth: 0,
    clientWidth: 0, listeners: {}, _html: '',
    set innerHTML(value) { this._html = value; if (value === '') this.children = []; },
    get innerHTML() { return this._html; },
    appendChild(child) { this.children.push(child); return child; },
    setAttribute() {}, addEventListener(type, fn) { (this.listeners[type] = this.listeners[type] || []).push(fn); },
    getBoundingClientRect() { return { width: this.offsetWidth, height: 0, left: 0, top: 0 }; },
    querySelectorAll() { return this.stale || []; },
    querySelector() { return null; },
    remove() {},
  };
  node.style.setProperty = (name, value) => { node.style.props[name] = value; };
  return node;
}

function fixture({ building = true, rootWidth = 1026, hostWidth = 408 } = {}) {
  const created = [];
  const visuals = { gifEl: element(), labelEl: element(), amountEl: element(), hintEl: element() };
  const target = element();
  const root = element();
  root.offsetWidth = rootWidth;
  const host = element();
  host.clientWidth = hostWidth;
  const container = element();
  container.parentNode = host;
  const calls = { snapshots: [], cleared: [], targets: [] };
  const scene = { building, switching: false };
  const view = createBubbleRowsView({
    document: { createElement(tag) { const node = element(tag); created.push(node); return node; } },
    window: {},
    WhaleMoney: { clearBindings: node => calls.cleared.push(node) },
    bubbleSnapshot: (mods, frozen) => { calls.snapshots.push({ mods, frozen }); return { modules: [], rows: [] }; },
    bubbleModuleFontU: () => 1,
    bubbleRowsOf: mods => mods,
    bubbleIsImgMod: () => false,
    whaleMoneyTemplates: { set() {} },
    getBubbleTarget: () => { calls.targets.push('target'); return target; },
    getSceneController: () => scene,
    getVisuals: () => visuals,
    getRoot: () => root,
    getBubbleBox: () => element(),
  });
  return { view, visuals, target, root, host, container, created, calls, scene };
}

test('render only writes while the scene is building', () => {
  const idle = fixture({ building: false });
  idle.view.render([{ type: 'text', text: 'x' }]);
  assert.deepEqual(idle.calls.snapshots, [], 'nothing is snapshotted while the scene is not building');
  assert.equal(idle.visuals.gifEl.style.display, undefined, 'and nothing is hidden');

  const building = fixture({ building: true });
  building.view.render([{ type: 'text', text: 'x' }]);
  assert.deepEqual(building.calls.snapshots, [{ mods: [{ type: 'text', text: 'x' }], frozen: true }]);
  assert.equal(building.visuals.gifEl.style.display, 'none');
  assert.equal(building.visuals.labelEl.style.display, 'none');
  assert.equal(building.visuals.amountEl.style.display, 'none');
  assert.equal(building.visuals.hintEl.style.display, 'none');
  assert.deepEqual(building.calls.targets, ['target'], 'the rows go to the live bubble target');
});

test('preview clears the container and the money bindings before it builds', () => {
  const fx = fixture();
  const stale = element('div');
  fx.container.stale = [stale];
  fx.view.preview(fx.container, [{ type: 'text', text: 'x' }], 300);
  assert.deepEqual(fx.calls.cleared, [fx.container]);
  const pop = fx.created.find(node => node.className === 'dshwv-minipop');
  assert.ok(pop, 'a mini pop is built inside the container');
  assert.equal(fx.container.style.width, '408px');
});

test('preview takes the narrower of the bubble and its host, never below the floor', () => {
  const wide = fixture({ rootWidth: 1026, hostWidth: 408 });
  wide.view.preview(wide.container, [], 300);
  assert.equal(wide.container.style.width, '408px', 'the host is the narrower one');

  const narrow = fixture({ rootWidth: 200, hostWidth: 408 });
  narrow.view.preview(narrow.container, [], 300);
  assert.equal(narrow.container.style.width, '200px', 'the bubble is the narrower one');

  const tiny = fixture({ rootWidth: 10, hostWidth: 10 });
  tiny.view.preview(tiny.container, [], 300);
  assert.equal(tiny.container.style.width, '120px', 'the 120px floor holds');
});

test('preview scales the bubble unit with the width it settled on', () => {
  const fx = fixture({ rootWidth: 1026, hostWidth: 408 });
  fx.view.preview(fx.container, [], 300);
  assert.equal(fx.container.style.props['--dshw-u'], 408 / 1026 + 'px');
  const pop = fx.created.find(node => node.className === 'dshwv-minipop');
  // 408 * 560 / 1026 rounded, plus the 5px top crop.
  assert.equal(pop.style.height, '228px');
  assert.equal(pop.style.overflow, 'hidden');
});

test('preview does nothing without a container', () => {
  const fx = fixture();
  fx.view.preview(null, [{ type: 'text', text: 'x' }], 300);
  assert.deepEqual(fx.calls.cleared, []);
  assert.equal(fx.created.length, 0);
});

test('preview centres itself in a wider host, with a deliberate offset to the right', () => {
  const fx = fixture({ rootWidth: 200, hostWidth: 500 });
  fx.view.preview(fx.container, [], 300);
  assert.equal(fx.container.style.width, '200px');
  // Half of the 300px difference, then shifted right by shiftR (capped at 10px)
  // and taken off the other margin, so the pair still sums to the gap.
  assert.equal(fx.container.style.marginLeft, '160px');
  assert.equal(fx.container.style.marginRight, '140px');
});

test('a snapshot that reports no rows still settles the container size', () => {
  const fx = fixture();
  fx.view.preview(fx.container, [], 300);
  assert.equal(fx.calls.cleared.length, 1);
  assert.equal(fx.container.style.transform, 'none');
  assert.equal(fx.container.style.transformOrigin, '');
});
