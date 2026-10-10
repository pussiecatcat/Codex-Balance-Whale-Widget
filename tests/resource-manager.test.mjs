import test from 'node:test';
import assert from 'node:assert/strict';

import { createResourceManager } from '../desktop/ui/features/widget/resource-manager.js';

function element(tag = 'div') {
  const node = {
    tagName: tag, className: '', textContent: '', type: '', value: '', src: '', alt: '', disabled: false,
    style: {}, children: [], listeners: {},
    appendChild(child) { this.children.push(child); return child; },
    append(...nodes) { for (const item of nodes) this.children.push(item); },
    replaceChildren(...nodes) { this.children = [...nodes]; },
    get firstChild() { return this.children[0]; },
    get lastChild() { return this.children[this.children.length - 1]; },
    addEventListener(type, fn) { (this.listeners[type] = this.listeners[type] || []).push(fn); },
    fire(type, event = {}) { for (const fn of this.listeners[type] || []) fn({ stopPropagation() {}, target: this, ...event }); },
  };
  return node;
}

const flush = () => new Promise(resolve => setImmediate(resolve));

function fixture(catalogues = {}) {
  const created = [];
  const documentStub = { body: element('body'), createElement(tag) { const node = element(tag); created.push(node); return node; } };
  const calls = { confirmed: [], saved: [], errors: [], roles: [], images: [], groups: [], fragments: [], client: [] };
  const client = {
    roles: catalogues.roles || (() => Promise.resolve({ roles: [] })),
    bubbleImages: catalogues.bubbleImages || (() => Promise.resolve({ images: [] })),
    audio: catalogues.audio || (() => Promise.resolve({ groups: [], fragments: [] })),
    deleteRole: id => { calls.client.push(['role', id]); return catalogues.deleteRole ? catalogues.deleteRole(id) : Promise.resolve({ ok: true, roles: [] }); },
    deleteBubbleImage: id => { calls.client.push(['image', id]); return catalogues.deleteBubbleImage ? catalogues.deleteBubbleImage(id) : Promise.resolve({ ok: true, images: [] }); },
    deleteAudioGroup: id => { calls.client.push(['group', id]); return catalogues.deleteAudioGroup ? catalogues.deleteAudioGroup(id) : Promise.resolve({ ok: true, groups: [] }); },
    deleteAudioFragment: id => { calls.client.push(['fragment', id]); return catalogues.deleteAudioFragment ? catalogues.deleteAudioFragment(id) : Promise.resolve({ ok: true, fragments: [] }); },
  };
  const manager = createResourceManager({
    document: documentStub, client,
    confirm: (message, run) => calls.confirmed.push({ message, run }),
    requireSaved: data => calls.saved.push(data),
    onError: error => calls.errors.push(error),
    onRoleDelete: (id, data) => calls.roles.push([id, data]),
    onBubbleImageDelete: (id, data) => calls.images.push([id, data]),
    onAudioGroupDelete: (id, data) => calls.groups.push([id, data]),
    onAudioFragmentDelete: (id, data) => calls.fragments.push([id, data]),
  });
  const mask = () => created.find(node => node.className === 'dshwv-resmask');
  const card = () => created.find(node => node.className === 'dshwv-usage-card dshwv-rescard');
  const wrap = () => (card() ? card().children.find(child => child.className === 'dshwv-reswrap') : null);
  const inWrap = className => (wrap() ? wrap().children.filter(child => child.className === className) : []);
  const rows = () => inWrap('dshwv-resrow');
  const texts = () => rows().map(row => row.children.map(child => child.textContent).filter(Boolean).join('|'));
  const deleteButtonIn = row => row.children.find(child => child.className === 'dshwv-resdel');
  return { manager, calls, created, mask, card, wrap, inWrap, rows, texts, deleteButtonIn, client };
}

test('opening renders one row per catalogue entry under the two category headers', async () => {
  const fx = fixture({
    roles: () => Promise.resolve({ roles: [{ id: 'default', name: '小鲸鱼', url: '/a.png' }, { id: 'custom', name: '角色甲', url: '/b.png' }] }),
    bubbleImages: () => Promise.resolve({ images: [{ id: 'img_1', name: '泡泡图', builtin: false }] }),
    audio: () => Promise.resolve({ groups: [{ id: 'grp_1', name: '自定义组', press: 'A', release: 'B' }], fragments: [{ id: 'frag_1', name: '片段' }] }),
  });
  await fx.manager.open();
  assert.equal(fx.rows().length, 5, 'two roles, one image, one group, one fragment');
  const categories = fx.inWrap('dshwv-rescat').map(child => child.textContent);
  assert.deepEqual(categories, ['图片', '音频']);
  assert.equal(fx.mask().style.display, 'flex');
});

