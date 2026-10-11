import test from 'node:test';
import assert from 'node:assert/strict';

import { createRoleManager } from '../desktop/ui/features/widget/role-manager.js';

// apply() resolves through an inner promise chain and load()/useImported() do not
// await it, so a single microtask tick is not enough to observe the result.
const flush = () => new Promise(resolve => setImmediate(resolve));

function element() {
  const node = {
    className: '', textContent: '', title: '', src: '', alt: '', type: '', draggable: false,
    style: {}, children: [], listeners: {}, _html: '',
    set innerHTML(value) { this._html = value; if (value === '') this.children = []; },
    get innerHTML() { return this._html; },
    classList: {
      set: new Set(),
      add(name) { this.set.add(name); },
      remove(name) { this.set.delete(name); },
      contains(name) { return this.set.has(name); },
    },
    getBoundingClientRect() { return { width: 240, left: 100, bottom: 300, top: 260 }; },
    appendChild(child) { this.children.push(child); return child; },
    addEventListener(type, fn) { (this.listeners[type] = this.listeners[type] || []).push(fn); },
    click() { for (const fn of this.listeners.click || []) fn({ stopPropagation() {} }); },
  };
  return node;
}

const IMAGE_URL = '/dsh-whale/image.png?v=2';

function fixture({ roles = [], saved = '', roleData = null, failUrls = [] } = {}) {
  const failing = new Set(failUrls);
  const storage = new Map(saved ? [['dshw-role', saved]] : []);
  const calls = { notices: [], warnings: [], failures: [], hitTests: [], presented: 0 };

  class FakeImage {
    constructor() { this.src = ''; this.complete = false; this.naturalWidth = 0; }
    decode() { return failing.has(this.src) ? Promise.reject(new Error('decode failed')) : Promise.resolve(); }
  }

  const imageElement = { src: IMAGE_URL, currentSrc: IMAGE_URL, complete: true, naturalWidth: 64 };
  const rolePanel = element();
  const roleButtonLabel = element();
  const roleButton = element();
  const managerWindow = {
    listeners: {},
    addEventListener(type, fn) { (this.listeners[type] = this.listeners[type] || []).push(fn); },
    fire(type) { for (const fn of this.listeners[type] || []) fn(); },
    fetch: () => Promise.reject(new Error('unused')),
  };

  const manager = createRoleManager({
    document: { createElement: () => element() },
    window: managerWindow,
    localStorage: {
      getItem: key => (storage.has(key) ? storage.get(key) : null),
      setItem: (key, value) => storage.set(key, value),
    },
    location: { href: 'whale://widget/widget.html' },
    Image: FakeImage,
    rendering: {
      hitCache: { prepare: url => (failing.has(url) ? Promise.reject(new Error('prepare failed')) : Promise.resolve()) },
      presentFor: () => { calls.presented++; },
    },
    imageElement, roleButton, roleButtonLabel, rolePanel, imageUrl: IMAGE_URL,
    assetClient: { roles: () => Promise.resolve(roleData) },
    assetWarning: data => calls.warnings.push(data),
    assetNotice: message => calls.notices.push(message),
    assetFailure: error => calls.failures.push(error),
    requireSaved: () => {},
    viewport: () => ({ w: 1000, h: 800 }),
    setupHitTest: url => calls.hitTests.push(url),
    makeNameCell: (className, text) => { const node = element(); node.className = className; node.textContent = text; return node; },
    bindNameMarquee: () => {},
    confirm: () => {},
  });
  return { manager, calls, storage, imageElement, rolePanel, roleButtonLabel, roleButton, managerWindow };
}

const SAVED_ROLES = [{ id: 'default', name: '小鲸鱼', url: IMAGE_URL },
  { id: 'role_saved', name: '存档角色', url: '/dsh-whale/role-image.png?id=role_saved' }];

test('applying a role makes it current, loads its image and persists the choice', async () => {
  const { manager, calls, storage, imageElement, roleButtonLabel } = fixture();
  const ok = await manager.apply('role_a', '角色甲', '/dsh-whale/role-image.png?id=role_a');
  assert.equal(ok, true);
  assert.deepEqual(manager.current(), { id: 'role_a', name: '角色甲', url: '/dsh-whale/role-image.png?id=role_a' });
  assert.equal(imageElement.src, '/dsh-whale/role-image.png?id=role_a');
  assert.equal(roleButtonLabel.textContent, '角色甲');
  assert.equal(storage.get('dshw-role'), 'role_a');
  assert.deepEqual(calls.hitTests, ['/dsh-whale/role-image.png?id=role_a']);
  assert.equal(calls.presented, 1);
  assert.deepEqual(calls.notices, []);
});

test('a failed apply says the original role is kept and does not make it current', async () => {
  const { manager, calls } = fixture({ failUrls: ['/dsh-whale/role-image.png?id=role_b'] });
  const ok = await manager.apply('role_b', '角色乙', '/dsh-whale/role-image.png?id=role_b');
  assert.equal(ok, false);
  assert.deepEqual(calls.notices, ['角色图片无法读取，已保留原角色']);
  assert.equal(manager.current().id, 'default');
});

test('a failed fallback to the built-in whale reports the built-in art itself failed', async () => {
  const { manager, calls } = fixture({ failUrls: [IMAGE_URL] });
  const ok = await manager.apply('default', '小鲸鱼', IMAGE_URL, true);
  assert.equal(ok, false);
  assert.deepEqual(calls.notices, ['内置小鲸鱼图片加载失败，请重启挂件或重新安装']);
});

