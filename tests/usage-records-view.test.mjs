import test from 'node:test';
import assert from 'node:assert/strict';

import { createUsageRecordsView } from '../desktop/ui/features/widget/usage-records-view.js';

function element(tag = 'div') {
  const node = {
    tagName: tag, className: '', textContent: '', title: '', type: '', value: '', placeholder: '',
    style: { props: {} }, children: [], listeners: {}, scrollHeight: 40, offsetHeight: 40, _html: '',
    set innerHTML(value) { this._html = value; if (value === '') this.children = []; },
    get innerHTML() { return this._html; },
    classList: { set: new Set(), add(name) { this.set.add(name); }, remove(name) { this.set.delete(name); }, contains(name) { return this.set.has(name); } },
    appendChild(child) { this.children.push(child); return child; },
    setAttribute() {}, removeAttribute() {},
    addEventListener(type, fn) { (this.listeners[type] = this.listeners[type] || []).push(fn); },
    fire(type, event = {}) { for (const fn of this.listeners[type] || []) fn({ stopPropagation() {}, preventDefault() {}, target: this, ...event }); },
    querySelector() { return null; },
    querySelectorAll() { return []; },
    getBoundingClientRect() { return { width: 300, height: 40, top: 0, bottom: 40 }; },
    focus() {},
  };
  node.style.setProperty = (name, value) => { node.style.props[name] = value; };
  return node;
}

function fixture() {
  const created = [];
  const card = element();
  const calls = { closed: 0, binds: [] };
  const view = createUsageRecordsView({
    document: {
      createElement(tag) { const node = element(tag); created.push(node); return node; },
      addEventListener() {}, removeEventListener() {},
    },
    card,
    close: () => { calls.closed++; },
    bindUsageMoney: node => calls.binds.push(node),
    usageMoney: () => '0.00',
    usageMoneyText: () => '0.00',
    usageAggModels: () => [],
    usageRatioRows: () => [],
    usageDrawBarChart: () => {},
    usageTodayKeyStr: () => '2026-10-11',
    WhaleMoney: {
      clearBindings() {}, bind() {}, formatMoney: value => String(value),
      formatNumber: value => String(value), convert: value => value, state: () => ({}),
      onChange: () => () => {},
    },
    getCurrency: () => 'USD',
  });
  const body = () => card.children.find(node => node.className === 'dshwv-usage-windowbody');
  return { view, card, created, calls, body };
}

test('the modal always opens with its title, close button and body', () => {
  const fx = fixture();
  fx.card.children.push(element('div'));
  fx.view.fill(null);
  assert.equal(fx.card.children.length, 3, 'the previous contents are cleared first');
  assert.equal(fx.card.children[0].textContent, 'API 消费记录');
  const close = fx.card.children[1];
  assert.equal(close.textContent, '×');
  close.fire('click');
  assert.equal(fx.calls.closed, 1, 'the close button is wired to the caller');
});

test('a payload that is missing or not ok says so instead of rendering empty', () => {
  for (const payload of [null, undefined, {}, { ok: false }, { ok: false, all: { days: [] } }]) {
    const fx = fixture();
    fx.view.fill(payload);
    assert.equal(fx.body().textContent, '加载失败', JSON.stringify(payload));
  }
});

test('an ok payload with no days renders rather than reporting failure', () => {
  const fx = fixture();
  fx.view.fill({ ok: true, all: { days: [], events: [] }, recent: [], today: {} });
  assert.notEqual(fx.body().textContent, '加载失败');
  assert.ok(fx.body().children.length > 0, 'the body is populated');
});

test('a day of records builds its detail block lazily, and that block can filter', () => {
  const fx = fixture();
  fx.view.fill({
    ok: true,
    all: { days: [{ date: '2026-10-10', total: 1.25, events: [] }], events: [] },
    recent: [{ date: '2026-10-10', total: 1.25 }],
    today: { total: 0.5 },
  });
  const headers = fx.created.filter(node => node.className === 'dshwv-usage-collapse');
  assert.equal(headers.length, 2, 'the charts block and the daily detail block');
  assert.equal(fx.created.some(node => node.className === 'dshwv-colnat'), false,
    'the detail body is not built until the block is opened');

  headers[1].fire('click');
  const search = fx.created.find(node => node.className === 'dshwv-colnat');
  assert.ok(search, 'opening the block builds its filter field');
  assert.match(search.placeholder, /搜索:日期/);
  assert.equal(search.style.width, '100%');
});
