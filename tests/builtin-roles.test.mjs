import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createWidgetHost } from '../lib/widget-host.mjs';
import { toResponse } from '../lib/route-response.mjs';
import { exportWorkshop } from '../lib/workshop.mjs';
import { validateImage } from '../lib/media-validation.mjs';
import { BUILTIN_ROLES } from '../lib/builtin-roles.mjs';

function host(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'whale-builtin-roles-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const routes = new Map();
  createWidgetHost(root, { fs }).apply({ whale: {}, declareRoute: declaration => { routes.set(declaration.path, declaration); return () => {}; }, effect: () => {} });
  return { root, async request(route, method = 'GET', body) {
    const req = { url: route, method, body: body === undefined ? Buffer.alloc(0) : Buffer.from(JSON.stringify(body)) };
    const response = toResponse(await routes.get(route.split('?')[0]).handler(req), method);
    let payload; try { payload = JSON.parse(response.body); } catch {}
    return { ...response, payload };
  } };
}

test('shipped role files exist and match their declared metadata', () => {
  for (const role of BUILTIN_ROLES) {
    const bytes = fs.readFileSync(new URL('../assets/' + role.file, import.meta.url));
    const media = validateImage(bytes);
    for (const key of ['format', 'width', 'height', 'frames']) assert.equal(media[key], role[key], role.id + ' ' + key);
  }
});

test('a fresh install lists the built-in roles and serves their images', async t => {
  const app = host(t);
  const listed = (await app.request('/dsh-whale/roles.json')).payload.roles;
  for (const role of BUILTIN_ROLES) {
    const entry = listed.find(item => item.id === role.id);
    assert.ok(entry, role.id + ' is listed');
    assert.equal(entry.name, role.name);
    assert.equal(entry.builtin, true);
    const image = await app.request(entry.url);
    assert.equal(image.status, 200);
    assert.deepEqual(Buffer.from(image.body), fs.readFileSync(new URL('../assets/' + role.file, import.meta.url)));
  }
  assert.equal(listed.find(item => item.id === 'default').builtin, true);
});

test('built-in roles cannot be deleted, and stay out of the media pack', async t => {
  const app = host(t);
  const [role] = BUILTIN_ROLES;
  const removed = await app.request('/dsh-whale/role-delete.json', 'POST', { id: role.id });
  assert.equal(removed.status, 400);
  assert.ok((await app.request('/dsh-whale/roles.json')).payload.roles.some(item => item.id === role.id));
  // Pinning writes roles.json with the built-in entry in it; export must still skip it.
  const pinned = await app.request('/dsh-whale/role-pin.json', 'POST', { id: role.id, pinned: true });
  assert.equal(pinned.payload.ok, true);
  const pack = exportWorkshop(app.root);
  assert.equal(pack.roles.some(item => item.id === role.id), false);
});
