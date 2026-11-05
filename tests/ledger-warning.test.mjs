import test from 'node:test';
import assert from 'node:assert/strict';
import { createLedgerWarning } from '../desktop/ui/features/widget/ledger-warning.js';

function element(name) {
  return {
    name, children: [], className: '', textContent: '', type: '', removed: false,
    appendChild(child) { this.children.push(child); return child; },
    setAttribute(key, value) { this[key] = value; },
    addEventListener(event, fn) { this[event] = fn; },
    remove() { this.removed = true; },
    fire(event) { return this[event]?.({ preventDefault() {} }); },
  };
}

test('the ledger recovery notice is announced and can be dismissed once', async () => {
  const document = { createElement: element };
  let dismissed = 0;
  const notice = createLedgerWarning(document, { text: '账本文件损坏，已从上一份备份恢复。', onDismiss: () => { dismissed += 1; } });
  assert.equal(notice.className, 'notice dshwv-ledger-warning');
  assert.equal(notice.role, 'status');
  assert.equal(notice.children[0].textContent, '账本文件损坏，已从上一份备份恢复。');
  const button = notice.children[1];
  assert.equal(button.textContent, '知道了');
  await button.fire('click');
  assert.equal(notice.removed, true);
  assert.equal(dismissed, 1);
});
