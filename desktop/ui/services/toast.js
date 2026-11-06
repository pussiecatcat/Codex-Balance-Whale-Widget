// The widget's single transient message surface. It used to live beside the
// API settings form, which is gone.
export function createToast({ document, timeoutMs = 6000 }) {
  let timer;
  return function toast(message) {
    const node = document.getElementById('toast');
    if (!node) return;
    node.textContent = message;
    node.hidden = false;
    clearTimeout(timer);
    timer = setTimeout(() => {
      const current = document.getElementById('toast');
      if (current) current.hidden = true;
    }, timeoutMs);
  };
}
