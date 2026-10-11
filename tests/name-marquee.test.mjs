import test from 'node:test';
import assert from 'node:assert/strict';

import { createNameMarquee } from '../desktop/ui/features/widget/name-marquee.js';

function fixture({ textWidth = 100, clientWidth = 50, speed } = {}) {
  const track = {
    children: [{ textContent: '小鲸鱼', offsetWidth: textWidth }],
    style: {}, scrollWidth: textWidth * 2,
    appendChild(child) { this.children.push(child); return child; },
    removeChild(child) { this.children = this.children.filter(node => node !== child); return child; },
  };
  const nameElement = {
    clientWidth, style: {}, listeners: {}, isConnected: true,
    querySelector: selector => (selector === '.dshwv-nameinner' ? track : null),
    addEventListener(type, fn) { (this.listeners[type] = this.listeners[type] || []).push(fn); },
    fire(type) { for (const fn of this.listeners[type] || []) fn(); },
  };
  const item = {
    listeners: {},
    addEventListener(type, fn) { (this.listeners[type] = this.listeners[type] || []).push(fn); },
    removeEventListener(type, fn) { this.listeners[type] = (this.listeners[type] || []).filter(other => other !== fn); },
    fire(type) { for (const fn of this.listeners[type] || []) fn(); },
  };
  const created = [];
  const documentStub = { createElement(tag) {
    const node = { tagName: tag, className: '', textContent: '', children: [], appendChild(child) { this.children.push(child); return child; } };
    created.push(node); return node;
  } };
  const marquee = createNameMarquee({ document: documentStub, ...(speed === undefined ? {} : { speed }) });
  return { marquee, item, nameElement, track, created };
}

test('makeCell builds the two-span track the marquee animates', () => {
  const { marquee, created } = fixture();
  const cell = marquee.makeCell('dshwv-rolename', '角色甲');
  assert.equal(cell.className, 'dshwv-rolename');
  const inner = cell.children[0];
  assert.equal(inner.className, 'dshwv-nameinner');
  const copy = inner.children[0];
  assert.equal(copy.className, 'dshwv-namecopy');
  assert.equal(copy.textContent, '角色甲');
  assert.equal(created.length, 3, 'outer, inner track, and the copy inside it');
});

test('binding does nothing without both an item and a name element', () => {
  const { marquee, item, nameElement } = fixture();
  marquee.bind(null, nameElement);
  marquee.bind(item, null);
  assert.equal(Object.keys(item.listeners).length, 0, 'no listeners were attached');
});

test('a name that fits does not start scrolling or duplicate itself', t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const fx = fixture({ textWidth: 40, clientWidth: 50 });
  fx.marquee.bind(fx.item, fx.nameElement);
  fx.item.fire('mouseenter');
  assert.equal(fx.track.children.length, 1, 'nothing was duplicated');
  assert.equal(fx.track.style.transform, '', 'and no transform was applied');
  assert.equal(fx.track.style.transitionDuration, '');
});

test('a name wider than the cell duplicates itself and starts the loop', t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const fx = fixture({ textWidth: 100, clientWidth: 50 });
  fx.marquee.bind(fx.item, fx.nameElement);
  fx.item.fire('mouseenter');
  assert.equal(fx.track.children.length, 2, 'the copy makes the scroll seamless');
  assert.equal(fx.track.children[1].className, 'dshwv-namecopy');
  assert.equal(fx.track.children[1].textContent, '小鲸鱼');
  assert.equal(fx.track.style.transitionTimingFunction, 'linear');
  assert.equal(fx.track.style.transform, 'translateX(-100px)', 'half of the doubled scroll width');
  // 100px at the default 40px/s is 2.5s, comfortably above the 200ms floor.
  assert.equal(fx.track.style.transitionDuration, '2500ms');
});

test('a slow speed stretches the duration and a fast one hits the floor', t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const slow = fixture({ textWidth: 100, clientWidth: 50, speed: 10 });
  slow.marquee.bind(slow.item, slow.nameElement);
  slow.item.fire('mouseenter');
  assert.equal(slow.track.style.transitionDuration, '10000ms');

  const fast = fixture({ textWidth: 100, clientWidth: 50, speed: 1000 });
  fast.marquee.bind(fast.item, fast.nameElement);
  fast.item.fire('mouseenter');
  assert.equal(fast.track.style.transitionDuration, '200ms', 'the 200ms floor holds');
});

test('leaving the item stops the loop and removes the duplicate', t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const fx = fixture();
  fx.marquee.bind(fx.item, fx.nameElement);
  fx.item.fire('mouseenter');
  assert.equal(fx.track.children.length, 2);
  fx.item.fire('mouseleave');
  assert.equal(fx.track.children.length, 1, 'the copy is taken back out');
  assert.equal(fx.track.style.transform, '', 'and the transform is cleared');
  assert.equal(fx.track.style.transitionDuration, '');
});

test('leaving stops the loop for good, however long the pointer stays away', t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const fx = fixture();
  fx.marquee.bind(fx.item, fx.nameElement);
  fx.item.fire('mouseenter');
  fx.item.fire('mouseleave');
  t.mock.timers.tick(60000);
  assert.equal(fx.track.style.transform, '', 'a pending cycle must not resurrect the scroll');
  assert.equal(fx.track.children.length, 1, 'and the duplicate must not come back');
});

// The list a row lives in can be rebuilt while the pointer is still over it, and
// a replaced row never fires mouseleave. Before this was handled, the marquee
// kept rescheduling against a detached node for the life of the widget.
test('the loop releases a row that was replaced instead of animating it forever', t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const fx = fixture();
  fx.marquee.bind(fx.item, fx.nameElement);
  fx.item.fire('mouseenter');
  assert.equal(fx.track.children.length, 2, 'it is animating while the row is attached');

  fx.nameElement.isConnected = false;
  t.mock.timers.tick(60000);
  assert.equal(fx.track.style.transform, '', 'the transform is released');
  assert.equal(fx.track.children.length, 1, 'and so is the duplicate');
});

test('bind returns a cleanup a list rebuild can call directly', t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const fx = fixture();
  const release = fx.marquee.bind(fx.item, fx.nameElement);
  assert.equal(typeof release, 'function');
  fx.item.fire('mouseenter');
  assert.equal(fx.track.children.length, 2);

  release();
  assert.equal(fx.track.style.transform, '', 'the loop stopped');
  assert.equal(fx.track.children.length, 1, 'and the duplicate was taken back out');
  // Detached listeners are proven by behaviour: hovering again must not restart it.
  fx.item.fire('mouseenter');
  assert.equal(fx.track.children.length, 1, 'the listeners are detached too');
  t.mock.timers.tick(60000);
  assert.equal(fx.track.children.length, 1, 'and nothing reschedules after the cleanup');
});

test('binding without both nodes still returns a callable cleanup', () => {
  const fx = fixture();
  const release = fx.marquee.bind(null, fx.nameElement);
  assert.equal(typeof release, 'function');
  release();
});
