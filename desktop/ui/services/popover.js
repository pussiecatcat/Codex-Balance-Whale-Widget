// One manager for the widget's own dropdowns and help popovers. This is not the
// global blank-space close that docs/OUTSIDE-CLICK-DECISION.md rejects: the menu
// and the bubble keep their current boundaries.
export function createPopoverManager({ document, scope }) {
  const stack = [];
  const close = entry => {
    const index = stack.indexOf(entry);
    if (index < 0) return;
    stack.splice(index).reverse().forEach(item => item.close());
  };
  const onPointer = event => {
    const top = stack.at(-1);
    if (top && !top.element.contains(event.target) && !top.anchor?.contains(event.target)) close(top);
  };
  const onKey = event => {
    if (event.key === 'Escape' && stack.length) {
      event.stopPropagation();
      close(stack.at(-1));
    }
  };
  scope.on(document, 'pointerdown', onPointer, true);
  scope.on(document, 'keydown', onKey, true);
  return {
    open({ element, anchor, onClose }) {
      const entry = { element, anchor, close: () => onClose?.() };
      stack.push(entry);
      return () => close(entry);
    },
    closeAll() { stack.splice(0).reverse().forEach(entry => entry.close()); },
  };
}
