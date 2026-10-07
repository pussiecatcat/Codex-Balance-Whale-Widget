(() => {
  'use strict';

  const controls = new Map();
  const usable = select => select instanceof HTMLSelectElement
    && !select.multiple
    && Number(select.size || 0) <= 1
    && !select.matches('[data-native-select]');

  function enhance(select) {
    if (!usable(select) || controls.has(select) || !window.WhaleSelect?.enhance) return;
    const control = window.WhaleSelect.enhance(select);
    if (control?.sync) controls.set(select, control);
  }

  function scan(root) {
    if (root instanceof HTMLSelectElement) enhance(root);
    root?.querySelectorAll?.('select').forEach(enhance);
  }

  function refreshOwner(node) {
    const select = node instanceof HTMLSelectElement ? node : node?.closest?.('select');
    const control = select && controls.get(select);
    if (control?.refresh) control.refresh();
  }

  scan(document);
  const observer = new MutationObserver(records => {
    records.forEach(record => {
      if (record.type === 'attributes') refreshOwner(record.target);
      record.addedNodes.forEach(node => {
        if (node.nodeType !== Node.ELEMENT_NODE) return;
        scan(node);
        refreshOwner(node);
      });
      refreshOwner(record.target);
    });
  });
  observer.observe(document.documentElement, {
    subtree: true,
    childList: true,
    attributes: true,
    attributeFilter: ['disabled', 'label'],
  });

  window.setInterval(() => {
    controls.forEach((control, select) => {
      if (!select.isConnected) {
        controls.delete(select);
        return;
      }
      control.sync();
    });
  }, 300);
})();
