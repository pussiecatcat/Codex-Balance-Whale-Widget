// Bubble preview rows: drag handles, module chips and row drop targets. The
// drag state and editor state stay in the caller and are read through accessors.
export function createBubblePreviewView({
  document, rowsOf, isImgMod, moduleLabel, editModule, deleteBlock, addToRow,
  moveRow, dropBlock, paletteToRow, dropShadow, previewInto, getRowDrag, setRowDrag,
  getModDrag, setModDrag, getZone, setZone, getKey, setKey,
}) {
    function render(state, getTarget, getRoot) {
      state.pvEl.innerHTML = '';
      var it = getTarget();
      if (!it) return;
      var rows = rowsOf(it.modules || []);
      for (var r = 0; r < rows.length; r++) {
        (function (ri, rowMods) {
          var isImgRow = isImgMod(rowMods[0]);
          var bar = document.createElement('div');
          bar.className = 'dshwv-pvrow dshwv-pvrowline';
          bar.title = isImgRow ? '图片独占一行:拖 ⠿ 可整行排序' : '同一行模块并排(≤6):拖 ⠿ 整行排序;拖模块块到某行左/右边缘=并入该行,上/下=另起一行';
          var grip = document.createElement('span');
          grip.className = 'dshwv-pvdrag';
          grip.textContent = '⠿';
          grip.title = '按住拖动整行排序';
          grip.draggable = true;
          grip.addEventListener('dragstart', function (e) {
            e.stopPropagation();
            try {
              e.dataTransfer.setData('text/plain', 'prow:' + ri);
            } catch (err) {}
            setRowDrag(ri);
            setModDrag(null);
            setZone('');
          });
          grip.addEventListener('dragend', function () {
            setRowDrag(null);
            setZone('');
          });
          bar.appendChild(grip);
          for (var mi = 0; mi < rowMods.length; mi++) {
            (function (m, mIdx) {
              var blk = document.createElement('div');
              blk.className = 'dshwv-pvmod' + (isImgMod(m) ? ' dshwv-pvimg' : '');
              blk.draggable = true;
              blk.title = isImgRow ? '图片/动图(独占一行,可整行排序)' : '拖动到某行:左/右边缘=并入该行首/尾,上/下=另起一行';
              blk.addEventListener('dragstart', function (e) {
                e.stopPropagation();
                try {
                  e.dataTransfer.setData('text/plain', 'mod:' + ri + ':' + mIdx);
                } catch (err) {}
                setRowDrag(null);
                setModDrag({
                  ri: ri,
                  mi: mIdx
                });
                setZone('');
              });
              blk.addEventListener('dragend', function () {
                setModDrag(null);
                setZone('');
              });
              var lab = document.createElement('span');
              lab.className = 'dshwv-pvlab';
              lab.textContent = moduleLabel(m);
              lab.title = '点击编辑该模块(内容/样式)';
              lab.addEventListener('click', function (e) {
                e.stopPropagation();
                editModule(m);
              });
              blk.appendChild(lab);
              var ed = document.createElement('button');
              ed.type = 'button';
              ed.className = 'dshwv-bubmini';
              ed.textContent = '✎';
              ed.title = '编辑该模块(内容/样式)';
              ed.addEventListener('click', function (e) {
                e.stopPropagation();
                editModule(m);
              });
              blk.appendChild(ed);
              var del = document.createElement('button');
              del.type = 'button';
              del.className = 'dshwv-bubmini';
              del.textContent = '✕';
              del.title = '删除该模块';
              del.addEventListener('click', function (e) {
                e.stopPropagation();
                deleteBlock(ri, mIdx);
              });
              blk.appendChild(del);
              bar.appendChild(blk);
            })(rowMods[mi], mi);
          }
          if (!isImgRow) {
            var add = document.createElement('button');
            add.type = 'button';
            add.className = 'dshwv-pvadd';
            add.textContent = '+';
            add.title = '把模块加入同一行(默认文本,并排显示;其余类型可把上方色板拖进本行)';
            add.addEventListener('click', function (e) {
              e.stopPropagation();
              addToRow(ri);
            });
            bar.appendChild(add);
          }
          function highlight(zone) {
            setZone(zone);
            bar.style.boxShadow = '';
            bar.style.outline = '';
            if (zone === 'join') bar.style.outline = '2px solid rgba(32,49,112,.55)'; else {
              var sh = dropShadow(zone);
              if (sh) bar.style.boxShadow = sh;
            }
          }
          bar.addEventListener('dragover', function (e) {
            try {
              var isMod = !!getModDrag();
              var isRow = getRowDrag() !== null && getRowDrag() !== undefined;
              var isPal = !isMod && !isRow && !!getKey();
              if (!isMod && !isRow && !isPal) return;
              e.preventDefault();
              e.dataTransfer.dropEffect = 'move';
              var rc = bar.getBoundingClientRect();
              if (!rc.width) return;
              if (isPal) {
                highlight('join');
                return;
              }
              var x = e.clientX - rc.left;
              if (isMod && x < rc.width * 0.2) {
                highlight('pairL');
                return;
              }
              if (isMod && x > rc.width * 0.8) {
                highlight('pairR');
                return;
              }
              highlight(e.clientY - rc.top < rc.height / 2 ? 'before' : 'after');
            } catch (err) {}
          });
          bar.addEventListener('dragleave', function () {
            setZone('');
            bar.style.boxShadow = '';
            bar.style.outline = '';
          });
          bar.addEventListener('drop', function (e) {
            try {
              e.preventDefault();
              e.stopPropagation();
              var zone = getZone();
              setZone('');
              bar.style.boxShadow = '';
              bar.style.outline = '';
              if (getRowDrag() !== null && getRowDrag() !== undefined) {
                var fromRow = getRowDrag();
                setRowDrag(null);
                if (fromRow !== ri) moveRow(fromRow, ri, zone);
                return;
              }
              if (getModDrag()) {
                var md = getModDrag();
                setModDrag(null);
                if (zone === 'join') zone = 'after';
                dropBlock(md.ri, md.mi, ri, zone);
                return;
              }
              if (getKey()) {
                var key = getKey();
                setKey(null);
                paletteToRow(key, ri);
                return;
              }
            } catch (err) {}
          });
          state.pvEl.appendChild(bar);
        })(r, rows[r]);
      }
      try {
        var root = getRoot();
        var rw = root && (root.offsetWidth || root.getBoundingClientRect().width) || 280;
        previewInto(state.pvPrevEl, it.modules || [], Math.min(rw, 408));
      } catch (err) {}
    }

  return { render };
}
