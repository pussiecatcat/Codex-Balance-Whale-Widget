import test from 'node:test';
import assert from 'node:assert/strict';

import { createBubbleAdvanceControl } from '../desktop/ui/features/widget/bubble-advance-control.js';

function element(tag = 'div') {
  return {
    tagName: tag, className: '', id: '', title: '', type: '', textContent: '', innerHTML: '', checked: false,
    style: {}, children: [], listeners: {}, attributes: {}, offsetHeight: 112, parentElement: null,
    appendChild(child) { child.parentElement = this; this.children.push(child); return child; },
    setAttribute(name, value) { this.attributes[name] = String(value); },
    addEventListener(type, listener) { (this.listeners[type] = this.listeners[type] || []).push(listener); },
    fire(type, event = {}) {
      for (const listener of this.listeners[type] || []) listener({ target: this, stopPropagation() {}, ...event });
    },
    contains(node) { return this === node || this.children.includes(node); },
    closest(selector) {
      const className = selector.startsWith('.') ? selector.slice(1) : '';
      if (className && this.className.split(/\s+/).includes(className)) return this;
      return this.parentElement?.closest?.(selector) || null;
    },
    querySelector(selector) {
      const className = selector.startsWith('.') ? selector.slice(1) : '';
      for (const child of this.children) {
        if (className && child.className.split(/\s+/).includes(className)) return child;
        const nested = child.querySelector?.(selector);
        if (nested) return nested;
      }
      return null;
    },
    getBoundingClientRect() { return { left: 150, top: 200, right: 168, bottom: 218, width: 18, height: 18 }; },
  };
}

function fixture(area = { w: 800, h: 600 }, geometry = {}) {
  const changes = [];
  const windowStub = {
    listeners: {},
    addEventListener(type, listener) { (this.listeners[type] = this.listeners[type] || []).push(listener); },
    fire(type, event = {}) { for (const listener of this.listeners[type] || []) listener(event); },
  };
  const documentStub = {
    body: element('body'), activeElement: null, listeners: {}, defaultView: windowStub,
    createElement: tag => element(tag),
    addEventListener(type, listener) { (this.listeners[type] = this.listeners[type] || []).push(listener); },
    fire(type, event = {}) { for (const listener of this.listeners[type] || []) listener(event); },
  };
  const control = createBubbleAdvanceControl({
    document: documentStub,
    viewport: () => area,
    onChange: value => changes.push(value),
  });
  const card = element('div');
  card.className = 'dshwv-bubcard';
  card.getBoundingClientRect = () => geometry.card || {
    left: 100,
    top: 50,
    right: Math.min(700, area.w),
    bottom: Math.min(550, area.h),
    width: Math.min(600, area.w - 100),
    height: Math.min(500, area.h - 50),
  };
  card.appendChild(control.element);
  const footer = element('div');
  footer.className = 'dshwv-bubbtns';
  footer.getBoundingClientRect = () => geometry.footer || {
    left: 200,
    top: Math.min(480, area.h + 200),
    right: 600,
    bottom: Math.min(520, area.h + 240),
    width: 400,
    height: 40,
  };
  card.appendChild(footer);
  return { control, documentStub, windowStub, card, footer, changes };
}

test('the queue control exposes a labelled checkbox whose value can be loaded and edited', () => {
  const fx = fixture();
  assert.match(fx.control.element.className, /dshwv-bubadvance/);
  assert.equal(fx.control.element.children[0].children[1].textContent, '点按角色推进泡泡队列');
  assert.equal(fx.control.getValue(), false);
  fx.control.setValue(true);
  assert.equal(fx.control.getValue(), true);
  fx.control.input.checked = false;
  fx.control.input.fire('change');
  assert.deepEqual(fx.changes, [false]);
});

test('hovering or focusing the question button shows the full explanation beside it', () => {
  const fx = fixture();
  fx.control.helpButton.fire('mouseenter');
  assert.equal(fx.control.popover.style.display, 'block');
  assert.equal(fx.control.popover.style.width, '360px');
  assert.equal(fx.control.popover.style.left, '150px');
  assert.equal(fx.control.popover.style.top, '226px');
  assert.equal(fx.control.helpButton.attributes['aria-expanded'], 'true');
  assert.equal(fx.control.popover.attributes['aria-hidden'], 'false');
  assert.match(fx.control.popover.innerHTML, /关闭（默认）/);
  assert.match(fx.control.popover.innerHTML, /回到第 1 个泡泡/);
  assert.match(fx.control.popover.innerHTML, /点一下角色 = 往后推进一项/);
});

test('the explanation stays inside a narrow viewport and flips above its anchor', () => {
  const fx = fixture(
    { w: 260, h: 260 },
    { card: { left: 0, top: 0, right: 260, bottom: 260, width: 260, height: 260 } },
  );
  fx.control.helpButton.getBoundingClientRect = () => ({ left: 240, top: 230, right: 258, bottom: 248, width: 18, height: 18 });
  fx.control.showHelp();
  assert.equal(fx.control.popover.style.width, '244px');
  assert.equal(fx.control.popover.style.left, '8px');
  assert.equal(fx.control.popover.style.top, '110px');
});

