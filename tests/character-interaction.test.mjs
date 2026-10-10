import test from 'node:test';
import assert from 'node:assert/strict';

import { createCharacterInteraction } from '../desktop/ui/features/widget/character-interaction.js';

function element(tag = 'div') {
  const node = {
    tagName: tag, className: '', style: {}, children: [], listeners: {}, offsetWidth: 120, offsetHeight: 90,
    rect: { left: 100, top: 200, width: 120, height: 90 },
    classList: {
      set: new Set(),
      add(name) { this.set.add(name); },
      remove(name) { this.set.delete(name); },
      contains(name) { return this.set.has(name); },
      toggle(name, on) { if (on) this.set.add(name); else this.set.delete(name); },
    },
    getBoundingClientRect() { return this.rect; },
    appendChild(child) { this.children.push(child); return child; },
    addEventListener(type, fn) { (this.listeners[type] = this.listeners[type] || []).push(fn); },
    removeEventListener(type, fn) { this.listeners[type] = (this.listeners[type] || []).filter(fn2 => fn2 !== fn); },
    fire(type, event = {}) { for (const fn of [...(this.listeners[type] || [])]) fn({ preventDefault() {}, stopPropagation() {}, ...event }); },
    setPointerCapture(id) { this.captured = id; },
    hasPointerCapture(id) { return this.captured === id; },
    releasePointerCapture() { this.captured = null; },
    querySelectorAll() { return []; },
  };
  return node;
}

const pointer = (x, y, extra = {}) => ({ clientX: x, clientY: y, pointerId: 7, button: 0, pointerType: 'mouse', target: {}, ...extra });

function fixture() {
  const root = element();
  const positioner = element();
  const image = element();
  const menuButton = element();
  const documentStub = element('document');
  const state = { left: 100, top: 200, flip: false, h: null, v: null, hOff: 0, vOff: 0 };
  const dragStatus = { active: false };
  const calls = { prepared: [], hits: [], pressed: 0, released: 0, clicks: 0, refreshed: [], settled: 0, saved: 0, menuClosed: 0, expressed: 0, cursors: [] };
  let hitResult = true;

  const interaction = createCharacterInteraction({
    document: documentStub, window: { addEventListener() {} }, localStorage: { getItem: () => null, setItem() {} },
    rendering: {
      hitCache: {
        prepare: url => calls.prepared.push(url),
        hit: (...args) => { calls.hits.push(args); return hitResult; },
      },
      mirrorScale: () => 1,
    },
    root, image, positioner, menuButton, state, dragStatus,
    clickDistanceSq: 25, imageUrl: '/dsh-whale/image.png?v=2',
    viewport: () => ({ w: 800, h: 600 }), rightGap: () => 0,
    clampToViewport: (left, top) => ({ left, top }),
    artCenterAt: (left, top, w, h, flipped) => ({ cx: left + w / 2, cy: top + h - w / 6, flipped }),
    snapZones: (cx, cyBox, cyImage) => ({ zH: cx < 100 ? 'left' : cx > 700 ? 'right' : null, zV: cyBox < 60 ? 'top' : cyImage > 520 ? 'bottom' : null, flip: false }),
    restoreAnchor: () => null,
    express: () => { calls.expressed++; }, settle: () => { calls.settled++; }, saveConfig: () => { calls.saved++; },
    refreshFlip: () => {}, pressDown: () => { calls.pressed++; }, pressUp: () => { calls.released++; },
    whaleClick: () => { calls.clicks++; }, refresh: value => calls.refreshed.push(value),
    closeMenu: () => { calls.menuClosed++; }, toggleMenu: () => {}, closeRolePanel: () => {}, closeAudioGroupPanel: () => {},
    hideBubble: () => {}, applyBubbleConfig: () => {}, positionMenu: () => {},
    isMenuOpen: () => false, isMenuButtonHidden: () => false, isScrollGapEnabled: () => false,
  });
  return {
    interaction, root, documentStub, state, dragStatus, calls,
    setHit: value => { hitResult = value; },
    // pointerdown is captured on the document, not on the whale element.
    down: (x, y, extra) => documentStub.fire('pointerdown', pointer(x, y, extra)),
    move: (x, y) => documentStub.fire('pointermove', pointer(x, y)),
    up: (x, y) => documentStub.fire('pointerup', pointer(x, y)),
  };
}