test('built-in art and preset groups cannot be deleted; custom ones can', async () => {
  const fx = fixture({
    roles: () => Promise.resolve({ roles: [{ id: 'default', name: '小鲸鱼' }, { id: 'custom', name: '角色甲' }] }),
    bubbleImages: () => Promise.resolve({ images: [{ id: 'img_builtin', name: '内置', builtin: true }] }),
    audio: () => Promise.resolve({ groups: [{ id: 'preset', name: '预设', preset: true }], fragments: [{ id: 'p', name: '预设片段', preset: true }] }),
  });
  await fx.manager.open();
  const rows = fx.rows();
  assert.equal(fx.deleteButtonIn(rows[0]).disabled, true, 'the default role');
  assert.equal(fx.deleteButtonIn(rows[1]).disabled, false, 'a custom role');
  assert.equal(fx.deleteButtonIn(rows[2]).disabled, true, 'a built-in bubble image');
  assert.equal(fx.deleteButtonIn(rows[3]).disabled, true, 'a preset sound group');
  assert.equal(rows.length, 4, 'preset fragments are not listed at all');
});

test('each empty catalogue says so instead of leaving a blank panel', async () => {
  const fx = fixture();
  await fx.manager.open();
  const empties = fx.inWrap('dshwv-resempty').map(child => child.textContent);
  assert.deepEqual(empties, ['暂无自定义图片(角色/泡泡图)', '暂无自定义音频(片段/音效组)']);
});

test('one failing catalogue empties only its own section', async () => {
  const fx = fixture({
    roles: () => Promise.reject(new Error('offline')),
    bubbleImages: () => Promise.resolve({ images: [{ id: 'img_1', name: '泡泡图' }] }),
  });
  await fx.manager.open();
  assert.equal(fx.rows().length, 1, 'the image that did load is still listed');
  assert.match(fx.texts()[0], /泡泡图/);
  // The image section shows the image, not the "nothing here" marker.
  const empties = fx.inWrap('dshwv-resempty').map(node => node.textContent);
  assert.deepEqual(empties, ['暂无自定义音频(片段/音效组)']);
});

test('deleting asks with a kind-specific warning, then routes the new catalogue back', async () => {
  const fx = fixture({
    roles: () => Promise.resolve({ roles: [{ id: 'default', name: '小鲸鱼' }, { id: 'custom', name: '角色甲' }] }),
    deleteRole: () => Promise.resolve({ ok: true, roles: [{ id: 'default', name: '小鲸鱼' }] }),
  });
  await fx.manager.open();
  fx.deleteButtonIn(fx.rows()[1]).fire('click');
  assert.equal(fx.calls.confirmed.length, 1);
  assert.match(fx.calls.confirmed[0].message, /删除角色「角色甲」/);
  assert.match(fx.calls.confirmed[0].message, /自动回退默认小鲸鱼/);

  await fx.calls.confirmed[0].run();
  await flush();
  assert.deepEqual(fx.calls.client, [['role', 'custom']]);
  assert.deepEqual(fx.calls.roles, [['custom', { ok: true, roles: [{ id: 'default', name: '小鲸鱼' }] }]]);
  assert.equal(fx.calls.saved.length, 1, 'the response is checked before being believed');
});

test('a delete response without the expected array is not reported as success', async () => {
  const fx = fixture({
    bubbleImages: () => Promise.resolve({ images: [{ id: 'img_1', name: '泡泡图' }] }),
    deleteBubbleImage: () => Promise.resolve({ ok: true }),
  });
  await fx.manager.open();
  fx.deleteButtonIn(fx.rows()[0]).fire('click');
  await fx.calls.confirmed[0].run();
  await flush();
  assert.deepEqual(fx.calls.images, [], 'no catalogue callback without an images array');
});

test('a rejected delete is reported through onError rather than swallowed', async () => {
  const fx = fixture({
    audio: () => Promise.resolve({ groups: [{ id: 'grp_1', name: '组' }], fragments: [] }),
    deleteAudioGroup: () => Promise.reject(new Error('nope')),
  });
  await fx.manager.open();
  fx.deleteButtonIn(fx.rows()[0]).fire('click');
  await fx.calls.confirmed[0].run();
  await flush();
  assert.equal(fx.calls.errors.length, 1);
  assert.equal(fx.calls.errors[0].message, 'nope');
});

test('closing hides the panel and a click on the mask itself closes it too', async () => {
  const fx = fixture();
  await fx.manager.open();
  fx.manager.close();
  assert.equal(fx.mask().style.display, 'none');

  await fx.manager.open();
  fx.mask().fire('click', { target: fx.mask() });
  assert.equal(fx.mask().style.display, 'none');
});
