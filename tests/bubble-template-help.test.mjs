import test from 'node:test';
import assert from 'node:assert/strict';

import { createBubbleTemplateHelp } from '../desktop/ui/features/widget/bubble-template-help.js';

function element(tag = 'div') {
  return {
    tagName: tag, className: '', style: {}, textContent: '', children: [], innerHTML: '', offsetHeight: 120,
    appendChild(child) { this.children.push(child); return child; },
    addEventListener() {},
    getBoundingClientRect() { return { left: 100, top: 200, right: 340, bottom: 230, width: 240, height: 30 }; },
  };
}

function fixture({ items = [{ k: '{balance_api}', d: '当前余额' }, { k: '{currency}', d: '币种' }], viewport = { w: 1000, h: 800 } } = {}) {
  const created = [];
  const documentStub = {
    body: element('body'),
    listeners: {},
    createElement(tag) { const node = element(tag); created.push(node); return node; },
    addEventListener(type, fn) { (this.listeners[type] = this.listeners[type] || []).push(fn); },
    fire(type, event = {}) { for (const fn of this.listeners[type] || []) fn({ preventDefault() {}, ...event }); },
  };
  const help = createBubbleTemplateHelp({ document: documentStub, viewport: () => viewport, bubbleTplHelpItems: () => items });
  const toggle = anchor => help.toggle({ type: 'balance' }, anchor);
  return { help, created, documentStub, toggle, popover: () => created[0] };
}

test('the first toggle builds the popover, lists the placeholders and opens it', () => {
  const fx = fixture();
  fx.toggle(element('button'));
  const popover = fx.popover();
  assert.equal(popover.className, 'dshwv-tplhelp');
  assert.equal(popover.style.display, 'block');
  assert.match(popover.innerHTML, /可用占位符\(替换到内容里\)/);
  assert.match(popover.innerHTML, /<b style="color:#2f4488">\{balance_api\}<\/b> — 当前余额/);
  assert.match(popover.innerHTML, /<b style="color:#2f4488">\{currency\}<\/b> — 币种/);
  assert.equal(fx.documentStub.body.children.includes(popover), true, 'the popover is attached to the body');
});

test('a module with no automatic placeholders says so instead of listing nothing', () => {
  const fx = fixture({ items: [] });
  fx.toggle(element('button'));
  assert.match(fx.popover().innerHTML, /该模块无自动内容占位/);
});

test('toggling again hides it, and a third toggle reopens the same element', () => {
  const fx = fixture();
  fx.toggle(element('button'));
  const popover = fx.popover();
  fx.toggle(element('button'));
  assert.equal(popover.style.display, 'none');
  assert.equal(fx.created.length, 1, 'the element is built once and reused');
  fx.toggle(element('button'));
  assert.equal(popover.style.display, 'block');
});

test('Escape closes an open popover', () => {
  const fx = fixture();
  fx.toggle(element('button'));
  fx.documentStub.fire('keydown', { key: 'Escape' });
  assert.equal(fx.popover().style.display, 'none');
});

test('a pointer away from the popover and its button closes it', () => {
  const fx = fixture();
  fx.toggle(element('button'));
  fx.documentStub.fire('pointerdown', { target: { closest: () => null } });
  assert.equal(fx.popover().style.display, 'none');
});

test('a pointer on the help button or inside the popover leaves it open', () => {
  for (const selector of ['.dshwv-tplq', '.dshwv-tplhelp']) {
    const fx = fixture();
    fx.toggle(element('button'));
    fx.documentStub.fire('pointerdown', { target: { closest: value => (value === selector ? {} : null) } });
    assert.equal(fx.popover().style.display, 'block', 'a click on ' + selector + ' must not close it');
  }
});

test('the popover sits under the anchor and flips above when it would run off the bottom', () => {
  const roomy = fixture();
  roomy.toggle(element('button'));
  assert.equal(roomy.popover().style.top, '234px', 'anchor bottom 230 + 4');
  assert.equal(roomy.popover().style.left, '88px', 'right 340 - width 252');

  const tight = fixture({ viewport: { w: 1000, h: 340 } });
  tight.toggle(element('button'));
  // 230 + 4 + 120 overflows 340, so it goes above the anchor: 200 - 120 - 4.
  assert.equal(tight.popover().style.top, '76px');
});

test('the popover keeps a margin when the anchor sits near the right edge', () => {
  const fx = fixture({ viewport: { w: 260, h: 800 } });
  const anchor = element('button');
  anchor.getBoundingClientRect = () => ({ left: 200, top: 100, right: 250, bottom: 130, width: 50, height: 30 });
  fx.toggle(anchor);
  // Clamped so it never leaves a margin of 4 on the right of a 260px viewport.
  assert.equal(fx.popover().style.left, '4px');
});

test('toggling without an anchor still opens at the default position', () => {
  const fx = fixture();
  fx.help.toggle({ type: 'balance' }, null);
  const popover = fx.popover();
  assert.equal(popover.style.display, 'block');
  assert.equal(popover.style.left, '4px', 'default right 180 - 252 clamps to the margin');
  assert.equal(popover.style.top, '154px', 'default bottom 150 + 4');
  assert.doesNotMatch(popover.style.top, /NaN/, 'the fallback rect carries a bottom to compute from');
});
