import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { createWidgetHost } from '../lib/widget-host.mjs';
import { createDispatcher } from '../runtime/dispatcher.mjs';
import { json, raw, text, empty, toResponse } from '../lib/route-response.mjs';

function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'whale-routes-'));
  t.after(() => {
    const resolved = path.resolve(root);
    assert.ok(resolved.startsWith(path.resolve(os.tmpdir()) + path.sep) && path.basename(resolved).startsWith('whale-routes-'));
    fs.rmSync(resolved, { recursive: true, force: true });
  });
  return root;
}

// The host declares its routes; nothing here runs a handler, so the service it
// is handed can stay empty.
function declarations(t, root = fixture(t)) {
  const found = new Map();
  createWidgetHost(root).apply({ whale: {}, declareRoute: d => { found.set(d.path, d); return () => {}; }, effect: () => {} });
  return found;
}

test('every route states the methods it answers and the handler is a function', t => {
  const routes = declarations(t);
  assert.equal(routes.size, 18, 'the host declares eighteen routes');
  for (const [route, declaration] of routes) {
    assert.equal(declaration.path, route);
    assert.ok(Array.isArray(declaration.methods) && declaration.methods.length, route + ' must state its methods');
    for (const method of declaration.methods) assert.match(method, /^(GET|HEAD|POST|PUT|DELETE)$/, route + ' declares an odd method');
    assert.equal(typeof declaration.handler, 'function', route + ' must carry a handler');
  }
});

test('a read route answers reads only, a write route answers writes, and a body route states its ceiling', t => {
  const routes = declarations(t);
  assert.deepEqual(routes.get('/dsh-whale/image.png').methods, ['GET', 'HEAD']);
  assert.deepEqual(routes.get('/dsh-whale/widget.js').methods, ['GET', 'HEAD']);
  assert.deepEqual(routes.get('/dsh-whale/last-turn.json').methods, ['GET', 'HEAD']);
  assert.deepEqual(routes.get('/dsh-whale/role-delete.json').methods, ['POST', 'PUT'], 'a route that mutates must not answer a read');
  assert.deepEqual(routes.get('/dsh-whale/role-pin.json').methods, ['POST', 'PUT']);
  assert.deepEqual(routes.get('/dsh-whale/bubble-img-upload.json').methods, ['POST', 'PUT']);
  assert.deepEqual(routes.get('/dsh-whale/roles.json').methods, ['GET', 'HEAD', 'POST', 'PUT']);

  for (const route of ['/dsh-whale/roles.json', '/dsh-whale/role-pin.json', '/dsh-whale/role-delete.json',
    '/dsh-whale/audio.json', '/dsh-whale/bubble.json', '/dsh-whale/bubble-img-upload.json']) {
    assert.ok(Number.isFinite(routes.get(route).bodyLimit) && routes.get(route).bodyLimit > 0, route + ' must state a body ceiling');
  }
  for (const route of ['/dsh-whale/image.png', '/dsh-whale/last-turn.json']) {
    assert.equal(routes.get(route).bodyLimit, undefined, route + ' takes no body, so it states no ceiling');
  }
});

test('only the route whose payload the migration filter owns asks for it', t => {
  const routes = declarations(t);
  const asking = [...routes.values()].filter(d => d.stripRetired).map(d => d.path);
  assert.deepEqual(asking, ['/dsh-whale/bubble.json']);
});

// The dispatcher is what enforces the declared contract, so these go through it.
function served(t) {
  const dataDir = fixture(t);
  const service = {
    config: { codexHome: dataDir, env: {}, publicInfo: () => ({}), resolve: () => ({ model: 'test', setting: {} }) },
    getBalance: async () => ({ ok: true, totalBalance: 1 }),
    usageRecords: () => ({ ok: true, records: [] }),
    lastTurn: () => ({ seq: 0 }),
  };
  const dispatcher = createDispatcher({ dataDir, service, monitor: false, autoRefresh: false });
  t.after(async () => { await dispatcher.close().catch(() => {}); });
  return dispatcher;
}

