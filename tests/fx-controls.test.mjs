import test from 'node:test';
import assert from 'node:assert/strict';

import { createFxControls } from '../desktop/ui/features/widget/fx-controls.js';

function element() {
  const node = {
    hidden: true, textContent: '', title: '', value: '', disabled: false, style: {},
    offsetWidth: 240, offsetHeight: 120, listeners: {}, attributes: {}, focused: 0,
    rect: { top: 100, right: 340, bottom: 130, left: 300 },
    getBoundingClientRect() { return this.rect; },
    setAttribute(name, value) { this.attributes[name] = value; },
    focus() { this.focused++; },
    contains() { return false; },
    addEventListener(type, fn) { (this.listeners[type] = this.listeners[type] || []).push(fn); },
    fire(type, event = {}) { for (const fn of this.listeners[type] || []) fn({ stopPropagation() {}, preventDefault() {}, ...event }); },
  };
  return node;
}

function money(overrides = {}) {
  const state = {
    displayCurrency: 'CNY', nativeCurrency: 'CNY', refreshing: false, cooldownRemainingMs: 0,
    quote: { usdCny: 7.12, date: '2026-10-10' }, latestQuote: { usdCny: 7.12, retrievedAt: '2026-10-10T02:00:00Z', source: 'Frankfurter' },
    checkedAt: '2026-10-10T02:00:00Z', hasPendingQuote: false, error: '', ...overrides,
  };
  const calls = { refresh: [], setCurrency: [], refreshDrop: 0 };
  return {
    state: () => state, calls, state_object: state,
    refreshQuote: options => { calls.refresh.push(options); return Promise.resolve(true); },
    setDisplayCurrency: next => { calls.setCurrency.push(next); return Promise.resolve(); },
    onChange(fn) { this.listener = fn; fn(state); return () => { this.listener = null; }; },
  };
}

function fixture(t, overrides) {
  t.mock.timers.enable({ apis: ['setInterval'] });
  const nodes = { currencyNote: element(), fxInfoBtn: element(), fxRefreshBtn: element(), currencySel: element(), currencyDrop: element() };
  const events = { closed: 0, notices: [], windowListeners: {} };
  const whaleMoney = money(overrides);
  const documentStub = { listeners: {}, addEventListener(type, fn) { (this.listeners[type] = this.listeners[type] || []).push(fn); },
    fire(type, event) { for (const fn of this.listeners[type] || []) fn({ stopPropagation() {}, preventDefault() {}, ...event }); } };
  const windowStub = {
    innerWidth: 1000, innerHeight: 800,
    addEventListener(type, fn) { (events.windowListeners[type] = events.windowListeners[type] || []).push(fn); },
    fire(type) { for (const fn of events.windowListeners[type] || []) fn(); },
  };
  const controls = createFxControls({
    document: documentStub, window: windowStub, WhaleMoney: whaleMoney,
    currencyNote: nodes.currencyNote, fxInfoBtn: nodes.fxInfoBtn, fxRefreshBtn: nodes.fxRefreshBtn,
    currencySel: nodes.currencySel, currencyDrop: { refresh: () => { whaleMoney.calls.refreshDrop++; } },
    dshwCustSelClose: () => {}, closeRolePanel: () => { events.closed++; },
    closeAudioGroupPanel: () => { events.closed++; }, assetNotice: message => events.notices.push(message),
  });
  return { controls, nodes, whaleMoney, documentStub, windowStub, events };
}

test('the refresh button reads refreshing, cooldown and idle from money state', t => {
  const { whaleMoney, nodes, controls } = fixture(t);
  assert.equal(nodes.fxRefreshBtn.textContent, '刷新汇率');
  assert.equal(nodes.fxRefreshBtn.disabled, false);

  whaleMoney.state_object.refreshing = true;
  whaleMoney.state_object.cooldownRemainingMs = 30000;
  whaleMoney.listener(whaleMoney.state_object);
  assert.equal(nodes.fxRefreshBtn.textContent, '检查中…');
  assert.equal(nodes.fxRefreshBtn.disabled, true);

  whaleMoney.state_object.refreshing = false;
  whaleMoney.listener(whaleMoney.state_object);
  assert.equal(nodes.fxRefreshBtn.textContent, '30 秒后刷新');
  assert.equal(nodes.fxRefreshBtn.disabled, true);
  controls.dispose();
});

