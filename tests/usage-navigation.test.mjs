import test from 'node:test';
import assert from 'node:assert/strict';

import { createUsageNavigation } from '../desktop/ui/features/widget/usage-navigation.js';

function element() {
  return {
    style: {},
    classList: {
      added: [], removed: [],
      add(name) { this.added.push(name); },
      remove(name) { this.removed.push(name); },
      contains() { return false; },
      toggle() {},
    },
    textContent: '', title: '', children: [], parentNode: null, scrollTop: 0, offsetHeight: 360,
    rect: { width: 300, height: 360 },
    getBoundingClientRect() { return this.rect; },
    appendChild(child) { this.children.push(child); child.parentNode = this; return child; },
    addEventListener() {},
  };
}

// Fake timers throughout: showing the ledger starts a real 10-second refresh
// interval, which would otherwise keep the test process alive after the run.
function fixture(t) {
  t.mock.timers.enable({ apis: ['setInterval', 'setTimeout'] });
  const menuBox = element();
  const menuRootView = element();
  const usageArea = element();
  const usagePanel = element();
  const usageRecBtn = element();
  const calls = { render: 0, dashboard: 0, legacyStop: 0 };
  const windowStub = {
    addEventListener() {},
    WhaleDashboard: { select() { calls.dashboard++; } },
    WhaleLegacyUsage: { stop() { calls.legacyStop++; } },
  };
  const navigation = createUsageNavigation({
    window: windowStub, menuBox, menuRootView, usageArea, usagePanel, usageRecBtn,
    renderUsagePanel: () => { calls.render++; },
  });
  return { navigation, menuBox, menuRootView, usageArea, usagePanel, usageRecBtn, calls };
}

test('showing the ledger sizes it from the compact menu and flips the button', t => {
  const { navigation, menuBox, usageRecBtn, calls } = fixture(t);
  assert.equal(navigation.isOpen(), false);
  navigation.show();
  assert.equal(navigation.isOpen(), true);
  assert.deepEqual(menuBox.classList.added, ['dshwv-ledger-open']);
  assert.equal(menuBox.style.width, '300px');
  assert.equal(menuBox.style.height, '360px');
  assert.equal(menuBox.style.overflow, 'hidden');
  assert.equal(usageRecBtn.textContent, '‹ 返回');
  assert.equal(usageRecBtn.title, '返回');
  assert.equal(calls.render, 1);
});

test('a menu box that reports nothing falls back to the default 300x360 ledger', t => {
  const { navigation, menuBox } = fixture(t);
  menuBox.rect = { width: 0, height: 0 };
  navigation.show();
  assert.equal(menuBox.style.width, '300px');
  assert.equal(menuBox.style.height, '360px');
});

test('a menu box that throws while measuring still opens at the default size', t => {
  const { navigation, menuBox } = fixture(t);
  menuBox.getBoundingClientRect = () => { throw new Error('detached'); };
  navigation.show();
  assert.equal(navigation.isOpen(), true);
  assert.equal(menuBox.style.width, '300px');
});

test('hiding restores the entry label and toggle flips both ways', t => {
  const { navigation, usageRecBtn } = fixture(t);
  navigation.toggle();
  assert.equal(navigation.isOpen(), true);
  navigation.toggle();
  assert.equal(navigation.isOpen(), false);
  assert.equal(usageRecBtn.textContent, '- = 小龙娘记账 = -');
  assert.equal(usageRecBtn.title, '打开小龙娘记账');
});

test('hiding an already closed ledger restores the label without touching the panel', t => {
  const { navigation, usagePanel, usageRecBtn } = fixture(t);
  navigation.hide();
  assert.equal(navigation.isOpen(), false);
  assert.equal(usageRecBtn.textContent, '- = 小龙娘记账 = -');
  assert.deepEqual(usagePanel.style, {});
});

// The withdrawn dashboard module used to be consulted here and could never be
// present; show, hide and toggle must not look for it, nor for the legacy usage
// panel it delegated to.
test('navigation never consults the withdrawn dashboard or the legacy usage panel', t => {
  const { navigation, calls } = fixture(t);
  navigation.show();
  navigation.hide();
  navigation.toggle();
  navigation.toggle();
  navigation.startLegacy();
  navigation.stopLegacy();
  assert.equal(calls.dashboard, 0);
  assert.equal(calls.legacyStop, 0);
});

test('the refresh interval follows the open state, and dispose stops it', t => {
  const { navigation, usagePanel, calls } = fixture(t);
  navigation.show();
  assert.equal(calls.render, 1);
  t.mock.timers.tick(10000);
  assert.equal(calls.render, 2, 'an open ledger refreshes itself');
  navigation.hide();
  t.mock.timers.tick(30000);
  assert.equal(calls.render, 2, 'a closed ledger does not');

  navigation.startLegacy();
  assert.equal(navigation.isOpen(), true);
  assert.match(usagePanel.style.cssText, /position:static/);
  assert.equal(calls.render, 3);
  t.mock.timers.tick(10000);
  assert.equal(calls.render, 4);
  navigation.dispose();
  assert.equal(navigation.isOpen(), false);
  t.mock.timers.tick(30000);
  assert.equal(calls.render, 4, 'dispose leaves no interval behind');
});
