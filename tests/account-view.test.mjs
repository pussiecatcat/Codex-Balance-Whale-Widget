import test from 'node:test';
import assert from 'node:assert/strict';
import { windowText, tokenText, noticeText, quotaLabel, createAccountView } from '../desktop/ui/features/widget/account-view.js';

test('quota periods remain distinct regardless of incoming label',()=>{
  assert.equal(quotaLabel({windowDurationMins:300,label:'primary'}),'5 小时额度');
  assert.equal(quotaLabel({windowDurationMins:10080,label:'secondary'}),'每周额度');
  assert.equal(quotaLabel({windowDurationMins:60,label:'独立窗口'}),'独立窗口');
});

test('missing snapshot values never become zero quota or tokens', () => {
  for (const value of [null, undefined, NaN, Infinity, -1, '50']) {
    assert.equal(windowText({ usedPercent: value }), '额度比例未知');
    assert.equal(tokenText(value), '暂无记录');
  }
  assert.match(windowText({ usedPercent: 25.5, stale: true }), /已用 25.5% · 剩余 74.5%（快照已过期）/);
  assert.equal(tokenText(0), '0 token');
});
test('subscription failure consumption displays tokens without API money or fun failure text', () => {
  assert.equal(noticeText({ completionKind: 'failed', tokens: 10, amount: 5 }), '本轮本机已观测：10 token');
  assert.equal(noticeText({ completionKind: 'failed', failureKind: 'high-demand' }), '挤不进去...');
  assert.equal(noticeText({ completionKind: 'completed', tokens: 10, amount: 5 }), '本轮本机已观测：10 token');
});
function runtime(request) {
  const storage = new Map(); const modes = []; const toasts = [];
  const document = { documentElement: { dataset: {} }, readyState: 'loading', addEventListener() {}, querySelectorAll() { return []; } };
  const window = { addEventListener() {} };
  const api = createAccountView({
    document, window, request,
    storage: { getItem(k) { return storage.get(k); }, setItem(k, v) { storage.set(k, v); } },
    toast: message => toasts.push(message)
  });
  api.subscribe(mode => modes.push(mode));
  return { api, storage, modes, toasts };
}
test('subscription completion and cancellation report tokens without an open card or API money',async()=>{
  const r=runtime(async(_url,options={})=>options.body||{});
  await r.api.setMode('api');
  r.api.notice({completionKind:'success',tokens:12,amount:100});assert.equal(r.toasts.length,0);
  await r.api.setMode('subscription');
  r.api.notice({completionKind:'success',tokens:12480,amount:100,currency:'USD'});
  r.api.notice({completionKind:'cancelled',tokens:12,amount:10});
  r.api.notice({completionKind:'success',tokens:12,notify:false});
  const messages = r.toasts;
  assert.equal(messages.length,2);assert.match(messages[0],/12,480 token/);assert.match(messages[1],/12 token/);
  assert.ok(messages.every(m=>!/[\$¥]|USD|API/.test(m)));
});
test('a rejected save preserves mode and does not emit false switch events', async () => {
  for (const request of [async () => ({ ok: false }), async () => ({ mode: 'subscription' }), async () => { throw Error('offline'); }]) {
    const { api, storage, modes } = runtime(request);
    assert.equal(await api.setMode('api'), false);
    assert.equal(api.mode, 'subscription'); assert.equal(storage.size, 0); assert.equal(modes.length, 0);
  }
});
test('successful switches persist display mode only after server acknowledgement', async () => {
  let resolve; let request;
  const { api, storage, modes } = runtime((url, options) => { request = { url, options }; return new Promise(r => { resolve = r; }); });
  const pending = api.setMode('api');
  assert.equal(api.mode, 'subscription'); assert.equal(storage.size, 0);
  assert.equal(await api.setMode('subscription'), false);
  resolve({ mode: 'api' });
  assert.equal(await pending, true); assert.equal(api.mode, 'api');
  assert.equal(storage.get('dshw-account-view'), 'api');
  assert.equal(request.url, '/api/display-mode'); assert.equal(request.options.body.mode, 'api');
  assert.equal(modes[0], 'api');
});
