// One dismissal surface for the ledger recovery notice. It is shown by both
// the compact usage panel and the full record window; the server keeps a
// marker until the user dismisses it, so a restart does not hide the fact that
// the last write may have been lost.
export function createLedgerWarning(document, { text, onDismiss } = {}) {
  const wrap = document.createElement('div');
  wrap.className = 'notice dshwv-ledger-warning';
  wrap.setAttribute('role', 'status');
  const label = document.createElement('span');
  label.textContent = text || '账本文件曾损坏，已从上一份备份恢复。';
  const dismiss = document.createElement('button');
  dismiss.type = 'button';
  dismiss.className = 'quiet';
  dismiss.textContent = '知道了';
  dismiss.addEventListener('click', () => {
    wrap.remove();
    onDismiss?.();
  });
  wrap.appendChild(label);
  wrap.appendChild(dismiss);
  return wrap;
}