test('a manual refresh asks for a forced apply and reports the outcome', async t => {
  const { nodes, whaleMoney, events, controls } = fixture(t);
  nodes.fxRefreshBtn.fire('click');
  assert.deepEqual(whaleMoney.calls.refresh, [{ force: true, apply: true, reason: 'manual' }]);
  await Promise.resolve();
  assert.deepEqual(events.notices, ['参考汇率已检查，金额显示已同步']);
  controls.dispose();
});

test('a failed manual refresh says the usable rate is kept', async t => {
  const { nodes, whaleMoney, events, controls } = fixture(t);
  whaleMoney.refreshQuote = () => Promise.resolve(false);
  nodes.fxRefreshBtn.fire('click');
  await Promise.resolve();
  assert.deepEqual(events.notices, ['本次汇率检查未成功，继续使用可用汇率']);
  controls.dispose();
});

test('Escape and an outside pointer both close the rate note, resize just closes it', t => {
  const { nodes, documentStub, windowStub, controls } = fixture(t);
  nodes.fxInfoBtn.fire('click');
  assert.equal(nodes.currencyNote.hidden, false);
  assert.equal(nodes.fxInfoBtn.attributes['aria-expanded'], 'true');
  assert.equal(nodes.currencyNote.focused, 1, 'opening moves focus to the note');

  documentStub.fire('keydown', { key: 'Escape' });
  assert.equal(nodes.currencyNote.hidden, true);
  assert.equal(nodes.fxInfoBtn.attributes['aria-expanded'], 'false');
  assert.equal(nodes.fxInfoBtn.focused, 1, 'Escape returns focus to the button');

  nodes.fxInfoBtn.fire('click');
  documentStub.fire('pointerdown', { target: nodes.currencySel });
  assert.equal(nodes.currencyNote.hidden, true);

  nodes.fxInfoBtn.fire('click');
  windowStub.fire('resize');
  assert.equal(nodes.currencyNote.hidden, true);
  controls.dispose();
});

test('opening the note closes the other floating panels first', t => {
  const { nodes, events, controls } = fixture(t);
  nodes.fxInfoBtn.fire('click');
  assert.equal(events.closed, 2);
  controls.dispose();
});

test('the currency select reverts its own value and delegates the change', t => {
  const { nodes, whaleMoney, controls } = fixture(t);
  nodes.currencySel.value = 'USD';
  nodes.currencySel.fire('change');
  assert.equal(nodes.currencySel.value, 'CNY', 'the select snaps back to the applied currency');
  assert.deepEqual(whaleMoney.calls.setCurrency, ['USD']);
  controls.dispose();
});

test('the note marks a cached rate, a pending quote and an error without dropping any', t => {
  const { nodes, controls } = fixture(t, {
    hasPendingQuote: true, error: '网络不可用',
    latestQuote: { usdCny: 7.12, retrievedAt: '2026-10-10T02:00:00Z', stale: true, source: 'Frankfurter' },
  });
  const text = nodes.currencyNote.textContent;
  assert.match(text, /1 美元 = 7\.12 人民币/);
  assert.match(text, /离线缓存/);
  assert.match(text, /新汇率已就绪，下次打开或切换气泡时应用/);
  assert.match(text, /网络不可用/);
  assert.equal(text.includes('尚未成功获取'), false, 'a retrieved rate is formatted, not reported missing');
  assert.match(nodes.currencyNote.title, /Frankfurter/);
  controls.dispose();
});

test('dispose stops the per-second button refresh', t => {
  const { nodes, whaleMoney, controls } = fixture(t);
  whaleMoney.state_object.cooldownRemainingMs = 8000;
  t.mock.timers.tick(1000);
  assert.equal(nodes.fxRefreshBtn.textContent, '8 秒后刷新');
  controls.dispose();
  whaleMoney.state_object.cooldownRemainingMs = 0;
  t.mock.timers.tick(5000);
  assert.equal(nodes.fxRefreshBtn.textContent, '8 秒后刷新', 'no interval survives dispose');
});
