import test from 'node:test';
import assert from 'node:assert/strict';
import { createGifRoleDialog } from '../desktop/ui/features/widget/gif-role-dialog.js';

function element() {
  return {
    className: '', textContent: '', style: {}, value: '', children: [], listeners: {},
    appendChild(child) { this.children.push(child); return child; },
    addEventListener(type, fn) { this.listeners[type] = fn; },
    click() { this.listeners.click?.({}); },
  };
}

test('the GIF dialog previews and uploads an animated role, and hides on cancel', async () => {
  const document = { createElement: element, body: element() };
  const requests = [], imported = [];
  const dialog = createGifRoleDialog({
    document, requestJson: async (url, options) => { requests.push({ url, body: options.body }); return { ok: true, roles: [{ id: 'r1' }] }; },
    roleUrl: '/roles', roleManager: { useImported: roles => imported.push(roles) },
    requireSaved: value => value, assetFailure: error => { throw error; },
  });
  dialog.open('data:image/gif;base64,AA', 'a.gif', 'gif');
  assert.equal(dialog.mask.style.display, 'flex');
  assert.equal(dialog.mask.children[0].children[0].textContent, '导入 GIF 动图角色');
  const name = dialog.mask.children[0].children[3];
  name.value = ' 动图 ';
  const ok = dialog.mask.children[0].children[4].children[1];
  ok.click();
  await new Promise(resolve => setTimeout(resolve, 0));
  assert.deepEqual(requests[0], { url: '/roles', body: { name: '动图', image: 'data:image/gif;base64,AA', format: 'gif' } });
  assert.deepEqual(imported, [[{ id: 'r1' }]]);
  assert.equal(dialog.mask.style.display, 'none');

  dialog.open('data:image/apng;base64,BB', 'a.png', 'apng');
  assert.match(dialog.mask.children[0].children[0].textContent, /APNG/);
  dialog.mask.children[0].children[4].children[0].click();
  assert.equal(dialog.mask.style.display, 'none');
});