test('the explanation measures its height after applying the responsive width', () => {
  const fx = fixture(
    { w: 400, h: 300 },
    { card: { left: 0, top: 0, right: 400, bottom: 300, width: 400, height: 300 } },
  );
  fx.control.helpButton.getBoundingClientRect = () => ({ left: 30, top: 230, right: 48, bottom: 248, width: 18, height: 18 });
  Object.defineProperty(fx.control.popover, 'offsetHeight', {
    get() { return fx.control.popover.style.width ? 140 : 60; },
  });
  fx.control.showHelp();
  assert.equal(fx.control.popover.style.width, '360px');
  assert.equal(fx.control.popover.style.top, '82px');
});

test('the help disclosure has no duplicate native tooltip and exposes a labelled region', () => {
  const fx = fixture();
  assert.equal(fx.control.helpButton.title, '');
  assert.match(fx.control.helpButton.className, /(?:^|\s)dshwv-askq(?:\s|$)/);
  assert.match(fx.control.helpButton.className, /(?:^|\s)dshwv-tplq(?:\s|$)/);
  assert.equal(fx.control.helpButton.attributes['aria-controls'], fx.control.popover.id);
  assert.equal(fx.control.helpButton.attributes['aria-expanded'], 'false');
  assert.equal(fx.control.popover.attributes.role, 'region');
  assert.equal(fx.control.popover.attributes['aria-labelledby'], fx.control.helpButton.id);
  assert.equal(fx.control.popover.attributes['aria-hidden'], 'true');
  assert.doesNotMatch(fx.control.popover.className, /(?:^|\s)tooltip(?:\s|$)/);
  assert.match(fx.control.popover.className, /(?:^|\s)dshwv-tplhelp(?:\s|$)/);
  assert.match(fx.control.popover.className, /(?:^|\s)dshwv-hintbox(?:\s|$)/);
});

test('the explanation may extend beyond the editor card while staying inside the viewport', () => {
  const fx = fixture(
    { w: 1000, h: 800 },
    {
      card: { left: 200, top: 100, right: 600, bottom: 650, width: 400, height: 550 },
      footer: { left: 260, top: 400, right: 540, bottom: 440, width: 280, height: 40 },
    },
  );
  fx.control.helpButton.getBoundingClientRect = () => ({
    left: 570,
    top: 360,
    right: 588,
    bottom: 378,
    width: 18,
    height: 18,
  });
  fx.control.showHelp();
  assert.equal(fx.control.popover.style.width, '360px');
  assert.equal(fx.control.popover.style.left, '570px', 'the reference popover begins beside its question button');
  assert.equal(fx.control.popover.style.top, '386px', 'the reference popover opens directly below its question button');
});

test('scroll and resize reposition an open explanation', () => {
  const fx = fixture();
  let anchor = { left: 150, top: 200, right: 168, bottom: 218, width: 18, height: 18 };
  fx.control.helpButton.getBoundingClientRect = () => anchor;
  fx.control.showHelp();

  anchor = { left: 300, top: 140, right: 318, bottom: 158, width: 18, height: 18 };
  fx.documentStub.fire('scroll');
  assert.equal(fx.control.popover.style.left, '300px');
  assert.equal(fx.control.popover.style.top, '166px');

  anchor = { left: 120, top: 120, right: 138, bottom: 138, width: 18, height: 18 };
  fx.windowStub.fire('resize');
  assert.equal(fx.control.popover.style.left, '120px');
  assert.equal(fx.control.popover.style.top, '146px');
});

test('keyboard focus shows the explanation and blur dismisses it', async () => {
  const fx = fixture();
  fx.control.helpButton.fire('focus');
  assert.equal(fx.control.popover.style.display, 'block');
  fx.control.helpButton.fire('blur');
  await new Promise(resolve => setTimeout(resolve, 120));
  assert.equal(fx.control.popover.style.display, 'none');
});

test('click pins the explanation while Escape, outside press and a second click close it', () => {
  const fx = fixture();
  fx.control.helpButton.fire('click');
  assert.equal(fx.control.popover.style.display, 'block');
  fx.documentStub.fire('keydown', { key: 'Escape' });
  assert.equal(fx.control.popover.style.display, 'none');
  assert.equal(fx.control.popover.attributes['aria-hidden'], 'true');

  fx.control.showHelp();
  fx.documentStub.fire('pointerdown', { target: element('div') });
  assert.equal(fx.control.popover.style.display, 'none');

  fx.control.helpButton.fire('click');
  fx.control.helpButton.fire('click');
  assert.equal(fx.control.popover.style.display, 'none');
});
