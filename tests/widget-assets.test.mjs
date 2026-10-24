import test from 'node:test';
import assert from 'node:assert/strict';
import { createAssetClient } from '../desktop/ui/services/asset-client.js';

test('asset client requests explicit local catalogues and preserves upload payloads', async () => {
  const calls = [];
  const client = createAssetClient(async (url, options) => {
    calls.push([url, options]);
    return new Response(JSON.stringify({ ok: true, roles: [], groups: [], fragments: [], images: [], config: {} }));
  });
  assert.deepEqual((await client.roles()).roles, []);
  assert.deepEqual((await client.audio()).groups, []);
  assert.deepEqual((await client.bubbleImages()).images, []);
  assert.deepEqual((await client.bubbleConfig()).config, {});
  await client.saveBubbleConfig({ items: [{ kind: 'normal' }] });
  await client.uploadBubbleImage('a.png', 'data:image/png;base64,AA==');
  await client.uploadAudioFragment('a.wav', 'data:audio/wav;base64,AA==');
  assert.deepEqual(calls.slice(0, 4).map(([url, options]) => [url, options.cache]), [
    ['/dsh-whale/roles.json', 'no-store'], ['/dsh-whale/audio.json', 'no-store'],
    ['/dsh-whale/bubble-imgs.json', 'no-store'], ['/dsh-whale/bubble.json', 'no-store'],
  ]);
  assert.deepEqual(JSON.parse(calls[5][1].body), { action: 'upload', name: 'a.png', data: 'data:image/png;base64,AA==' });
  assert.deepEqual(JSON.parse(calls[6][1].body), { action: 'upload-fragment', name: 'a.wav', audio: 'data:audio/wav;base64,AA==' });
  await client.deleteRole('role-a');
  await client.deleteBubbleImage('image-a');
  await client.deleteAudioGroup('group-a');
  await client.deleteAudioFragment('fragment-a');
  assert.deepEqual(calls.slice(7).map(([url, options]) => [url, JSON.parse(options.body)]), [
    ['/dsh-whale/role-delete.json', { id: 'role-a' }],
    ['/dsh-whale/bubble-img-upload.json', { action: 'delete', id: 'image-a' }],
    ['/dsh-whale/audio.json', { action: 'delete-group', id: 'group-a' }],
    ['/dsh-whale/audio.json', { action: 'delete-fragment', id: 'fragment-a' }],
  ]);
});

test('asset client rejects malformed catalogues before views receive them', async () => {
  const client = createAssetClient(async () => new Response(JSON.stringify({ ok: true, roles: {}, images: null })));
  assert.equal(await client.roles(), null);
  assert.equal(await client.bubbleImages(), null);
});

test('asset requests preserve HTTP, business and cancellation failures', async () => {
  const http = createAssetClient(async () => new Response('{"error":"stale"}', { status: 409 }));
  await assert.rejects(http.roles(), error => error.kind === 'http' && error.status === 409);
  const business = createAssetClient(async () => new Response('{"ok":false,"error":"denied"}'));
  await assert.rejects(business.audio(), error => error.kind === 'business');
  const controller = new AbortController();
  const client = createAssetClient((_url, { signal }) => new Promise((_resolve, reject) => {
    signal.addEventListener('abort', () => reject(new Error('aborted')), { once: true });
  }), { signal: controller.signal });
  const pending = client.bubbleImages();
  controller.abort();
  await assert.rejects(pending, error => error.kind === 'aborted');
});