test('the hit test asks the rendering cache with the current mirror state', () => {
  const fx = fixture();
  fx.interaction.setupHitTest('/dsh-whale/role-image.png?id=x');
  assert.deepEqual(fx.calls.prepared, ['/dsh-whale/role-image.png?id=x']);
  fx.interaction.setupHitTest('');
  assert.equal(fx.calls.prepared[1], '/dsh-whale/image.png?v=2', 'an empty url falls back to the built-in art');

  assert.equal(fx.interaction.isWhaleHit(pointer(5, 6)), true);
  const [, x, y, mirrored] = fx.calls.hits[0];
  assert.equal(x, 5); assert.equal(y, 6); assert.equal(mirrored, false);
  assert.equal(fx.interaction.isWhaleHit(null), false, 'no event is never a hit');
});

test('the layout rect comes from the positioner box and the rendered root size', () => {
  const fx = fixture();
  assert.deepEqual(fx.interaction.layoutRect(), { left: 100, top: 200, right: 220, bottom: 290, width: 120, height: 90 });
});

test('pressing the whale starts a drag and a press without movement is a click', () => {
  const fx = fixture();
  fx.down(150, 240);
  assert.equal(fx.dragStatus.active, true);
  assert.equal(fx.root.classList.contains('dshwv-dragging'), true);
  assert.equal(fx.calls.pressed, 1);
  assert.equal(fx.root.captured, 7, 'the pointer is captured for the gesture');

  fx.up(150, 240);
  assert.equal(fx.calls.clicks, 1, 'a press that never moved is the click action');
  assert.deepEqual(fx.calls.refreshed, [true]);
  assert.equal(fx.calls.released, 1);
  assert.equal(fx.calls.settled, 0, 'a click does not resettle the position');
  assert.equal(fx.root.classList.contains('dshwv-dragging'), false);
});

test('a press that moves beyond the click slop becomes a drag and settles', () => {
  const fx = fixture();
  fx.down(150, 240);
  fx.move(400, 400);
  // The whale follows the pointer's delta from where the gesture started, not
  // the absolute pointer position: 100 + (400 - 150).
  assert.equal(fx.state.left, 350);
  fx.up(400, 400);
  assert.equal(fx.calls.clicks, 0, 'a drag is not a click');
  assert.equal(fx.calls.settled, 1);
  assert.equal(fx.calls.saved, 1);
});

test('a drag far left snaps the whale to the left edge and flips it', () => {
  const fx = fixture();
  fx.down(150, 240);
  fx.move(0, 120);
  fx.up(0, 120);
  assert.equal(fx.state.h, 'left');
  assert.equal(fx.state.hOff, 0);
  assert.equal(fx.state.flip, true);
  assert.equal(fx.state.v, null, 'vertically it stays free');
});

test('a drag to the top-right snaps to both right and top', () => {
  const fx = fixture();
  fx.down(150, 240);
  fx.move(900, 0);
  fx.up(900, 0);
  assert.equal(fx.state.h, 'right');
  assert.equal(fx.state.v, 'top');
  assert.equal(fx.state.flip, false);
});

test('a press on a blocked surface never starts a drag', () => {
  const fx = fixture();
  for (const selector of ['.dshwv-rolelist', '.dshwv-snapmask', '.dshwv-menu-btn', '.dshwv-pop']) {
    // closest() takes a selector list, so an element matches when its own class
    // appears anywhere in the list the caller passed.
    fx.down(150, 240, { target: { closest: value => (String(value).split(',').includes(selector) ? {} : null) } });
  }
  assert.equal(fx.dragStatus.active, false);
  assert.equal(fx.calls.pressed, 0);
});

test('a press outside the art, or with a non-primary mouse button, never starts a drag', () => {
  const outside = fixture();
  outside.setHit(false);
  outside.down(150, 240);
  assert.equal(outside.dragStatus.active, false);

  const secondary = fixture();
  secondary.down(150, 240, { button: 2 });
  assert.equal(secondary.dragStatus.active, false);

  const touch = fixture();
  touch.down(150, 240, { button: 2, pointerType: 'touch' });
  assert.equal(touch.dragStatus.active, true, 'a non-primary button only blocks the mouse');
});

test('ending a drag that never started does nothing', () => {
  const fx = fixture();
  fx.interaction.endDrag(pointer(150, 240), true);
  assert.equal(fx.calls.clicks, 0);
  assert.equal(fx.calls.settled, 0);
  assert.equal(fx.calls.released, 0);
});

test('a cancelled gesture settles without clicking', () => {
  const fx = fixture();
  fx.down(150, 240);
  fx.documentStub.fire('pointercancel', pointer(150, 240));
  assert.equal(fx.calls.clicks, 0);
  assert.equal(fx.calls.settled, 1);
  assert.equal(fx.dragStatus.active, false);
});
