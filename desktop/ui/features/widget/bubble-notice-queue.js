// Priority queue for wait, cost, and alert bubbles. Rendering stays in the
// scene controller; this module owns queue order, current item, and wake timer.
export function createBubbleNoticeQueue({ canShow, isBlocked, rejectWithoutCurrent, isVisible, showItem }) {
  let queue = [];
  let current = null;
  let timer = null;
  function clearTimer() {
    if (timer) clearTimeout(timer);
    timer = null;
  }
  const controller = {
    get current() { return current; },
    clear() { queue = []; current = null; clearTimer(); },
    removeWait(id) {
      queue = queue.filter(item => !(item?.kind === 'wait' && (!id || item.id === id)));
    },
    push(item) {
      if (!canShow() || !item?.kind) return false;
      if (item.kind === 'wait') {
        controller.removeWait();
        if (current?.kind === 'wait') {
          current = item;
          showItem(item);
          return true;
        }
        if (current) queue.unshift(current);
        current = item;
        showItem(item);
        return true;
      }
      if (rejectWithoutCurrent() && !current) return false;
      const rank = Number(item.rank);
      item.rank = rank >= 1 ? rank : 2;
      let position = queue.findIndex(queued => queued.rank > item.rank);
      if (position < 0) position = queue.length;
      queue.splice(position, 0, item);
      clearTimer();
      timer = setTimeout(controller.tick, 30);
      return true;
    },
    tick() {
      timer = null;
      if (!canShow()) { queue = []; current = null; return; }
      if (current || !queue.length || isBlocked()) return;
      const item = queue.shift();
      if (!item) return;
      current = item;
      showItem(item);
    },
    done() {
      current = null;
      clearTimer();
      controller.tick();
    },
    swapNext() {
      if (!queue.length || !canShow() || !isVisible()) return false;
      const item = queue.shift();
      if (!item) return false;
      current = item;
      showItem(item);
      return true;
    },
  };
  return controller;
}
