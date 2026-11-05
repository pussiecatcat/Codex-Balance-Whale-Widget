import test from 'node:test';
import assert from 'node:assert/strict';
import { createConfirmDialog } from '../desktop/ui/features/widget/confirm-dialog.js';

function element(tag = 'div') {
  return {
    tagName: tag, className: '', textContent: '', type: '', style: {}, children: [], listeners: {},
    appendChild(child) { this.children.push(child); return child; },
    addEventListener(type, fn) { this.listeners[type] = fn; },
    click() { this.listeners.click?.({ stopPropagation() {} }); },
  };
}

test('the confirm dialog shows a label, runs once and clears its callback', () => {
  const document = { createElement: element, body: element('body') };
  const dialog = createConfirmDialog({ document });
  const no = dialog.mask.children[0].children[1].children[0];
  const yes = dialog.mask.children[0].children[1].children[1];
  assert.equal(dialog.mask.style.display, 'none');

  let runs = 0;
  dialog.show('删除这个模型？', () => { runs += 1; });
  assert.equal(dialog.mask.style.display, 'flex');
  assert.equal(dialog.mask.children[0].children[0].textContent, '删除这个模型？');
  assert.equal(yes.textContent, '删除');
  yes.click();
  assert.equal(runs, 1);
  assert.equal(dialog.mask.style.display, 'none');
  yes.click();
  assert.equal(runs, 1, 'the old callback is not kept');

  dialog.show('继续？', () => { runs += 10; });
  assert.equal(yes.textContent, '确定');
  no.click();
  assert.equal(runs, 1, 'cancel does not run the callback');
});