// recover() is not exported: the module wires it to the whale-role-fallback
// event, so the test fires that event rather than reaching past the interface.
// It also returns early while the element still reports a usable image, so the
// element has to look broken for the fallback path to run at all.
test('the fallback event switches back to the whale only when a custom image is showing', async () => {
  const showing = fixture();
  showing.imageElement.complete = false;
  showing.imageElement.naturalWidth = 0;
  showing.imageElement.currentSrc = '/dsh-whale/role-image.png?id=broken';
  showing.imageElement.src = '/dsh-whale/role-image.png?id=broken';
  showing.managerWindow.fire('whale-role-fallback');
  await flush();
  assert.equal(showing.manager.current().id, 'default');
  assert.deepEqual(showing.calls.notices,
    ['原角色图片无法显示，已切回小鲸鱼；可在角色菜单重新选择']);

  const alreadyBuiltIn = fixture();
  alreadyBuiltIn.imageElement.complete = false;
  alreadyBuiltIn.imageElement.naturalWidth = 0;
  alreadyBuiltIn.managerWindow.fire('whale-role-fallback');
  await flush();
  assert.deepEqual(alreadyBuiltIn.calls.notices, ['内置小鲸鱼图片加载失败，请重启挂件或重新安装']);
});

test('the fallback event does nothing while the image still reports as usable', async () => {
  const { managerWindow, calls, manager } = fixture();
  managerWindow.fire('whale-role-fallback');
  await flush();
  assert.deepEqual(calls.notices, []);
  assert.equal(manager.current().id, 'default');
});

test('loading restores a saved role', async () => {
  const { manager } = fixture({ saved: 'role_saved', roleData: { ok: true, roles: SAVED_ROLES } });
  manager.load();
  await flush();
  assert.equal(manager.current().id, 'role_saved');
});

test('loading falls back to the whale when the saved role is gone, and records that', async () => {
  const { manager, storage } = fixture({ saved: 'role_deleted', roleData: { ok: true, roles: SAVED_ROLES } });
  manager.load();
  await flush();
  assert.equal(manager.current().id, 'default');
  assert.equal(storage.get('dshw-role'), 'default', 'falling back also updates the stored preference');
});

test('a saved role already current is reused rather than reloaded', async () => {
  const { manager, calls } = fixture({ saved: 'role_saved', roleData: { ok: true, roles: SAVED_ROLES } });
  await manager.apply('role_saved', '存档角色', '/dsh-whale/role-image.png?id=role_saved');
  const presented = calls.presented;
  manager.load();
  await flush();
  assert.equal(calls.presented, presented, 'no second present');
  assert.equal(manager.current().id, 'role_saved');
});

test('deleting another role leaves the current one alone', async () => {
  const { manager } = fixture();
  await manager.apply('role_a', '角色甲', '/dsh-whale/role-image.png?id=role_a');
  manager.handleDeleted('role_b', [{ id: 'default', name: '小鲸鱼', url: IMAGE_URL }]);
  assert.equal(manager.current().id, 'role_a');
});

test('deleting the current role falls back to the whale', async () => {
  const { manager } = fixture();
  await manager.apply('role_a', '角色甲', '/dsh-whale/role-image.png?id=role_a');
  manager.handleDeleted('role_a', [{ id: 'default', name: '小鲸鱼', url: IMAGE_URL }]);
  await flush();
  assert.equal(manager.current().id, 'default');
});

test('importing a pack selects its newest non-default role', async () => {
  const { manager } = fixture();
  manager.useImported([
    { id: 'default', name: '小鲸鱼', createdAt: 99 },
    { id: 'old', name: '旧角色', createdAt: 1 },
    { id: 'new', name: '新角色', createdAt: 5 },
  ]);
  await flush();
  assert.equal(manager.current().id, 'new');
  assert.equal(manager.roles().length, 3);
});

test('rendering marks the current role, tags animations and hides delete on the whale', async () => {
  const { manager, rolePanel } = fixture();
  manager.replace([
    { id: 'default', name: '小鲸鱼', url: IMAGE_URL },
    { id: 'role_gif', name: '动图角色', url: '/dsh-whale/role-image.png?id=role_gif', format: 'apng', pinned: true },
  ]);
  await manager.apply('role_gif', '动图角色', '/dsh-whale/role-image.png?id=role_gif');
  const items = rolePanel.children;
  assert.equal(items.length, 2);
  assert.match(items[0].className, /^dshwv-roleitem$/, 'the whale is not marked current');
  assert.match(items[1].className, /dshwv-roleitem-cur/);
  assert.equal(items[1].children[1].children[0].textContent, 'APNG');
  assert.equal(items[1].children[2].title, '取消置顶');
  assert.equal(items[1].children[3].className, 'dshwv-roledel');
  assert.equal(items[0].children.length, 3, 'the whale has no delete button');
});

test('the panel toggles open and closed against the viewport', () => {
  const { manager, rolePanel } = fixture();
  manager.toggle();
  assert.equal(rolePanel.classList.contains('dshwv-rolelist-open'), true);
  assert.equal(rolePanel.style.display, 'block');
  assert.equal(rolePanel.style.width, '240px');
  assert.equal(rolePanel.style.left, '100px');
  assert.equal(rolePanel.style.top, '306px');
  manager.toggle();
  assert.equal(rolePanel.classList.contains('dshwv-rolelist-open'), false);
  assert.equal(rolePanel.style.display, 'none');
});
