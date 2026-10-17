import { bubbleIsChoice, bubbleChoiceOptions, bubbleChoiceWeight, bubbleRowLabel } from './default-content.js';
import { addBubbleStep, deleteBubbleStep, moveBubbleStep, reorderBubbleStep, splitBubbleChoiceSide,
  pairBubbleSteps, replaceBubbleChoiceSide, moveBubbleStepToEnd, unpairBubbleStep } from './bubble-editor-commands.js';

// Owns list rendering and the drag gesture; draft mutations live in commands.
export function bubbleDropShadow(zone) {
  return { before: '0 -4px 0 #203170', after: '0 4px 0 #203170',
    pairL: 'inset 5px 0 0 #203170, 0 0 0 2px rgba(32,49,112,.14)',
    pairR: 'inset -5px 0 0 #203170, 0 0 0 2px rgba(32,49,112,.14)' }[zone] || '';
}

export function bubbleDropZone(rowBounds, contentBounds, point, allowPair = true) {
  if (!rowBounds?.width || !Number.isFinite(point?.x) || !Number.isFinite(point?.y)) return '';
  const sortBand = Math.max(6, Math.min(10, rowBounds.height * .16));
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

export function createBubbleEditorView({ document, getItems, getFirstChip, getMoreList, openItem, confirm }) {
  let dragIndex = null, dragSide = -1, dropZone = '', dropRow = null;
  function rowZone(row, event, allowPair = true) {
    const bounds = row.getBoundingClientRect();
    const content = row.querySelector?.('.dshwv-choicerow') || row.querySelector?.('.dshwv-bubchip');
    return bubbleDropZone(bounds, content?.getBoundingClientRect?.(),
      { x: event.clientX, y: event.clientY }, allowPair);
  }
  function clearDropHint() {
    if (dropRow) dropRow.style.boxShadow = '';
    dropRow = null;
    dropZone = '';
  }
  function setDropHint(row, zone) {
    if (dropRow && dropRow !== row) dropRow.style.boxShadow = '';
    dropRow = row;
    dropZone = zone;
    row.style.boxShadow = bubbleDropShadow(zone);
  }
  function cancelDrag() {
    clearDropHint();
    dragIndex = null;
    dragSide = -1;
  }
  function startDrag(index, side, event) {
    try { event.dataTransfer.setData('text/plain', side >= 0 ? `side:${index}:${side}` : `row:${index}`); } catch {}
    clearDropHint();
    dragIndex = index; dragSide = side;
  }
  function draggedRowCanPair() {
    return dragSide < 0 && !bubbleIsChoice(getItems()[dragIndex]);
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
      const chip = document.createElement('button');
      chip.type = 'button'; chip.className = 'dshwv-bubchip dshwv-bubchip-btn dshwv-choicechip';
      chip.textContent = (side === 0 ? 'A' : 'B') + ' · 编辑内容';
      chip.title = '点击编辑该泡(' + bubbleRowLabel(option.item) + ');按住拖动可把该泡拆出到其他位置';
      chip.draggable = true;
      chip.addEventListener('dragstart', event => { event.stopPropagation(); startDrag(index, side, event); });
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
    const list = getMoreList(), items = getItems();
    list.innerHTML = '';
    for (let index = 1; index < items.length; index++) {
      const step = items[index], choice = bubbleIsChoice(step);
      const row = document.createElement('div');
      row.className = 'dshwv-bubrow dshwv-bubrow-drag'; row.draggable = !choice;
      row.setAttribute('data-i', String(index));
      row.addEventListener('dragstart', event => { if (!bubbleIsChoice(getItems()[index])) startDrag(index, -1, event); });
      row.addEventListener('dragover', event => {
        try { event.preventDefault(); event.dataTransfer.dropEffect = 'move'; } catch {}
        if (dragIndex === index && dragSide < 0) { clearDropHint(); return; }
        setDropHint(row, rowZone(row, event, draggedRowCanPair()));
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
      const handle = document.createElement('span');
      handle.className = 'dshwv-bubdrag'; handle.textContent = '⠿';
      if (choice) {
        handle.draggable = true;
        handle.title = '按住拖动整行排序(并列的 A/B 一起移动)';
        handle.addEventListener('dragstart', event => startDrag(index, -1, event));
      } else handle.title = '拖动排序；拖到另一个泡泡主体的左半边/右半边可与其并列';
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
