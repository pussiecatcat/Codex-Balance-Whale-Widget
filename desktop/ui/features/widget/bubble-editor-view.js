import { bubbleIsChoice, bubbleChoiceOptions, bubbleChoiceWeight, bubbleRowLabel } from './default-content.js';
import { addBubbleStep, deleteBubbleStep, moveBubbleStep, reorderBubbleStep, splitBubbleChoiceSide,
  pairBubbleSteps, replaceBubbleChoiceSide, moveBubbleStepToEnd, unpairBubbleStep } from './bubble-editor-commands.js';

// Owns list rendering and the drag gesture; draft mutations live in commands.
export function bubbleDropShadow(zone) {
  return { before: '0 -3px 0 #203170', after: '0 3px 0 #203170',
    pairL: 'inset 3px 0 0 #203170', pairR: 'inset -3px 0 0 #203170' }[zone] || '';
}

export function bubbleDropZone(rowBounds, contentBounds, point, allowPair = true) {
  if (!rowBounds?.width || !Number.isFinite(point?.x) || !Number.isFinite(point?.y)) return '';
  const sortBand = Math.min(rowBounds.height / 2, Math.max(12, rowBounds.height * .24));
  if (point.y <= rowBounds.top + sortBand) return 'before';
  if (point.y >= rowBounds.bottom - sortBand) return 'after';
  if (allowPair && contentBounds?.width) {
    const pad = Math.max(8, Math.min(14, contentBounds.width * .04));
    const left = Math.max(rowBounds.left, contentBounds.left - pad);
    const right = Math.min(rowBounds.right, contentBounds.right + pad);
    if (point.x >= left && point.x <= right) {
      return point.x < contentBounds.left + contentBounds.width / 2 ? 'pairL' : 'pairR';
    }
  }
  return point.y < rowBounds.top + rowBounds.height / 2 ? 'before' : 'after';
}

function bubbleDropLabel(zone, replacing = false) {
  return { before: '排到前面', after: '排到后面',
    pairL: replacing ? '替换 A' : '放到 A',
    pairR: replacing ? '替换 B' : '放到 B' }[zone] || '';
}

