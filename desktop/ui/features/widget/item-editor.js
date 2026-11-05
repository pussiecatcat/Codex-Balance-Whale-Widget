// The bubble item editor: open/close the per-step dialog and switch A/B
// bubbles. It reads the shared edit buffer through the state object and the
// late-bound overlay/render bindings through ctx.
export function createItemEditor(deps) {
  const { document, state, target, stepLabel, isChoice, choiceOptions, choiceWeight, ensureModules, rowsCanon, zClean, ctx } = deps;
    function openBubbleItem(idx, side) {
      try {
        zClean();
        var step = state.items[idx];
        if (!step) return;
        state.itemIdx = idx;
        if (!isChoice(step)) {
          state.itemSide = -1;
        } else {
          var want = side === 0 || side === 1 ? side : 0;
          if (!choiceOptions(step)[want]) want = 0;
          state.itemSide = want;
        }
        state.itemSnap = JSON.parse(JSON.stringify(step));
        var it = target();
        if (!it) return;
        ensureModules(it);
        rowsCanon(it.modules);
        ctx.itemTitleEl.textContent = '编辑 ' + stepLabel(step, idx) + '内容(可拖动下方模块入框)';
        renderBubbleItemSideSwitch(step);
        ctx.itemMask.style.display = 'flex';
        ctx.renderPal();
        ctx.renderPv();
      } catch (err) {}
    }
    function renderBubbleItemSideSwitch(step) {
      if (!ctx.itemSideEl) return;
      ctx.itemSideEl.innerHTML = '';
      if (!isChoice(step)) {
        ctx.itemSideEl.style.display = 'none';
        return;
      }
      ctx.itemSideEl.style.display = '';
      var opts = choiceOptions(step);
      for (var s = 0; s < opts.length && s < 2; s++) {
        (function (si) {
          var b = document.createElement('button');
          b.type = 'button';
          b.className = 'dshwv-bubchip dshwv-bubchip-btn' + (si === state.itemSide ? ' dshwv-bubchip-cur' : '');
          b.textContent = (si === 0 ? 'A' : 'B') + ' 泡(权重 ' + choiceWeight(opts[si]) + ')';
          b.title = '切换到编辑 ' + (si === 0 ? 'A' : 'B') + ' 泡';
          b.addEventListener('click', function (e) {
            e.stopPropagation();
            openBubbleItem(state.itemIdx, si);
          });
          ctx.itemSideEl.appendChild(b);
        })(s);
      }
    }
    function closeBubbleItem() {
      ctx.itemMask.style.display = 'none';
      state.itemIdx = -1;
      state.itemSide = -1;
      if (ctx.itemSideEl) ctx.itemSideEl.innerHTML = '';
    }
  return { openBubbleItem, renderBubbleItemSideSwitch, closeBubbleItem };
}
