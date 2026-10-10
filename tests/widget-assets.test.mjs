import test from 'node:test';
import assert from 'node:assert/strict';
import { createAssetClient } from '../desktop/ui/features/widget/asset-client.js';

test('asset client requests explicit local catalogues and preserves upload payloads', async () => {
  const calls = [];
  const client = createAssetClient(async (url, options) => {
    calls.push([url, options]);
    return { json: async () => ({ ok: true, roles: [], groups: [], fragments: [], images: [], config: {} }) };
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
  const client = createAssetClient(async () => ({ json: async () => ({ ok: true, roles: {}, images: null }) }));
  assert.equal(await client.roles(), null);
  assert.equal(await client.bubbleImages(), null);
});