test('a method the route never declared is refused instead of being treated as a read', async t => {
  const dispatcher = served(t);
  assert.equal((await dispatcher.dispatch('/dsh-whale/image.png', { method: 'PUT' })).status, 405);
  assert.equal((await dispatcher.dispatch('/dsh-whale/roles.json', { method: 'DELETE' })).status, 405, 'a read used to fall through to the list');
  assert.equal((await dispatcher.dispatch('/dsh-whale/bubble-imgs.json', { method: 'POST', body: {} })).status, 405);
  assert.equal((await dispatcher.dispatch('/dsh-whale/role-delete.json', { method: 'GET' })).status, 405);
  assert.equal((await dispatcher.dispatch('/dsh-whale/image.png', { method: 'GET' })).status, 200, 'the declared method still works');
});

test('a body past the route ceiling is refused before the handler sees it', async t => {
  const dispatcher = served(t);
  const oversized = await dispatcher.dispatch('/dsh-whale/role-pin.json', { method: 'POST', body: Buffer.alloc(8193) });
  assert.equal(oversized.status, 413);
  assert.match(JSON.parse(oversized.body.toString()).error, /过大/);
  const within = await dispatcher.dispatch('/dsh-whale/role-pin.json', { method: 'POST', body: { id: 'missing' } });
  assert.notEqual(within.status, 413, 'a body inside the ceiling reaches the handler');
});

test('a declared HEAD answers like its GET minus the body', async t => {
  const dispatcher = served(t);
  const head = await dispatcher.dispatch('/dsh-whale/last-turn.json', { method: 'HEAD' });
  const get = await dispatcher.dispatch('/dsh-whale/last-turn.json', { method: 'GET' });
  assert.equal(head.status, get.status);
  assert.equal(head.headers['content-type'], get.headers['content-type']);
  assert.equal(head.body.length, 0);
  assert.ok(get.body.length > 0);
});

// One interpreter for every answer, so a route never decides its own headers and
// the tests that drive a host directly cannot drift from the dispatcher.
test('each kind of answer becomes the status, headers and body it names', () => {
  const ok = toResponse(json({ ok: true }));
  assert.equal(ok.status, 200);
  assert.equal(ok.headers['content-type'], 'application/json; charset=utf-8');
  assert.deepEqual(JSON.parse(ok.body.toString()), { ok: true });
  assert.equal(ok.headers['content-length'], String(ok.body.length));

  assert.equal(toResponse(json({ ok: false }, 400)).status, 400);

  const image = toResponse(raw(Buffer.alloc(9), 'image/png'));
  assert.equal(image.headers['content-type'], 'image/png');
  assert.equal(image.headers['content-length'], '9', 'the length is computed from the body, not stated per route');

  const script = toResponse(raw('const a = 1', 'application/javascript; charset=utf-8'));
  assert.equal(script.body.toString(), 'const a = 1', 'a string body is encoded for the caller');

  const missing = toResponse(text('sound unavailable'));
  assert.equal(missing.status, 404);
  assert.equal(missing.headers['content-type'], 'text/plain; charset=utf-8');
  assert.equal(missing.body.toString(), 'sound unavailable');

  const silent = toResponse(empty());
  assert.equal(silent.status, 204);
  assert.equal(silent.body.length, 0);
  assert.equal(silent.headers['content-type'], undefined, 'a bodyless answer states no type');

  const head = toResponse(raw(Buffer.alloc(9), 'image/png'), 'HEAD');
  assert.equal(head.body.length, 0, 'HEAD carries no body');
  assert.equal(head.headers['content-length'], '9', 'but keeps the length its GET would send');
});

test('a handler that forgets to answer is refused rather than answered emptily', () => {
  assert.throws(() => toResponse(undefined), /returned no response/);
  assert.throws(() => toResponse({ ok: true }), /returned no response/, 'a payload without a kind is not an answer');
});
