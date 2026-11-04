import test from 'node:test';
import assert from 'node:assert/strict';
import { listProfiles, normalizePrices, profileFromCodex, requestJson } from '../runtime/provider-profile.mjs';

const response = (body, { status = 200, headers = {} } = {}) => new Response(typeof body === 'string' ? body : JSON.stringify(body), { status, headers: { 'content-type': 'application/json', ...headers } });

test('prices normalize legacy and canonical keys', () => {
  assert.deepEqual(normalizePrices({ input: 1, cached: 0.5, output: 2 }), { input: 1, cachedInput: 0.5, output: 2 });
  assert.deepEqual(normalizePrices({ cachedInput: 0.3, cache_write: 0.2 }), { cachedInput: 0.3, cacheWrite: 0.2 });
  assert.deepEqual(normalizePrices({ input: -1, cached: 'x' }), {});
});

test('the automatic Codex profile and DIY profiles share one shape', () => {
  const auto = profileFromCodex({ baseUrl: 'https://api.example', keySource: 'environment',
    setting: { provider: 'auto', currency: 'CNY', keyEnv: 'KEY', models: { m: { input: 1, cached: 0.5, output: 2 } } } });
  assert.equal(auto.auto, true);
  assert.equal(auto.currency, 'CNY');
  assert.equal(auto.endpointConfigured, true);
  assert.equal(Object.hasOwn(auto, 'endpoint'), false);
  assert.equal(JSON.stringify(auto).includes('KEY'), false, 'environment names stay out of the read model');
  assert.deepEqual(auto.prices.m, { input: 1, cachedInput: 0.5, output: 2 });
  const diy = { id: 'x', name: 'X', kind: 'balance', template: 'deepseek', currency: 'CNY', keyEnv: 'K',
    prices: { input: 1, cached: 0.5, output: 2 } };
  const list = listProfiles({ setting: {} }, [diy]);
  assert.equal(list[0].id, 'codex');
  assert.equal(list[1].id, 'x');
  assert.deepEqual(list[1].prices.X, { input: 1, cachedInput: 0.5, output: 2 });
  assert.equal(list[1].credential.configured, true);
  assert.equal(Object.hasOwn(list[1].credential, 'env'), false);
  assert.equal(Object.hasOwn(list[1], 'endpoint'), false);
});

test('requestJson applies the profile auth style', async () => {
  let seen;
  const capture = async (url, init) => { seen = { url, init }; return response({ ok: 1 }); };
  await requestJson({ url: 'https://x.test/a', key: 'k', auth: 'bearer', fetchImpl: capture });
  assert.equal(seen.init.headers.authorization, 'Bearer k');
  await requestJson({ url: 'https://x.test/a', key: 'k', auth: 'raw', fetchImpl: capture });
  assert.equal(seen.init.headers.authorization, 'k');
  await requestJson({ url: 'https://x.test/a', key: 'k', auth: 'query', fetchImpl: capture });
  assert.equal(seen.url, 'https://x.test/a?key=k');
});

test('requestJson classifies transport, HTTP, JSON and business failures', async () => {
  await assert.rejects(requestJson({ url: 'https://x', fetchImpl: async () => { const error = Error('aborted'); error.name = 'AbortError'; throw error; } }),
    error => error.code === 'TIMEOUT' && error.status === 504);
  await assert.rejects(requestJson({ url: 'https://x', fetchImpl: async () => response('no', { status: 401 }) }),
    error => error.code === 'AUTH' && error.status === 401);
  await assert.rejects(requestJson({ url: 'https://x', fetchImpl: async () => response('oops', { status: 500 }) }),
    error => error.code === 'HTTP_500' && error.status === 502);
  await assert.rejects(requestJson({ url: 'https://x', requireJsonContentType: true, fetchImpl: async () => response('page', { headers: { 'content-type': 'text/html' } }) }),
    error => error.code === 'NOT_JSON' && error.status === 502);
  await assert.rejects(requestJson({ url: 'https://x', fetchImpl: async () => response('{broken') }),
    error => error.code === 'NOT_JSON');
  await assert.rejects(requestJson({ url: 'https://x', fetchImpl: async () => response({ success: false }) }),
    error => error.code === 'API_ERROR');
});

test('callers can map failures to their own error type', async () => {
  const failure = await requestJson({ url: 'https://x', fetchImpl: async () => { throw Error('down'); },
    fail: (code, message) => Object.assign(new Error(message), { code, custom: true }) }).catch(error => error);
  assert.equal(failure.code, 'NETWORK');
  assert.equal(failure.custom, true);
});