export function createBubbleEditorView({ document, getItems, getFirstChip, getMoreList, openItem, confirm }) {
  let dragIndex = null, dragSide = -1, dropZone = '', dropRow = null;
  let keyboardDrag = null;
  const liveRegion = document.createElement('div');
  liveRegion.className = 'dshwv-sr-only';
  liveRegion.setAttribute('role', 'status');
  liveRegion.setAttribute('aria-live', 'polite');
  liveRegion.setAttribute('aria-atomic', 'true');
  document.body?.appendChild(liveRegion);
  function announce(message) { liveRegion.textContent = message; }
  function rows() { return Array.from(getMoreList()?.children || []); }
  function rowAt(index) { return rows().find(row => Number(row.getAttribute?.('data-i') ?? row.attributes?.['data-i']) === index); }
  function handleAt(index, side = -1) {
    const row = rowAt(index);
    if (!row) return null;
    if (side < 0) return Array.from(row.children || []).find(child =>
      String(child.className || '').split(/\s+/).includes('dshwv-bubdrag') &&
      !String(child.className || '').split(/\s+/).includes('dshwv-choice-drag')) || null;
    const wrap = Array.from(row.children || []).find(child => child.className === 'dshwv-choicerow');
    const groups = Array.from(wrap?.children || []).filter(child => child.className === 'dshwv-choicegrp');
    return Array.from(groups[side]?.children || []).find(child =>
      String(child.className || '').split(/\s+/).includes('dshwv-choice-drag')) || null;
  }
  function focusHandle(index, side = -1) { handleAt(index, side)?.focus?.(); }
  function rowZone(row, event, allowPair = true) {
    const bounds = row.getBoundingClientRect();
    const content = row.querySelector?.('.dshwv-choicerow') || row.querySelector?.('.dshwv-bubchip');
    return bubbleDropZone(bounds, content?.getBoundingClientRect?.(),
      { x: event.clientX, y: event.clientY }, allowPair);
  }
  function clearDropHint() {
    if (dropRow) {
      dropRow.style.boxShadow = '';
      dropRow.removeAttribute('data-drop-zone');
      dropRow.removeAttribute('data-drop-label');
      dropRow.removeAttribute('aria-label');
    }
    dropRow = null;
    dropZone = '';
  }
  function clearKeyboardDrag(message = '') {
    if (keyboardDrag?.handle) keyboardDrag.handle.setAttribute('aria-pressed', 'false');
    keyboardDrag = null;
    clearDropHint();
    if (message) announce(message);
  }
  function setDropHint(row, zone, replacing = false) {
    if (!row || !zone) { clearDropHint(); return; }
    if (dropRow && dropRow !== row) {
      dropRow.style.boxShadow = '';
      dropRow.removeAttribute('data-drop-zone');
      dropRow.removeAttribute('data-drop-label');
      dropRow.removeAttribute('aria-label');
    }
    dropRow = row;
    dropZone = zone;
    const label = bubbleDropLabel(zone, replacing);
    row.setAttribute('data-drop-zone', zone);
    row.setAttribute('data-drop-label', label);
    row.setAttribute('aria-label', label);
    row.style.boxShadow = bubbleDropShadow(zone);
  }
  function cancelDrag() {
    clearDropHint();
    dragIndex = null;
    dragSide = -1;
  }
  function startDrag(index, side, event) {
    clearKeyboardDrag();
    try { event.dataTransfer.setData('text/plain', side >= 0 ? `side:${index}:${side}` : `row:${index}`); } catch {}
    clearDropHint();
    dragIndex = index; dragSide = side;
  }
  function draggedRowCanPair() {
    return dragSide < 0 && !bubbleIsChoice(getItems()[dragIndex]);
  }
  function startKeyboardDrag(index, side, handle) {
    if (keyboardDrag) clearKeyboardDrag();
    keyboardDrag = { from: index, side, target: index, zone: '', handle };
    handle.setAttribute('aria-pressed', 'true');
    announce(side >= 0
      ? `已拾取 ${side === 0 ? 'A' : 'B'} 泡泡。按上或下方向键选择拆出位置，Enter 或空格放下，Escape 取消。`
      : '已拾取泡泡。按上下方向键选择顺序，按左右方向键选择放到 A 或 B，Enter 或空格放下，Escape 取消。');
  }
  function keyboardTarget(direction) {
    if (!keyboardDrag) return;
    const items = getItems(), last = items.length - 1;
    let target = keyboardDrag.target;
    if (keyboardDrag.side >= 0 && target === keyboardDrag.from && !keyboardDrag.zone) {
      target = keyboardDrag.from;
    } else {
      let next = target + direction;
      if (keyboardDrag.side < 0 && next === keyboardDrag.from) next += direction;
      if (next < 1 || next > last) {
        announce('已经到达可移动范围的边缘。');
        return;
      }
      target = next;
    }
    keyboardDrag.target = target;
    keyboardDrag.zone = direction < 0 ? 'before' : 'after';
    const targetRow = rowAt(target);
    setDropHint(targetRow, keyboardDrag.zone, bubbleIsChoice(items[target]));
    announce(`${bubbleDropLabel(keyboardDrag.zone)}第 ${target + 1} 次点击泡泡。再次按方向键调整，Enter 或空格确认。`);
  }
  function keyboardPair(zone) {
    if (!keyboardDrag) return;
    const items = getItems();
    if (keyboardDrag.side >= 0 || bubbleIsChoice(items[keyboardDrag.from])) {
      announce('这个拖动项只能调整前后顺序。');
      return;
    }
    if (keyboardDrag.target === keyboardDrag.from) {
      keyboardDrag.target = keyboardDrag.from < items.length - 1 ? keyboardDrag.from + 1 : keyboardDrag.from - 1;
    }
    if (keyboardDrag.target < 1 || keyboardDrag.target === keyboardDrag.from) {
      announce('没有可合并的目标泡泡。');
      return;
    }
    keyboardDrag.zone = zone;
    const replacing = bubbleIsChoice(items[keyboardDrag.target]);
    setDropHint(rowAt(keyboardDrag.target), zone, replacing);
    announce(`${bubbleDropLabel(zone, replacing)}第 ${keyboardDrag.target + 1} 次点击泡泡。Enter 或空格确认。`);
  }
  function finishKeyboardDrop() {
    if (!keyboardDrag?.zone) {
      announce('请先用方向键选择放置位置。');
      return;
    }
    const state = keyboardDrag;
    const items = getItems();
    const awaitsReplacement = (state.zone === 'pairL' || state.zone === 'pairR') &&
      bubbleIsChoice(items[state.target]);
    const source = state.side < 0 ? items[state.from] : null;
    const sourceModules = state.side >= 0
      ? bubbleChoiceOptions(items[state.from])[state.side]?.item?.modules
      : null;
    state.handle?.setAttribute('aria-pressed', 'false');
    keyboardDrag = null;
    dragIndex = state.from;
    dragSide = state.side;
    dropOn(state.target, state.zone);
    let nextIndex = source ? getItems().indexOf(source) : getItems().findIndex(step => step.modules === sourceModules);
    if (nextIndex < 1) nextIndex = Math.max(1, Math.min(state.target, getItems().length - 1));
    focusHandle(nextIndex);
    announce(awaitsReplacement ? '请选择是否确认替换目标泡泡。' : '已移动泡泡。');
  }
  function handleKeyboardEvent(index, side, handle, event) {
    const key = event.key;
    if ((key === 'Enter' || key === ' ') && !keyboardDrag) {
      event.preventDefault?.();
      startKeyboardDrag(index, side, handle);
      return;
    }
    if (!keyboardDrag || keyboardDrag.handle !== handle) return;
    if (key === 'Enter' || key === ' ') {
      event.preventDefault?.();
      finishKeyboardDrop();
    } else if (key === 'Escape') {
      event.preventDefault?.();
      clearKeyboardDrag('已取消移动泡泡。');
      handle.focus?.();
    } else if (key === 'ArrowUp' || key === 'ArrowDown') {
      event.preventDefault?.();
      keyboardTarget(key === 'ArrowUp' ? -1 : 1);
    } else if (key === 'ArrowLeft' || key === 'ArrowRight') {
      event.preventDefault?.();
      keyboardPair(key === 'ArrowLeft' ? 'pairL' : 'pairR');
    }
  }
  function bindHandle(handle, index, side) {
    handle.type = 'button';
    handle.draggable = true;
    handle.setAttribute('role', 'button');
    handle.setAttribute('aria-pressed', 'false');
    handle.setAttribute('aria-keyshortcuts', side >= 0
      ? 'Enter Space ArrowUp ArrowDown Escape'
      : 'Enter Space ArrowUp ArrowDown ArrowLeft ArrowRight Escape');
    handle.addEventListener('click', event => {
      event.stopPropagation?.();
      if (!keyboardDrag) startKeyboardDrag(index, side, handle);
      else if (keyboardDrag.handle === handle && keyboardDrag.zone) finishKeyboardDrop();
      else if (keyboardDrag.handle === handle) clearKeyboardDrag('已取消移动泡泡。');
      else startKeyboardDrag(index, side, handle);
    });
    handle.addEventListener('keydown', event => handleKeyboardEvent(index, side, handle, event));
    handle.addEventListener('dragstart', event => { event.stopPropagation(); startDrag(index, side, event); });
    handle.addEventListener('dragend', cancelDrag);
  }
  function renderFirst() {
    const step = getItems()[0] || { kind: 'normal' }, chip = getFirstChip();
    chip.textContent = '首次点击 · 编辑内容';
    chip.title = '点击编辑该泡泡的内容模块(' + bubbleRowLabel(step) + ')';
  }
  function renderChoice(row, step, index) {
    const wrap = document.createElement('div');
    wrap.className = 'dshwv-choicerow';
    const options = bubbleChoiceOptions(step);
    for (let side = 0; side < options.length && side < 2; side++) {
      const option = options[side];
      const group = document.createElement('div'); group.className = 'dshwv-choicegrp';
      const sideHandle = document.createElement('button');
      sideHandle.className = 'dshwv-bubdrag dshwv-choice-drag'; sideHandle.textContent = '⠿';
      sideHandle.setAttribute('aria-label', '拖动 ' + (side === 0 ? 'A' : 'B') + ' 泡泡');
      sideHandle.title = '拖动' + (side === 0 ? ' A ' : ' B ') + '泡泡；键盘按 Enter 后用上下方向键选择拆出位置';
      bindHandle(sideHandle, index, side);
      group.appendChild(sideHandle);
      const chip = document.createElement('button');
      chip.type = 'button'; chip.className = 'dshwv-bubchip dshwv-bubchip-btn dshwv-choicechip';
      chip.textContent = (side === 0 ? 'A' : 'B') + ' · 编辑内容';
      chip.title = '点击编辑该泡(' + bubbleRowLabel(option.item) + ')';
      chip.draggable = false;
      chip.addEventListener('click', event => { event.stopPropagation(); openItem(index, side); });
      group.appendChild(chip);
      const weight = document.createElement('input');
      weight.type = 'text'; weight.inputMode = 'numeric'; weight.maxLength = 2;
      weight.className = 'dshwv-winput'; weight.value = String(bubbleChoiceWeight(option));
      weight.title = (side === 0 ? 'A' : 'B') + ' 泡出现权重(直接输入数字,1~99,默认1:1)';
      weight.setAttribute('aria-label', weight.title);
      weight.addEventListener('change', () => {
        option.w = bubbleChoiceWeight({ w: weight.value });
        weight.value = String(option.w);
      });
      group.appendChild(weight); wrap.appendChild(group);
      if (side === 0) {
        const split = document.createElement('button');
        split.type = 'button'; split.className = 'dshwv-splitbtn';
        split.title = '点击拆开:恢复为两个独立泡泡(拆开后每行才显示 ✕ 删除)';
        split.appendChild(document.createElement('span'));
        split.addEventListener('click', () => { if (unpairBubbleStep(getItems(), index)) renderMore(); });
        wrap.appendChild(split);
      }
    }
    row.appendChild(wrap);
  }
  function dropOn(index, finalZone = dropZone || '') {
    const items = getItems(), from = dragIndex, side = dragSide, zone = finalZone;
    cancelDrag();
    if (from == null || from < 1 || index < 1 || from >= items.length || index >= items.length) return;
    if (side >= 0) {
      if (splitBubbleChoiceSide(items, from, side, index, zone)) renderMore();
      return;
    }
    if (zone === 'pairL' || zone === 'pairR') {
      const result = pairBubbleSteps(items, from, index, zone);
      if (result?.replaceSide !== undefined) {
        confirm('用拖入的泡泡替换该并列对中 ' + (result.replaceSide === 0 ? 'A(左)' : 'B(右)') + ' 泡的内容?', () => {
          if (replaceBubbleChoiceSide(getItems(), from, index, result.replaceSide)) renderMore();
        });
      } else if (result) renderMore();
      return;
    }
    if (reorderBubbleStep(items, from, index, zone)) renderMore();
  }
  function renderMore() {
    if (keyboardDrag) clearKeyboardDrag();
    const list = getMoreList(), items = getItems();
    list.innerHTML = '';
    for (let index = 1; index < items.length; index++) {
      const step = items[index], choice = bubbleIsChoice(step);
      const row = document.createElement('div');
      row.className = 'dshwv-bubrow dshwv-bubrow-drag'; row.draggable = false;
      row.setAttribute('data-i', String(index));
      row.addEventListener('dragover', event => {
        try { event.preventDefault(); event.dataTransfer.dropEffect = 'move'; } catch {}
        if (dragIndex == null) { clearDropHint(); return; }
        if (dragIndex === index && dragSide < 0) { clearDropHint(); return; }
        setDropHint(row, rowZone(row, event, draggedRowCanPair()), choice);
      });
      row.addEventListener('dragleave', event => {
        if (event.relatedTarget && row.contains?.(event.relatedTarget)) return;
        clearDropHint();
      });
      row.addEventListener('drop', event => {
        try { event.preventDefault(); } catch {}
        const zone = rowZone(row, event, draggedRowCanPair());
        dropOn(index, zone);
      });
      row.addEventListener('dragend', cancelDrag);
      const handle = document.createElement('button');
      handle.className = 'dshwv-bubdrag'; handle.textContent = '⠿';
      handle.setAttribute('aria-label', choice ? '拖动整组 A/B 泡泡' : '拖动第' + (index + 1) + '次点击泡泡');
      handle.title = choice ? '拖动整行排序；键盘按 Enter 后用上下方向键移动'
        : '拖动排序或合并；键盘按 Enter 后用方向键选择位置';
      bindHandle(handle, index, -1);
      row.appendChild(handle);
      if (choice) renderChoice(row, step, index);
      else {
        const chip = document.createElement('button');
        chip.type = 'button'; chip.className = 'dshwv-bubchip dshwv-bubchip-btn';
        chip.textContent = '第' + (index + 1) + '次点击 · 编辑内容';
        chip.title = '点击编辑该泡泡的内容模块(' + bubbleRowLabel(step) + ')；拖到泡泡左半边成为 A，右半边成为 B';
        chip.addEventListener('click', event => { event.stopPropagation(); openItem(index, -1); });
        row.appendChild(chip);
        const del = document.createElement('button');
        del.type = 'button'; del.className = 'dshwv-bubmini'; del.textContent = '✕'; del.title = '删除该次点击';
        del.addEventListener('click', () => { if (deleteBubbleStep(getItems(), index)) renderMore(); });
        row.appendChild(del);
      }
      list.appendChild(row);
    }
  }
  function dropToEnd() {
    const from = dragIndex, side = dragSide;
    cancelDrag();
    if (moveBubbleStepToEnd(getItems(), from, side)) renderMore();
  }
  return {
    renderFirst, renderMore, dropToEnd,
    move(index, direction) { if (moveBubbleStep(getItems(), index, direction)) renderMore(); },
    delete(index) { if (deleteBubbleStep(getItems(), index)) renderMore(); },
    add() { if (addBubbleStep(getItems())) renderMore(); },
  };
}
