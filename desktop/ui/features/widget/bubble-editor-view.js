import { bubbleIsChoice, bubbleChoiceOptions, bubbleChoiceWeight, bubbleRowLabel } from './default-content.js';
import { addBubbleStep, deleteBubbleStep, moveBubbleStep, reorderBubbleStep, splitBubbleChoiceSide,
  pairBubbleSteps, replaceBubbleChoiceSide, moveBubbleStepToEnd, unpairBubbleStep } from './bubble-editor-commands.js';

// Owns list rendering and the drag gesture; draft mutations live in commands.
export function bubbleDropShadow(zone) {
  return { before: '0 -4px 0 #203170', after: '0 4px 0 #203170',
    pairL: 'inset 5px 0 0 #203170, inset 0 0 0 1px rgba(32,49,112,.35)',
    pairR: 'inset -5px 0 0 #203170, inset 0 0 0 1px rgba(32,49,112,.35)' }[zone] || '';
}

// Where a dragged bubble lands on a row. Landing on the bubble itself pairs with
// it — the left half becomes its A bubble, the right half its B one — and landing
// anywhere else on the row (the handle, the gap, the delete button) moves the row
// before or after this one. The pair zones used to be 22% strips at the row's
// edges, so dropping a bubble onto another one landed in the middle, reordered two
// adjacent bubbles, and looked like nothing had happened at all.
export function dropZoneFor(bounds, chipBounds, point) {
  if (!bounds?.width) return '';
  const x = point.x - bounds.left, y = point.y - bounds.top;
  if (chipBounds?.width) {
    const left = chipBounds.left - bounds.left, right = chipBounds.right - bounds.left;
    if (x >= left && x <= right) return x - left < (right - left) / 2 ? 'pairL' : 'pairR';
  }
  return y < bounds.height / 2 ? 'before' : 'after';
}

export function createBubbleEditorView({ document, getItems, getFirstChip, getMoreList, openItem, confirm }) {
  let dragIndex = null, dragSide = -1, dropZone = '';
  function rowZone(row, event) {
    const chip = row.querySelector ? row.querySelector('.dshwv-bubchip') : null;
    const chipBounds = chip && chip.getBoundingClientRect ? chip.getBoundingClientRect() : null;
    return dropZoneFor(row.getBoundingClientRect(), chipBounds, { x: event.clientX, y: event.clientY });
  }
  function startDrag(index, side, event) {
    try { event.dataTransfer.setData('text/plain', side >= 0 ? `side:${index}:${side}` : `row:${index}`); } catch {}
    dragIndex = index; dragSide = side; dropZone = '';
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
  function dropOn(index) {
    const items = getItems(), from = dragIndex, side = dragSide, zone = dropZone || '';
    dragIndex = null; dragSide = -1; dropZone = '';
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
        if (dragIndex === index && dragSide < 0) { dropZone = ''; row.style.boxShadow = ''; return; }
        let zone = rowZone(row, event);
        if (dragSide >= 0 && (zone === 'pairL' || zone === 'pairR')) zone = '';
        dropZone = zone; row.style.boxShadow = bubbleDropShadow(zone);
      });
      row.addEventListener('dragleave', () => { dropZone = ''; row.style.boxShadow = ''; });
      row.addEventListener('drop', event => { try { event.preventDefault(); } catch {} dropOn(index); });
      const handle = document.createElement('span');
      handle.className = 'dshwv-bubdrag'; handle.textContent = '⠿';
      if (choice) {
        handle.draggable = true;
        handle.title = '按住拖动整行排序(并列的 A/B 一起移动)';
        handle.addEventListener('dragstart', event => startDrag(index, -1, event));
      } else handle.title = '拖动排序;拖到某个泡泡上可与其并列(左半=A 泡,右半=B 泡)';
      row.appendChild(handle);
      if (choice) renderChoice(row, step, index);
      else {
        const chip = document.createElement('button');
        chip.type = 'button'; chip.className = 'dshwv-bubchip dshwv-bubchip-btn';
        chip.textContent = '第' + (index + 1) + '次点击 · 编辑内容';
        chip.title = '点击编辑该泡泡的内容模块(' + bubbleRowLabel(step) + ');把另一行拖到这个泡泡上可与其并列(左半=A 泡,右半=B 泡),拖到行的空白处则调整顺序';
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
    dragIndex = null; dragSide = -1; dropZone = '';
    if (moveBubbleStepToEnd(getItems(), from, side)) renderMore();
  }
  return {
    renderFirst, renderMore, dropToEnd,
    move(index, direction) { if (moveBubbleStep(getItems(), index, direction)) renderMore(); },
    delete(index) { if (deleteBubbleStep(getItems(), index)) renderMore(); },
    add() { if (addBubbleStep(getItems())) renderMore(); },
  };
}
