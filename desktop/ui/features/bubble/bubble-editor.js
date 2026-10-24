import { createBubbleEditorView, bubbleDropShadow } from './bubble-editor-view.js';
import { createBubbleColorSelect } from './bubble-color-select.js';
import { createBubbleQuickEditors } from './bubble-quick-editors.js';
import { createBubblePalette } from './bubble-palette.js';
import { bubbleDefaultSecondModules, bubbleDefaultQueue as buildBubbleDefaultQueue, bubbleModuleListLabel, bubbleEditEnsureModules, bubbleIsChoice, bubbleChoiceOptions, bubbleChoiceWeight } from './default-content.js';
import { loadBubbleEditorDraft, saveBubbleEditorDraft } from './bubble-editor-model.js';
import { bubbleIsImgMod, bubbleRowsOf, bubbleRowsFlat, bubbleRowsCanon } from './bubble-layout.js';
import { createLifecycle } from '../../services/lifecycle.js';

export function createBubbleEditor(ports) {
const lifecycle = createLifecycle();
let fontListenersBound = false;
var bubbleMask = null;
var bubbleEditItems = [];
var bubbleMoreListEl = null;
var bubbleFirstChipEl = null;
function bubbleDefaultQueue() {
      return buildBubbleDefaultQueue(ports.isSubscription());
    }
var bubbleEditorView = createBubbleEditorView({
      document: ports.document,
      getItems: function () { return bubbleEditItems; },
      getFirstChip: function () { return bubbleFirstChipEl; },
      getMoreList: function () { return bubbleMoreListEl; },
      openItem: openBubbleItem, confirm: ports.showConfirm
    });
function renderBubbleFirst() { bubbleEditorView.renderFirst(); }
function renderBubbleMore() { bubbleEditorView.renderMore(); }
function bubbleDropToEnd() { bubbleEditorView.dropToEnd(); }
function renderBubbleEditor() {
      if (!bubbleEditItems.length) bubbleEditItems = [{ kind: 'normal' }];
      renderBubbleFirst();
      renderBubbleMore();
    }
function bubbleAddMore() { bubbleEditorView.add(); }
var bubbleEditorSnap = null;
function bubbleEditorDirty() {
      try {
        if (bubbleEditorSnap === null) return true;
        return bubbleEditorSnap !== JSON.stringify([bubbleEditItems, bubbleLib]);
      } catch (err) {
        return true;
      }
    }
function openBubbleEditor() {
      try {
        if (!ports.bubbleCfgLoaded) {
          ports.loadBubbleCfg().then(lifecycle.guard(function (ok) {
            if (ok) openBubbleEditor(); else ports.assetFailure(new Error('自定义泡泡配置读取失败'));
          }));
          return;
        }
        ports.closeRolePanel();
        ports.closeAudioGroupPanel();
        var draft = loadBubbleEditorDraft(ports.bubbleCfg, ports.isSubscription());
        bubbleLib = draft.library;
        bubbleEditItems = draft.items;
        bubbleEditorSnap = JSON.stringify([bubbleEditItems, bubbleLib]);
        renderBubbleEditor();
        bubbleMask.style.display = 'flex';
      } catch (err) {}
    }
function closeBubbleEditor() {
      bubbleMask.style.display = 'none';
      bubbleEditorSnap = null;
    }
function bubbleEditorReset() {
      ports.showConfirm(ports.isSubscription() ? '恢复为默认 Codex 额度气泡?' : '恢复为默认序列(首次=余额内容,再次=随机语句)?', function () {
        bubbleEditItems = bubbleDefaultQueue();
        renderBubbleEditor();
      });
    }
function bubbleEditorSave() {
      try {
        var doSave = function () {
          var subscriptionMode = ports.isSubscription();
          ports.saveBubbleCfg(saveBubbleEditorDraft(bubbleEditItems, bubbleLib, ports.bubbleCfg, subscriptionMode), function (ok) {
            if (ok !== false) closeBubbleEditor();
          });
        };
        if (bubbleEditorDirty()) ports.showConfirm('保存当前点击序列?(未逐泡编辑过的行将按默认内容保存,保存后即生效)', doSave); else doSave();
      } catch (err) {}
    }
var bubbleItemMask = null;
var bubbleEditItemIdx = -1;
var bubbleEditSide = -1;
var bubbleItemSnap = null;
var bubbleItemTitleEl = null;
var bubbleItemSideEl = null;
var bubblePalEl = null;
var bubblePvEl = null;
function bubbleEditTarget() {
      var step = bubbleEditItems[bubbleEditItemIdx];
      if (!step) return null;
      if (bubbleIsChoice(step)) {
        var o = bubbleChoiceOptions(step)[bubbleEditSide === 0 || bubbleEditSide === 1 ? bubbleEditSide : 0];
        return o ? o.item : null;
      }
      return step;
    }
function bubbleEditStepLabel(step, idx) {
      var base = '第' + (idx + 1) + '次点击';
      if (bubbleIsChoice(step)) return base + ' · ' + (bubbleEditSide === 1 ? 'B泡' : 'A泡');
      return base;
    }
function openBubbleItem(idx, side) {
      try {
        whaleZClean();
        var step = bubbleEditItems[idx];
        if (!step) return;
        bubbleEditItemIdx = idx;
        if (!bubbleIsChoice(step)) {
          bubbleEditSide = -1;
        } else {
          var want = side === 0 || side === 1 ? side : 0;
          if (!bubbleChoiceOptions(step)[want]) want = 0;
          bubbleEditSide = want;
        }
        bubbleItemSnap = JSON.parse(JSON.stringify(step));
        var it = bubbleEditTarget();
        if (!it) return;
        bubbleEditEnsureModules(it);
        bubbleRowsCanon(it.modules);
        bubbleItemTitleEl.textContent = '编辑 ' + bubbleEditStepLabel(step, idx) + '内容(可拖动下方模块入框)';
        renderBubbleItemSideSwitch(step);
        bubbleItemMask.style.display = 'flex';
        renderBubblePal();
        renderBubblePv();
      } catch (err) {}
    }
function renderBubbleItemSideSwitch(step) {
      if (!bubbleItemSideEl) return;
      bubbleItemSideEl.innerHTML = '';
      if (!bubbleIsChoice(step)) {
        bubbleItemSideEl.style.display = 'none';
        return;
      }
      bubbleItemSideEl.style.display = '';
      var opts = bubbleChoiceOptions(step);
      for (var s = 0; s < opts.length && s < 2; s++) {
        (function (si) {
          var b = ports.document.createElement('button');
          b.type = 'button';
          b.className = 'dshwv-bubchip dshwv-bubchip-btn' + (si === bubbleEditSide ? ' dshwv-bubchip-cur' : '');
          b.textContent = (si === 0 ? 'A' : 'B') + ' 泡(权重 ' + bubbleChoiceWeight(opts[si]) + ')';
          b.title = '切换到编辑 ' + (si === 0 ? 'A' : 'B') + ' 泡';
          b.addEventListener('click', lifecycle.guard(function (e) {
            e.stopPropagation();
            openBubbleItem(bubbleEditItemIdx, si);
          }));
          bubbleItemSideEl.appendChild(b);
        })(s);
      }
    }
function closeBubbleItem() {
      bubbleItemMask.style.display = 'none';
      bubbleEditItemIdx = -1;
      bubbleEditSide = -1;
      if (bubbleItemSideEl) bubbleItemSideEl.innerHTML = '';
    }
var qeditEl = null;
function qeditEnsure() {
      if (qeditEl) return qeditEl;
      qeditEl = ports.document.createElement('div');
      qeditEl.className = 'dshwv-qedit';
      qeditEl.style.display = 'none';
      ports.document.body.appendChild(qeditEl);
      {
        lifecycle.listen(ports.document, 'pointerdown', lifecycle.guard(function (e) {
          if (!qeditEl || qeditEl.style.display === 'none') return;
          if (e.target && e.target.closest && (e.target.closest('.dshwv-qedit') || e.target.closest('.dshwv-rgbmenu') || e.target.closest('.dshwv-custmenu') || e.target.closest('.dshwv-rgbhead') || e.target.closest('.dshwv-custbtn') || e.target.closest('.dshwv-fontwrap') || e.target.closest('.dshwv-usagepanel') || e.target.closest('.dshwv-usage-mask') || e.target.closest('.dshwv-resmask'))) return;
          qeditClose();
        }), true);
        lifecycle.listen(ports.document, 'keydown', lifecycle.guard(function (e) {
          if (e.key === 'Escape') qeditClose();
        }));
      }
      return qeditEl;
    }
function qeditClose() {
      bubbleColorSelect.close(); bubbleFontOpenMenu?.remove(); bubbleFontOpenMenu = null;
      if (qeditEl) qeditEl.style.display = 'none';
    }
function qRow() {
      var d = ports.document.createElement('div');
      d.className = 'dshwv-qedit-row';
      return d;
    }
function qLabel(t) {
      var s = ports.document.createElement('label');
      s.textContent = t;
      return s;
    }
function qeditPlace(anchorRect, widthPx, preferAbove) {
      try {
        var vp = ports.viewport();
        var box = qeditEl;
        var w = Math.max(180, Math.min(widthPx || 320, vp.w - 16));
        box.style.width = w + 'px';
        box.style.display = 'block';
        var h = box.offsetHeight || 200;
        var left = anchorRect.left + anchorRect.width / 2 - w / 2;
        left = Math.max(8, Math.min(left, vp.w - w - 8));
        var top = preferAbove ? anchorRect.top - h - 8 : anchorRect.bottom + 6;
        if (preferAbove && top < 8) top = Math.min(8, anchorRect.bottom + 6);
        if (top + h > vp.h - 8) top = Math.max(8, vp.h - h - 8);
        if (top < 8) top = 8;
        box.style.left = Math.round(left) + 'px';
        box.style.top = Math.round(top) + 'px';
      } catch (err) {}
    }
var bubbleColorSelect = createBubbleColorSelect({
      document: ports.document, qRow: qRow, qLabel: qLabel, dshwDropOpen: dshwDropOpen
    });
var qColorSelectBuild = bubbleColorSelect.build;
var bubbleQuickEditors = createBubbleQuickEditors({
      document: ports.document, modelOptions: ports.modelOptions, qeditClose: qeditClose,
      qRow: qRow, qLabel: qLabel, bubbleFontEditRow: bubbleFontEditRow,
      qColorSelectBuild: qColorSelectBuild, qeditPlace: qeditPlace,
      // Resolved at call time, not here. usageAlertBudgetEditor swaps both
      // bindings while it is open — qeditEnsure to lift the quick-edit box above
      // that editor's mask, renderBubblePv to apply the alert-resolved modules —
      // and a value captured now would miss the swap.
      qeditEnsure: function () { return qeditEnsure(); },
      renderBubblePv: function () { return renderBubblePv(); },
      getPreviewElement: function () { return bubblePvPrevEl; },
      bubbleTplHelpToggle: function (m, anchor) { return ports.bubbleTplHelpToggle(m, anchor); }
    });
var openQuickTextEditor = bubbleQuickEditors.openText;
var openQuickModuleEditor = bubbleQuickEditors.openModule;
var openQuickSentenceEditor = bubbleQuickEditors.openSentence;
var bubblePalette = createBubblePalette({
      document: ports.document, getPaletteElement: function () { return bubblePalEl; },
      getLibrary: function () { return bubbleLib; },
      setDragKey: function (key) { bubbleDragKey = key; },
      bubbleModuleAdd: bubbleModuleAdd, bubbleModuleNew: bubbleModuleNew,
      bubblePickImageToAdd: bubblePickImageToAdd, bubblePaletteModule: bubblePaletteModule,
      bubbleCloneModule: ports.bubbleCloneModule, bubbleDefaultSecondModules: bubbleDefaultSecondModules,
      showConfirm: ports.showConfirm, bubbleLibDel: bubbleLibDel
    });
var renderBubblePal = bubblePalette.render;
function bubbleLibById(id) {
      for (var i = 0; i < bubbleLib.length; i++) if (bubbleLib[i].id === id) return bubbleLib[i];
      return null;
    }
var bubbleDragKey = null;
function bubbleItemHasImage() {
      try {
        var it = bubbleEditTarget();
        if (!it || !it.modules) return false;
        for (var i = 0; i < it.modules.length; i++) if (bubbleIsImgMod(it.modules[i])) return true;
      } catch (err) {}
      return false;
    }
function bubbleWarnOneImage() {
      ports.showConfirm('一个泡泡只能有一个图片/动图。当前泡泡已含图片,请先修改或删除现有图片模块后再添加。', function () {}, '知道了');
    }
function bubbleModuleAdd(m) {
      try {
        var it = bubbleEditTarget();
        if (!it) return;
        if (!it.modules) it.modules = [];
        if (bubbleIsImgMod(m) && bubbleItemHasImage()) {
          bubbleWarnOneImage();
          return;
        }
        if (bubbleRowsOf(it.modules).length >= BUBBLE_PV_ROW_MAX) {
          bubblePvWarn('泡泡最多 ' + BUBBLE_PV_ROW_MAX + ' 行,无法再加新行');
          return;
        }
        it.modules.push(m);
        renderBubblePv();
      } catch (err) {}
    }
function bubbleModuleNew(m) {
      openModuleEditor(m, function (saved) {
        if (saved) bubbleModuleAdd(saved);
      });
    }
function bubblePickImageToAdd() {
      if (bubbleItemHasImage()) {
        bubbleWarnOneImage();
        return;
      }
      bubbleModuleNew({
        type: 'image',
        imgId: '',
        size: 6
      });
    }
var BUBBLE_PV_ROW_MAX = 6;
var BUBBLE_PV_MOD_MAX = 6;
var bubbleModDrag = null;
var bubblePvZone = '';
function bubblePvWarn(msg) {
      ports.showConfirm(msg, function () {}, '知道了');
    }
function bubblePvRowModel() {
      var it = bubbleEditTarget();
      if (!it || !Array.isArray(it.modules)) return [];
      return bubbleRowsOf(it.modules);
    }
function bubblePvRowCommit(rows) {
      var it = bubbleEditTarget();
      if (!it) return;
      it.modules = bubbleRowsFlat(rows);
      renderBubblePv();
    }
function bubbleModuleEdit(m) {
      try {
        if (m && (m.type === 'text' || m.type === 'link')) {
          openQuickTextEditor(m);
          return;
        }
        if (m && (m.type === 'balance' || m.type === 'today' || m.type === 'quota' || m.type === 'turn')) {
          openQuickModuleEditor(m);
          return;
        }
        openModuleEditor(m, function (saved) {
          if (saved) renderBubblePv();
        });
      } catch (err) {}
    }
function bubblePvDelBlock(ri, mi) {
      var rows = bubblePvRowModel();
      if (!rows[ri] || mi >= rows[ri].length) return;
      rows[ri].splice(mi, 1);
      if (!rows[ri].length) rows.splice(ri, 1);
      bubblePvRowCommit(rows);
    }
function bubblePvMoveRow(fromRow, toRow, zone) {
      var rows = bubblePvRowModel();
      if (fromRow < 0 || fromRow >= rows.length || toRow < 0 || toRow >= rows.length || fromRow === toRow) return;
      var target = rows[toRow];
      var moved = rows.splice(fromRow, 1)[0];
      var t = rows.indexOf(target);
      if (t < 0) {
        rows.push(moved);
        bubblePvRowCommit(rows);
        return;
      }
      rows.splice(zone === 'after' ? t + 1 : t, 0, moved);
      bubblePvRowCommit(rows);
    }
function bubblePvDropBlock(riFrom, miFrom, riTarget, zone) {
      try {
        var rows = bubblePvRowModel();
        if (!rows[riFrom] || miFrom >= rows[riFrom].length || !rows[riTarget]) return;
        var m = rows[riFrom][miFrom];
        if (!m || typeof m !== 'object') return;
        var tRow = rows[riTarget];
        var imageInvolved = bubbleIsImgMod(m) || bubbleIsImgMod(tRow[0]);
        if (imageInvolved && (zone === 'pairL' || zone === 'pairR')) zone = 'before';
        rows[riFrom].splice(miFrom, 1);
        if (!rows[riFrom].length) rows.splice(riFrom, 1);
        var tIdx = -1;
        for (var i = 0; i < rows.length; i++) if (rows[i] === tRow) {
          tIdx = i;
          break;
        }
        if (tIdx >= 0 && (zone === 'pairL' || zone === 'pairR')) {
          var tgt = rows[tIdx];
          if (!bubbleIsImgMod(m) && !bubbleIsImgMod(tgt[0])) {
            if (tgt.length >= BUBBLE_PV_MOD_MAX) {
              bubblePvWarn('同一行最多 ' + BUBBLE_PV_MOD_MAX + ' 个模块,无法再并入');
              return;
            }
            tgt.splice(zone === 'pairL' ? 0 : tgt.length, 0, m);
            bubblePvRowCommit(rows);
            return;
          }
          zone = 'before';
        }
        if (rows.length >= BUBBLE_PV_ROW_MAX) {
          bubblePvWarn('泡泡最多 ' + BUBBLE_PV_ROW_MAX + ' 行,无法另起新行');
          return;
        }
        var at = tIdx >= 0 ? zone === 'after' ? tIdx + 1 : tIdx : Math.min(riFrom, rows.length);
        rows.splice(at, 0, [m]);
        bubblePvRowCommit(rows);
      } catch (err) {}
    }
function bubblePvDropBlockEnd(riFrom, miFrom) {
      var rows = bubblePvRowModel();
      if (!rows[riFrom] || miFrom >= rows[riFrom].length) return;
      var m = rows[riFrom][miFrom];
      rows[riFrom].splice(miFrom, 1);
      if (!rows[riFrom].length) rows.splice(riFrom, 1);
      if (rows.length >= BUBBLE_PV_ROW_MAX) {
        bubblePvWarn('泡泡最多 ' + BUBBLE_PV_ROW_MAX + ' 行,无法再另起一行');
        return;
      }
      rows.push([m]);
      bubblePvRowCommit(rows);
    }
function bubblePvMoveRowEnd(fromRow) {
      var rows = bubblePvRowModel();
      if (fromRow < 0 || fromRow >= rows.length) return;
      rows.push(rows.splice(fromRow, 1)[0]);
      bubblePvRowCommit(rows);
    }
function bubblePvAddToRow(ri) {
      var rows = bubblePvRowModel();
      if (!rows[ri]) return;
      if (rows[ri].length >= BUBBLE_PV_MOD_MAX) {
        bubblePvWarn('同一行最多 ' + BUBBLE_PV_MOD_MAX + ' 个模块');
        return;
      }
      rows[ri].push({
        type: 'text',
        text: '新内容',
        size: 6,
        bold: true
      });
      bubblePvRowCommit(rows);
    }
function bubblePvPaletteToRow(key, ri) {
      try {
        var rows = bubblePvRowModel();
        if (!rows[ri]) return;
        var tgt = rows[ri];
        if (bubbleIsImgMod(tgt[0])) {
          bubblePvWarn('该行是图片(独占一行):请拖到下方空白区另起一行');
          return;
        }
        if (key === 'image' || key === 'randimg') {
          bubblePvWarn('图片模块必须独占一整行:请拖到下方空白区新增');
          return;
        }
        if (key === 'wizard') key = 'text';
        var m = bubblePaletteModule(key);
        if (!m) return;
        if (tgt.length >= BUBBLE_PV_MOD_MAX) {
          bubblePvWarn('同一行最多 ' + BUBBLE_PV_MOD_MAX + ' 个模块,无法再加入');
          return;
        }
        tgt.push(m);
        bubblePvRowCommit(rows);
      } catch (err) {}
    }
function bubblePaletteModule(key) {
      if (key === 'text') return {
        type: 'text',
        text: '新内容',
        size: 6,
        bold: true
      };
      if (key === 'balance') return {
        type: 'balance',
        size: 11,
        tpl: '{balance_api}'
      };
      if (key === 'today') return {
        type: 'today',
        size: 1,
        tpl: '今日已观测 {expense_api}'
      };
      if (key === 'quota5' || key === 'quotaWeek') return {
        type: 'quota',
        quotaStyle: 'meter',
        windowDurationMins: key === 'quotaWeek' ? 10080 : 300,
        size: 5
      };
      if (key === 'turn') return {
        type: 'turn',
        size: 5,
        tpl: '上轮使用 {turn_tokens} tokens'
      };
      if (key === 'plan') return { type: 'plan', size: 5, bold: true, tpl: '{plan_name}' };
      if (key === 'session') return { type: 'session', size: 4, tpl: '当前会话 · {session_name}' };
      if (key === 'peak') return { type: 'peak', size: 5, bold: true, tpl: '{peak_phase} · {peak_countdown}' };
      if (key === 'link') return {
        type: 'link',
        text: '打开链接',
        url: '',
        size: 6,
        color: '#2f4488'
      };
      if (key === 'randimg') return { type: 'randimg', imgs: [], imgScale: 1 };
      if (key === 'random') return ports.bubbleCloneModule(bubbleDefaultSecondModules()[0]);
      if (typeof key === 'string' && key.indexOf('lib:') === 0) {
        var lb = bubbleLibById(key.slice(4));
        return lb ? ports.bubbleCloneModule(lb.module) : null;
      }
      return null;
    }
function renderBubblePv() {
      bubblePvEl.innerHTML = '';
      var it = bubbleEditTarget();
      if (!it) return;
      var rows = bubbleRowsOf(it.modules || []);
      for (var r = 0; r < rows.length; r++) {
        (function (ri, rowMods) {
          var isImgRow = bubbleIsImgMod(rowMods[0]);
          var bar = ports.document.createElement('div');
          bar.className = 'dshwv-pvrow dshwv-pvrowline';
          bar.title = isImgRow ? '图片独占一行:拖 ⠿ 可整行排序' : '同一行模块并排(≤6):拖 ⠿ 整行排序;拖模块块到某行左/右边缘=并入该行,上/下=另起一行';
          var grip = ports.document.createElement('span');
          grip.className = 'dshwv-pvdrag';
          grip.textContent = '⠿';
          grip.title = '按住拖动整行排序';
          grip.draggable = true;
          grip.addEventListener('dragstart', lifecycle.guard(function (e) {
            e.stopPropagation();
            try {
              e.dataTransfer.setData('text/plain', 'prow:' + ri);
            } catch (err) {}
            bubbleRowDragIdx = ri;
            bubbleModDrag = null;
            bubblePvZone = '';
          }));
          grip.addEventListener('dragend', lifecycle.guard(function () {
            bubbleRowDragIdx = null;
            bubblePvZone = '';
          }));
          bar.appendChild(grip);
          for (var mi = 0; mi < rowMods.length; mi++) {
            (function (m, mIdx) {
              var blk = ports.document.createElement('div');
              blk.className = 'dshwv-pvmod' + (bubbleIsImgMod(m) ? ' dshwv-pvimg' : '');
              blk.draggable = true;
              blk.title = isImgRow ? '图片/动图(独占一行,可整行排序)' : '拖动到某行:左/右边缘=并入该行首/尾,上/下=另起一行';
              blk.addEventListener('dragstart', lifecycle.guard(function (e) {
                e.stopPropagation();
                try {
                  e.dataTransfer.setData('text/plain', 'mod:' + ri + ':' + mIdx);
                } catch (err) {}
                bubbleRowDragIdx = null;
                bubbleModDrag = {
                  ri: ri,
                  mi: mIdx
                };
                bubblePvZone = '';
              }));
              blk.addEventListener('dragend', lifecycle.guard(function () {
                bubbleModDrag = null;
                bubblePvZone = '';
              }));
              var lab = ports.document.createElement('span');
              lab.className = 'dshwv-pvlab';
              lab.textContent = bubbleModuleListLabel(m);
              lab.title = '点击编辑该模块(内容/样式)';
              lab.addEventListener('click', lifecycle.guard(function (e) {
                e.stopPropagation();
                bubbleModuleEdit(m);
              }));
              blk.appendChild(lab);
              var ed = ports.document.createElement('button');
              ed.type = 'button';
              ed.className = 'dshwv-bubmini';
              ed.textContent = '✎';
              ed.title = '编辑该模块(内容/样式)';
              ed.addEventListener('click', lifecycle.guard(function (e) {
                e.stopPropagation();
                bubbleModuleEdit(m);
              }));
              blk.appendChild(ed);
              var del = ports.document.createElement('button');
              del.type = 'button';
              del.className = 'dshwv-bubmini';
              del.textContent = '✕';
              del.title = '删除该模块';
              del.addEventListener('click', lifecycle.guard(function (e) {
                e.stopPropagation();
                bubblePvDelBlock(ri, mIdx);
              }));
              blk.appendChild(del);
              bar.appendChild(blk);
            })(rowMods[mi], mi);
          }
          if (!isImgRow) {
            var add = ports.document.createElement('button');
            add.type = 'button';
            add.className = 'dshwv-pvadd';
            add.textContent = '+';
            add.title = '把模块加入同一行(默认文本,并排显示;其余类型可把上方色板拖进本行)';
            add.addEventListener('click', lifecycle.guard(function (e) {
              e.stopPropagation();
              bubblePvAddToRow(ri);
            }));
            bar.appendChild(add);
          }
          function highlight(zone) {
            bubblePvZone = zone;
            bar.style.boxShadow = '';
            bar.style.outline = '';
            if (zone === 'join') bar.style.outline = '2px solid rgba(32,49,112,.55)'; else {
              var sh = bubbleDropShadow(zone);
              if (sh) bar.style.boxShadow = sh;
            }
          }
          bar.addEventListener('dragover', lifecycle.guard(function (e) {
            try {
              var isMod = !!bubbleModDrag;
              var isRow = bubbleRowDragIdx !== null && bubbleRowDragIdx !== undefined;
              var isPal = !isMod && !isRow && !!bubbleDragKey;
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
          }));
          bar.addEventListener('dragleave', lifecycle.guard(function () {
            bubblePvZone = '';
            bar.style.boxShadow = '';
            bar.style.outline = '';
          }));
          bar.addEventListener('drop', lifecycle.guard(function (e) {
            try {
              e.preventDefault();
              e.stopPropagation();
              var zone = bubblePvZone;
              bubblePvZone = '';
              bar.style.boxShadow = '';
              bar.style.outline = '';
              if (bubbleRowDragIdx !== null && bubbleRowDragIdx !== undefined) {
                var fromRow = bubbleRowDragIdx;
                bubbleRowDragIdx = null;
                if (fromRow !== ri) bubblePvMoveRow(fromRow, ri, zone);
                return;
              }
              if (bubbleModDrag) {
                var md = bubbleModDrag;
                bubbleModDrag = null;
                if (zone === 'join') zone = 'after';
                bubblePvDropBlock(md.ri, md.mi, ri, zone);
                return;
              }
              if (bubbleDragKey) {
                var key = bubbleDragKey;
                bubbleDragKey = null;
                bubblePvPaletteToRow(key, ri);
                return;
              }
            } catch (err) {}
          }));
          bubblePvEl.appendChild(bar);
        })(r, rows[r]);
      }
      try {
        var rw = ports.root && (ports.root.offsetWidth || ports.root.getBoundingClientRect().width) || 280;
        ports.bubblePreviewInto(bubblePvPrevEl, it.modules || [], Math.min(rw, 408));
      } catch (err) {}
    }
var bubbleRowDragIdx = null;
function bubbleItemDiscard() {
      try {
        var idx = bubbleEditItemIdx;
        var snap = bubbleItemSnap;
        bubbleItemSnap = null;
        if (idx >= 0 && idx < bubbleEditItems.length && snap) bubbleEditItems[idx] = snap;
      } catch (err) {}
      closeBubbleItem();
      renderBubbleFirst();
      renderBubbleMore();
    }
function bubbleItemSave() {
      ports.showConfirm('保存该泡泡内容?', function () {
        var it = bubbleEditTarget();
        if (it) {
          it.kind = 'custom';
          if (!it.modules) it.modules = [];
        }
        bubbleItemSnap = null;
        closeBubbleItem();
        renderBubbleFirst();
        renderBubbleMore();
      });
    }
function bubbleItemResetToDefault() {
      ports.showConfirm('恢复该泡泡为默认内容?', function () {
        var it = bubbleEditTarget();
        if (it) {
          it.kind = it.kind === 'random' ? 'random' : 'normal';
          it.modules = undefined;
          bubbleEditEnsureModules(it);
        }
        renderBubblePv();
      });
    }
bubbleMask = ports.document.createElement('div');
bubbleMask.className = 'dshwv-bubmask';
bubbleMask.style.display = 'none';
var bubbleCard = ports.document.createElement('div');
bubbleCard.className = 'dshwv-bubcard';
var bubbleTitle = ports.document.createElement('div');
bubbleTitle.className = 'dshwv-bubtitle';
bubbleTitle.textContent = '自定义泡泡';
bubbleCard.appendChild(bubbleTitle);
var bubbleSecFirst = ports.document.createElement('div');
bubbleSecFirst.className = 'dshwv-bubsec dshwv-bubsec-first';
bubbleSecFirst.textContent = '首次点击桌宠弹出内容';
bubbleCard.appendChild(bubbleSecFirst);
var bubbleFirstRow = ports.document.createElement('div');
bubbleFirstRow.className = 'dshwv-bubrow';
bubbleFirstChipEl = ports.document.createElement('div');
bubbleFirstChipEl.className = 'dshwv-bubchip';
bubbleFirstChipEl.title = '点击编辑该泡泡的内容模块';
bubbleFirstChipEl.addEventListener('click', lifecycle.guard(function (e) {
      e.stopPropagation();
      openBubbleItem(0);
    }));
bubbleFirstRow.appendChild(bubbleFirstChipEl);
bubbleCard.appendChild(bubbleFirstRow);
var bubbleSecMore = ports.document.createElement('div');
bubbleSecMore.className = 'dshwv-bubsec';
bubbleSecMore.textContent = '点击泡泡后的内容';
bubbleCard.appendChild(bubbleSecMore);
bubbleMoreListEl = ports.document.createElement('div');
bubbleMoreListEl.addEventListener('dragover', lifecycle.guard(function (e) {
      try {
        if (e.target && e.target.closest && e.target.closest('.dshwv-bubrow-drag')) return;
        e.preventDefault();
      } catch (err) {}
    }));
bubbleMoreListEl.addEventListener('drop', lifecycle.guard(function (e) {
      try {
        if (e.target && e.target.closest && e.target.closest('.dshwv-bubrow-drag')) return;
        e.preventDefault();
        bubbleDropToEnd();
      } catch (err) {}
    }));
bubbleCard.appendChild(bubbleMoreListEl);
var bubbleAddBtn = ports.document.createElement('button');
bubbleAddBtn.type = 'button';
bubbleAddBtn.className = 'dshwv-bubadd';
bubbleAddBtn.textContent = '+ 添加泡泡(点完上一个后显示下一个)';
bubbleAddBtn.addEventListener('click', lifecycle.guard(bubbleAddMore));
bubbleCard.appendChild(bubbleAddBtn);
var bubbleInteractionHint = ports.document.createElement('div');
bubbleInteractionHint.className = 'dshwv-bubsec';
bubbleInteractionHint.textContent = '点桌宠只互动；点泡泡切换，最后一泡再点收起';
bubbleInteractionHint.title = '第一次点桌宠打开泡泡。泡泡打开后可继续按压桌宠，当前内容不会切换或消失。';
bubbleCard.appendChild(bubbleInteractionHint);
var bubbleBtns = ports.document.createElement('div');
bubbleBtns.className = 'dshwv-bubbtns';
function bubbleBtn(label, cls, fn) {
      var b = ports.document.createElement('button');
      b.type = 'button';
      b.className = 'dshwv-bubbtn ' + cls;
      b.textContent = label;
      b.addEventListener('click', lifecycle.guard(function (e) {
        e.stopPropagation();
        fn();
      }));
      return b;
    }
bubbleBtns.appendChild(bubbleBtn('取消', 'dshwv-bubbtn-no', function () {
      if (bubbleEditorDirty()) ports.showConfirm('放弃未保存的更改?', function () {
        closeBubbleEditor();
      }); else closeBubbleEditor();
    }));
bubbleBtns.appendChild(bubbleBtn('重置', 'dshwv-bubbtn-no', bubbleEditorReset));
bubbleBtns.appendChild(bubbleBtn('保存', 'dshwv-bubbtn-ok', bubbleEditorSave));
bubbleCard.appendChild(bubbleBtns);
bubbleMask.appendChild(bubbleCard);
ports.document.body.appendChild(bubbleMask);
bubbleItemMask = ports.document.createElement('div');
bubbleItemMask.className = 'dshwv-bubmask';
bubbleItemMask.style.display = 'none';
var bubbleItemCard = ports.document.createElement('div');
bubbleItemCard.className = 'dshwv-bubcard';
bubbleItemTitleEl = ports.document.createElement('div');
bubbleItemTitleEl.className = 'dshwv-bubtitle';
bubbleItemCard.appendChild(bubbleItemTitleEl);
bubbleItemSideEl = ports.document.createElement('div');
bubbleItemSideEl.className = 'dshwv-sidebar';
bubbleItemSideEl.style.display = 'none';
bubbleItemCard.appendChild(bubbleItemSideEl);
var bubbleSecPal = ports.document.createElement('div');
bubbleSecPal.className = 'dshwv-bubsec dshwv-bubsec-first';
bubbleSecPal.textContent = '可选模块(点击或拖入下方泡泡框)';
bubbleItemCard.appendChild(bubbleSecPal);
bubblePalEl = ports.document.createElement('div');
bubblePalEl.className = 'dshwv-bubpal';
bubbleItemCard.appendChild(bubblePalEl);
var bubbleSecPv = ports.document.createElement('div');
bubbleSecPv.className = 'dshwv-bubsec';
bubbleSecPv.textContent = '泡泡内容预览(同一行模块并排显示,≤6 个;拖模块块到行左/右边缘=并入该行、上/下=另起一行;拖 ⠿ 整行排序)';
bubbleItemCard.appendChild(bubbleSecPv);
bubblePvEl = ports.document.createElement('div');
bubblePvEl.className = 'dshwv-bubpvbox';
bubblePvEl.addEventListener('dragover', lifecycle.guard(function (e) {
      try {
        if (e.target && e.target.closest && e.target.closest('.dshwv-pvrow')) return;
        e.preventDefault();
      } catch (err) {}
    }));
bubblePvEl.addEventListener('drop', lifecycle.guard(function (e) {
      try {
        if (e.target && e.target.closest && e.target.closest('.dshwv-pvrow')) return;
        e.preventDefault();
        if (bubbleRowDragIdx !== null && bubbleRowDragIdx !== undefined) {
          var fr = bubbleRowDragIdx;
          bubbleRowDragIdx = null;
          bubblePvMoveRowEnd(fr);
          return;
        }
        if (bubbleModDrag) {
          var mdd = bubbleModDrag;
          bubbleModDrag = null;
          bubblePvDropBlockEnd(mdd.ri, mdd.mi);
          return;
        }
        var key = bubbleDragKey;
        if (!key) return;
        bubbleDragKey = null;
        if (key === 'image') {
          bubblePickImageToAdd();
          return;
        }
        if (key === 'wizard') {
          bubbleModuleAdd({
            type: 'text',
            text: '新内容',
            size: 6,
            bold: true
          });
          return;
        }
        var m = bubblePaletteModule(key);
        if (m) bubbleModuleAdd(m);
      } catch (err) {}
    }));
bubbleItemCard.appendChild(bubblePvEl);
var bubblePvPrevEl = ports.document.createElement('div');
bubblePvPrevEl.className = 'dshwv-bubprev';
bubbleItemCard.appendChild(bubblePvPrevEl);
var bubbleItemBtns = ports.document.createElement('div');
bubbleItemBtns.className = 'dshwv-bubbtns';
bubbleItemBtns.appendChild(bubbleBtn('取消', 'dshwv-bubbtn-no', function () {
      ports.showConfirm('放弃该泡泡的未保存修改?', function () {
        bubbleItemDiscard();
      });
    }));
bubbleItemBtns.appendChild(bubbleBtn('恢复默认', 'dshwv-bubbtn-no', bubbleItemResetToDefault));
bubbleItemBtns.appendChild(bubbleBtn('保存', 'dshwv-bubbtn-ok', bubbleItemSave));
bubbleItemCard.appendChild(bubbleItemBtns);
bubbleItemMask.appendChild(bubbleItemCard);
ports.document.body.appendChild(bubbleItemMask);
var moduleMask = null;
var moduleEditRef = null;
var moduleOnSave = null;
var moduleEditNew = false;
var moduleTitleEl = null;
var moduleBodyEl = null;
var moduleColorEl = null;
var moduleSizeEl = null;
var moduleImgSelect = null;
var moduleImgDrop = null;
var moduleImgPreviewEl = null;
var bubbleImgList = [];
function loadBubbleImgs(cb) {
      try {
        ports.assetClient.bubbleImages().then(lifecycle.guard(function (d) {
          if (d) {
            bubbleImgList = d.images;
            ports.assetWarning(d);
            if (cb) cb();
          }
        })).catch(lifecycle.guard(function () {}));
      } catch (err) {}
    }
async function bubbleUploadImg(file, cb) {
      try {
        ports.WhaleMediaGuard.checkFile(file, 'bubble');
        var bytes = await file.arrayBuffer();
        var media = ports.WhaleMediaGuard.inspectImage(bytes, 'bubble');
        if (['png', 'apng', 'gif'].indexOf(media.format) < 0) throw new Error('泡泡图片请选择 PNG 或 GIF');
        var data = await ports.mediaDataUrl(new Blob([bytes], { type: media.mime }));
        if (lifecycle.disposed) return;
        var d = await ports.assetClient.uploadBubbleImage(file.name || '', data);
        if (lifecycle.disposed) return;
        if (!d || !d.ok || !Array.isArray(d.images)) throw new Error(d && d.error || '图片保存失败，请重试');
        bubbleImgList = d.images;
        ports.assetWarning(d);
        if (cb) cb(true);
      } catch (err) {
        if (lifecycle.disposed) return;
        ports.assetNotice(err.message);
        if (cb) cb(false);
      }
    }
var bubbleFontOpenMenu = null;
function visibleTopZ() {
      var top = 20500;
      var cand = [bubbleMask, bubbleItemMask, moduleMask, ports.usageMoreMask, qeditEl, ports.window.__dshwRemindMask];
      function eff(el) {
        try {
          if (!el) return 0;
          if (el.style && el.style.display === 'none') return 0;
          var s = el.style ? el.style.zIndex || '' : '';
          if (!s) {
            var cs = ports.window.getComputedStyle ? ports.window.getComputedStyle(el) : null;
            if (cs) s = cs.zIndex;
          }
          var n = parseFloat(s);
          return isFinite(n) ? n : 0;
        } catch (err) {
          return 0;
        }
      }
      for (var i = 0; i < cand.length; i++) {
        var n = eff(cand[i]);
        if (n > top) top = n;
      }
      return top;
    }
function whaleZClean() {
      try {
        var zsEl = ports.document.getElementById('dshw-remind-overlay-z');
        if (zsEl) {
          try {
            ports.document.head.removeChild(zsEl);
          } catch (err) {}
        }
        if (!ports.window.__dshwRemindMask) {
          if (moduleMask && moduleMask.style.zIndex) moduleMask.style.zIndex = '';
          if (qeditEl && qeditEl.style.zIndex) qeditEl.style.zIndex = '';
        }
      } catch (err) {}
    }
function dshwDropOpen(menuEl, anchorEl) {
      try {
        if (menuEl.parentNode !== ports.document.body) ports.document.body.appendChild(menuEl);
        menuEl.style.position = 'fixed';
        menuEl.style.minWidth = '0px';
        menuEl.style.maxHeight = '220px';
        menuEl.style.left = '0px';
        menuEl.style.top = '0px';
        menuEl.classList.add('dshwv-rgbopen');
        var r = anchorEl.getBoundingClientRect();
        var vp = ports.viewport();
        var w = Math.max(20, Math.round(r.width));
        if (menuEl.classList && menuEl.classList.contains('dshwv-qcolmenu')) {
          try {
            var rowHost = anchorEl && anchorEl.parentNode ? anchorEl.parentNode.parentNode : null;
            if (rowHost && rowHost.querySelector) {
              var swEl = rowHost.querySelector('.dshwv-qcolorhost');
              if (swEl && swEl.offsetWidth > 0) w = Math.max(w, Math.round(r.width + swEl.offsetWidth));
            }
          } catch (err) {}
        }
        if (w > vp.w - 16) w = Math.max(20, vp.w - 16);
        menuEl.style.width = w + 'px';
        menuEl.style.maxWidth = 'none';
        var left = r.left;
        if (left + w > vp.w - 8) left = Math.max(8, vp.w - w - 8);
        menuEl.style.left = Math.round(left) + 'px';
        var below = Math.max(0, vp.h - r.bottom - 8);
        var above = Math.max(0, r.top - 8);
        var wantedH = Math.min(220, Math.max(36, Math.ceil(menuEl.scrollHeight || 0)));
        var openBelow = wantedH <= below || below >= above;
        var room = openBelow ? below : above;
        var maxH = Math.max(36, Math.min(220, room - 2));
        menuEl.style.maxHeight = Math.floor(maxH) + 'px';
        var measuredH = Math.min(maxH, Math.max(0, menuEl.getBoundingClientRect().height || wantedH));
        var top = openBelow ? r.bottom + 2 : r.top - measuredH - 2;
        top = Math.max(8, Math.min(top, vp.h - measuredH - 8));
        menuEl.style.top = Math.round(top) + 'px';
        var vTop = visibleTopZ();
        menuEl.style.zIndex = String(Math.max(26010, Math.round(vTop) + 10));
      } catch (err) {}
    }
var bubbleSysFontList = [];
var bubbleSysFontTried = false;
function refreshSystemFonts(onDone) {
      if (bubbleSysFontTried) {
        if (onDone) onDone();
        return;
      }
      bubbleSysFontTried = true;
      if (!ports.window.queryLocalFonts) {
        if (onDone) onDone();
        return;
      }
      try {
        ports.window.queryLocalFonts().then(lifecycle.guard(function (list) {
          try {
            var seen = {};
            var out = [];
            if (list && list.length) {
              for (var i = 0; i < list.length; i++) {
                var fam = String(list[i] && list[i].family || '');
                var lab = String(list[i] && (list[i].fullName || list[i].family) || fam);
                if (!fam) continue;
                if (fam.indexOf('"') >= 0 || fam.indexOf(',') >= 0) continue;
                var key = fam.toLowerCase();
                if (seen[key]) continue;
                seen[key] = true;
                out.push({
                  v: '"' + fam + '"',
                  l: lab
                });
              }
              out.sort(function (a, b) {
                return a.l < b.l ? -1 : a.l > b.l ? 1 : 0;
              });
            }
            bubbleSysFontList = out;
          } catch (err) {}
          if (onDone) onDone();
        })).catch(lifecycle.guard(function () {
          if (onDone) onDone();
        }));
      } catch (err) {
        if (onDone) onDone();
      }
    }
function bubbleFontEditRow(getVal, setVal) {
      var FONT_OPTIONS = [['', '默认字体'], ['"Microsoft YaHei",sans-serif', '微软雅黑'], ['"PingFang SC","Microsoft YaHei",sans-serif', '苹方/雅黑'], ['DengXian,"Microsoft YaHei",sans-serif', '等线'], ['SimSun,serif', '宋体'], ['SimHei,sans-serif', '黑体'], ['KaiTi,serif', '楷体'], ['FangSong,serif', '仿宋'], ['STKaiti,KaiTi,serif', '华文楷体'], ['"Noto Sans SC",sans-serif', 'Noto Sans SC'], ['"Source Han Sans SC",sans-serif', '思源黑体'], ['"Segoe UI",sans-serif', 'Segoe UI'], ['Arial,Helvetica,sans-serif', 'Arial'], ['Helvetica,Arial,sans-serif', 'Helvetica'], ['Verdana,sans-serif', 'Verdana'], ['Tahoma,sans-serif', 'Tahoma'], ['"Trebuchet MS",sans-serif', 'Trebuchet MS'], ['"Times New Roman",serif', 'Times New Roman'], ['Georgia,serif', 'Georgia'], ['"Courier New",monospace', 'Courier New'], ['Consolas,monospace', 'Consolas'], ['Impact,fantasy', 'Impact'], ['"Comic Sans MS",cursive', 'Comic Sans MS']];
      var row = ports.document.createElement('div');
      row.className = 'dshwv-audiorow';
      var fl = ports.document.createElement('span');
      fl.textContent = '字体';
      row.appendChild(fl);
      var box = ports.document.createElement('div');
      box.className = 'dshwv-rgbwrap dshwv-fontwrap';
      var head = ports.document.createElement('button');
      head.type = 'button';
      head.className = 'dshwv-rgbhead';
      head.title = '选择系统字体';
      box.appendChild(head);
      var menu = ports.document.createElement('div');
      menu.className = 'dshwv-rgbmenu dshwv-fontmenu';
      function currentVal() {
        return getVal ? String(getVal() || '') : '';
      }
      function labelOf(v) {
        for (var i = 0; i < FONT_OPTIONS.length; i++) if (FONT_OPTIONS[i][0] === v) return FONT_OPTIONS[i][1];
        if (v) return String(v).slice(0, 14);
        return '默认字体';
      }
      function syncHead() {
        var v = currentVal();
        head.textContent = labelOf(v);
        head.style.fontFamily = v || '';
        head.title = '当前: ' + (v || '默认字体') + ';点击选择系统字体';
      }
      function optionList() {
        var list = [];
        var seen = {};
        for (var i = 0; i < FONT_OPTIONS.length; i++) {
          list.push(FONT_OPTIONS[i]);
          seen[FONT_OPTIONS[i][0]] = true;
        }
        for (var s = 0; s < bubbleSysFontList.length; s++) {
          if (!seen[bubbleSysFontList[s].v]) {
            seen[bubbleSysFontList[s].v] = true;
            list.push([bubbleSysFontList[s].v, bubbleSysFontList[s].l]);
          }
        }
        return list;
      }
      function fill() {
        menu.innerHTML = '';
        var cur = currentVal();
        var all = optionList();
        for (var i = 0; i < all.length; i++) {
          (function (fv, flab) {
            var o = ports.document.createElement('div');
            o.className = 'dshwv-rgbopt' + (fv === cur ? ' dshwv-rgbcur' : '');
            o.textContent = flab;
            o.style.fontFamily = fv || '';
            o.addEventListener('click', lifecycle.guard(function () {
              if (setVal) setVal(fv);
              closeFontMenu();
              syncHead();
              fill();
            }));
            menu.appendChild(o);
          })(all[i][0], all[i][1]);
        }
      }
      box.appendChild(menu);
      function closeFontMenu() {
        menu.classList.remove('dshwv-rgbopen'); menu.remove();
        bubbleFontOpenMenu = null;
      }
      head.addEventListener('click', lifecycle.guard(function (e) {
        e.stopPropagation();
        if (bubbleFontOpenMenu === menu) {
          closeFontMenu();
          return;
        }
        if (bubbleFontOpenMenu) { bubbleFontOpenMenu.classList.remove('dshwv-rgbopen'); bubbleFontOpenMenu.remove(); }
        fill();
        bubbleFontOpenMenu = menu;
        dshwDropOpen(menu, head);
        refreshSystemFonts(function () {
          if (bubbleFontOpenMenu === menu && menu.classList.contains('dshwv-rgbopen')) {
            fill();
            dshwDropOpen(menu, head);
          }
        });
      }));
      if (!fontListenersBound) {
        fontListenersBound = true;
        lifecycle.listen(ports.document, 'pointerdown', lifecycle.guard(function (e) {
          if (!bubbleFontOpenMenu) return;
          try {
            if (e.target && e.target.closest && (e.target.closest('.dshwv-fontwrap') || e.target.closest('.dshwv-rgbmenu'))) return;
          } catch (err) {}
          bubbleFontOpenMenu.classList.remove('dshwv-rgbopen');
          bubbleFontOpenMenu.remove(); bubbleFontOpenMenu = null;
        }), true);
      }
      row.appendChild(box);
      syncHead();
      fill();
      return row;
    }
function moduleTypeName(t, m) {
      if (t === 'quota') return m?.windowDurationMins === 10080 ? '每周额度' : '5 小时额度';
      if (t === 'turn') return '上轮 token 用量';
      if (t === 'balance') return '余额数值';
      if (t === 'today') return '今日已观测';
      if (t === 'image') return '图片/动图';
      if (t === 'randimg') return '随机图片';
      if (t === 'random') return '随机语句模块';
      return '文本模块';
    }
function renderModuleEditor() {
      var m = moduleEditRef;
      if (moduleEditNew && m.type === 'text' && m.bold === undefined) m.bold = true;
      moduleColorEl = null;
      moduleSizeEl = null;
      moduleBodyEl.innerHTML = '';
      moduleTitleEl.textContent = (moduleEditNew ? '新增模块: ' : '编辑模块: ') + moduleTypeName(m.type, m);
      function moduleTplRow() {
        var row = ports.document.createElement('div');
        row.className = 'dshwv-audiorow';
        var lab = ports.document.createElement('span');
        lab.textContent = '内容';
        lab.style.flex = '0 0 auto';
        row.appendChild(lab);
        var inp = ports.document.createElement('input');
        inp.type = 'text';
        inp.style.flex = '1';
        inp.style.minWidth = '0';
        inp.style.boxSizing = 'border-box';
        inp.style.border = '1px solid rgba(32,49,112,.4)';
        inp.style.borderRadius = '6px';
        inp.style.padding = '3px 6px';
        inp.style.fontSize = '12px';
        inp.style.color = '#203170';
        inp.style.background = '#fff';
        inp.value = m.tpl || '';
        function hintOf() {
          if (m.type === 'balance') return '例: {balance_api}';
          if (m.type === 'today') return '例: 今日已观测 {expense_api}';
          if (m.type === 'quota') return '例: 剩余 {quota_left_round} · {quota_reset_short}';
          if (m.type === 'turn') return '例: 上轮使用 {turn_tokens} tokens';
          return '例: 当前 {status}';
        }
        var hp = hintOf();
        inp.placeholder = hp;
        inp.title = '输入内容;右侧 ? 查看可用占位符';
        inp.addEventListener('input', lifecycle.guard(function () {
          m.tpl = inp.value;
        }));
        row.appendChild(inp);
        var qb = ports.document.createElement('button');
        qb.type = 'button';
        qb.className = 'dshwv-tplq';
        qb.textContent = '?';
        qb.title = '可用占位符用法';
        qb.addEventListener('click', lifecycle.guard(function (e) {
          e.stopPropagation();
          ports.bubbleTplHelpToggle(m, qb);
        }));
        row.appendChild(qb);
        moduleBodyEl.appendChild(row);
      }
      if (moduleEditNew) {
        var tr = ports.document.createElement('div');
        tr.className = 'dshwv-audiorow';
        var tl = ports.document.createElement('span');
        tl.textContent = '类型';
        tr.appendChild(tl);
        var tsel = ports.document.createElement('select');
        tsel.className = 'dshwv-sound';
        var topts = [['text', '文本'], ['random', '随机语句模块'], ['image', '图片/动图'], ['randimg', '随机图片']];
        for (var ti2 = 0; ti2 < topts.length; ti2++) {
          var o2 = ports.document.createElement('option');
          o2.value = topts[ti2][0];
          o2.textContent = topts[ti2][1];
          tsel.appendChild(o2);
        }
        tsel.value = m.type;
        tsel.addEventListener('change', lifecycle.guard(function () {
          m.type = tsel.value;
          if (m.type === 'random' && !Array.isArray(m.lines)) m.lines = [];
          if (m.type === 'random' && m.bold === undefined) m.bold = true;
          if (m.type === 'text' && m.bold === undefined) m.bold = true;
          if (m.type === 'image' && !m.imgId) m.imgId = '';
          if (m.type === 'randimg' && !Array.isArray(m.imgs)) m.imgs = [];
          renderModuleEditor();
        }));
        tr.appendChild(tsel);
        ports.dshwCustSel(tsel);
        moduleBodyEl.appendChild(tr);
      }
      if (bubbleLib.length) {
        var lr2 = ports.document.createElement('div');
        lr2.className = 'dshwv-bubsec';
        lr2.textContent = '从模块库载入';
        moduleBodyEl.appendChild(lr2);
        for (var li3 = 0; li3 < bubbleLib.length; li3++) {
          (function (lb) {
            var lrow = ports.document.createElement('div');
            lrow.className = 'dshwv-bublibrow';
            var lbtn = ports.document.createElement('button');
            lbtn.type = 'button';
            lbtn.className = 'dshwv-bubnewbtn';
            lbtn.textContent = lb.name;
            lbtn.title = '将该模块配置载入当前编辑';
            lbtn.addEventListener('click', lifecycle.guard(function () {
              var c = ports.bubbleCloneModule(lb.module);
              var oldKeys = Object.keys(m);
              for (var kk = 0; kk < oldKeys.length; kk++) {
                try {
                  delete m[oldKeys[kk]];
                } catch (err) {}
              }
              var nk = Object.keys(c);
              for (var j2 = 0; j2 < nk.length; j2++) m[nk[j2]] = c[nk[j2]];
              moduleColorEl = null;
              moduleSizeEl = null;
              renderModuleEditor();
            }));
            lrow.appendChild(lbtn);
            var ldel = ports.document.createElement('button');
            ldel.type = 'button';
            ldel.className = 'dshwv-bubmini';
            ldel.textContent = '✕';
            ldel.title = '从模块库删除';
            ldel.addEventListener('click', lifecycle.guard(function () {
              ports.showConfirm('从模块库删除「' + lb.name + '」?', function () {
                bubbleLibDel(lb.id);
                renderModuleEditor();
                if (bubblePalEl) renderBubblePal();
              });
            }));
            lrow.appendChild(ldel);
            moduleBodyEl.appendChild(lrow);
          })(bubbleLib[li3]);
        }
      }
      if (m.type === 'text') {
        var ti = ports.document.createElement('input');
        ti.type = 'text';
        ti.className = 'dshwv-cropname';
        ti.maxLength = 60;
        ti.value = m.text || '';
        ti.placeholder = '文本内容';
        ti.addEventListener('input', lifecycle.guard(function () {
          m.text = ti.value || ' ';
        }));
        moduleBodyEl.appendChild(ti);
      } else if (m.type === 'random') {
        var hint = ports.document.createElement('div');
        hint.className = 'dshwv-linehead';
        var hw = ports.document.createElement('span');
        hw.className = 'dshwv-lhw';
        hw.textContent = '权重';
        hint.appendChild(hw);
        var hc = ports.document.createElement('span');
        hc.className = 'dshwv-lhc';
        hc.textContent = '内容';
        hint.appendChild(hc);
        var ho = ports.document.createElement('span');
        ho.className = 'dshwv-lho';
        ho.textContent = '操作';
        hint.appendChild(ho);
        moduleBodyEl.appendChild(hint);
        if (!Array.isArray(m.lines)) m.lines = [];
        var listEl = ports.document.createElement('div');
        listEl.className = 'dshwv-listbox';
        listEl.style.maxHeight = '240px';
        listEl.style.overflowY = 'auto';
        listEl.style.paddingRight = '2px';
        moduleBodyEl.appendChild(listEl);
        function renderLines() {
          listEl.innerHTML = '';
          for (var i = 0; i < m.lines.length; i++) {
            (function (idx) {
              var l = m.lines[idx];
              if (!l) return;
              var wrap = ports.document.createElement('div');
              wrap.className = 'dshwv-linerow';
              var lr = ports.document.createElement('div');
              lr.className = 'dshwv-audiorow';
              var wt = ports.document.createElement('input');
              wt.type = 'number';
              wt.min = '1';
              wt.max = '99';
              wt.className = 'dshwv-linew';
              wt.value = String(l.w || 1);
              wt.title = '权重';
              wt.addEventListener('input', lifecycle.guard(function () {
                l.w = Math.max(1, Math.round(Number(wt.value) || 1));
              }));
              lr.appendChild(wt);
              var tx = ports.document.createElement('input');
              tx.type = 'text';
              tx.className = 'dshwv-linetx';
              tx.value = l.t;
              tx.placeholder = '句子';
              tx.addEventListener('input', lifecycle.guard(function () {
                l.t = tx.value || ' ';
              }));
              lr.appendChild(tx);
              var ed = ports.document.createElement('button');
              ed.type = 'button';
              ed.className = 'dshwv-bubmini';
              ed.textContent = '✎';
              ed.title = '该句悬浮样式编辑(句子/字号/字体/颜色/字形)';
              ed.addEventListener('click', lifecycle.guard(function (e) {
                e.stopPropagation();
                openQuickSentenceEditor(l, m, tx, ed);
              }));
              lr.appendChild(ed);
              var cp = ports.document.createElement('button');
              cp.type = 'button';
              cp.className = 'dshwv-bubmini';
              cp.textContent = '⧉';
              cp.title = '复制该行(含样式)';
              cp.addEventListener('click', lifecycle.guard(function () {
                m.lines.splice(idx + 1, 0, JSON.parse(JSON.stringify(l)));
                renderLines();
              }));
              lr.appendChild(cp);
              var del = ports.document.createElement('button');
              del.type = 'button';
              del.className = 'dshwv-linedel';
              del.textContent = '✕';
              del.title = '删除该句';
              del.addEventListener('click', lifecycle.guard(function () {
                m.lines.splice(idx, 1);
                renderLines();
              }));
              lr.appendChild(del);
              wrap.appendChild(lr);
              listEl.appendChild(wrap);
            })(i);
          }
        }
        renderLines();
        var addL = ports.document.createElement('button');
        addL.type = 'button';
        addL.className = 'dshwv-addline';
        addL.textContent = '+ 添加语句';
        addL.addEventListener('click', lifecycle.guard(function () {
          m.lines.push({
            t: '新句子',
            w: 1
          });
          renderLines();
        }));
        moduleBodyEl.appendChild(addL);
      } else if (m.type === 'randimg') {
        if (!Array.isArray(m.imgs)) m.imgs = [];
        var randomImageHint = ports.document.createElement('div'); randomImageHint.className = 'dshwv-bubhint';
        randomImageHint.textContent = '每次打开泡泡时按权重随机抽取一张图片。图片可先在资源管理中导入。'; moduleBodyEl.appendChild(randomImageHint);
        var randomImageList = ports.document.createElement('div'); randomImageList.className = 'dshwv-listbox';
        randomImageList.style.maxHeight = '230px'; randomImageList.style.overflowY = 'auto'; moduleBodyEl.appendChild(randomImageList);
        function renderRandomImages() {
          randomImageList.innerHTML = '';
          for (var ri = 0; ri < m.imgs.length; ri++) (function (index) {
            var item = m.imgs[index] || (m.imgs[index] = { imgId: '', w: 1 });
            var row = ports.document.createElement('div'); row.className = 'dshwv-audiorow';
            var weight = ports.document.createElement('input'); weight.type = 'number'; weight.min = '1'; weight.max = '99';
            weight.className = 'dshwv-linew'; weight.value = String(item.w || 1); weight.title = '抽取权重';
            weight.addEventListener('input', lifecycle.guard(function () { item.w = Math.max(1, Math.round(Number(weight.value) || 1)); })); row.appendChild(weight);
            var select = ports.document.createElement('select'); select.className = 'dshwv-sound'; select.style.minWidth = '0';
            var empty = ports.document.createElement('option'); empty.value = ''; empty.textContent = '— 选择图片 —'; select.appendChild(empty);
            for (var bi = 0; bi < bubbleImgList.length; bi++) { var option = ports.document.createElement('option'); option.value = bubbleImgList[bi].id; option.textContent = bubbleImgList[bi].name; select.appendChild(option); }
            select.value = item.imgId || ''; select.addEventListener('change', lifecycle.guard(function () { item.imgId = select.value; })); row.appendChild(select); ports.dshwCustSel(select);
            var del = ports.document.createElement('button'); del.type = 'button'; del.className = 'dshwv-linedel'; del.textContent = '✕'; del.title = '移除这张图片';
            del.addEventListener('click', lifecycle.guard(function () { m.imgs.splice(index, 1); renderRandomImages(); })); row.appendChild(del);
            randomImageList.appendChild(row);
          })(ri);
        }
        var addRandomImage = ports.document.createElement('button'); addRandomImage.type = 'button'; addRandomImage.className = 'dshwv-addline'; addRandomImage.textContent = '+ 添加图片';
        addRandomImage.addEventListener('click', lifecycle.guard(function () { m.imgs.push({ imgId: bubbleImgList[0] && bubbleImgList[0].id || '', w: 1 }); renderRandomImages(); })); moduleBodyEl.appendChild(addRandomImage);
        var randomScaleRow = ports.document.createElement('div'); randomScaleRow.className = 'dshwv-audiorow';
        var randomScaleLabel = ports.document.createElement('span'); randomScaleLabel.textContent = '显示大小'; randomScaleRow.appendChild(randomScaleLabel);
        var randomScale = ports.document.createElement('input'); randomScale.type = 'range'; randomScale.min = '10'; randomScale.max = '100'; randomScale.step = '5'; randomScale.className = 'dshwv-cropzoom';
        randomScale.value = String(Math.round(Math.max(.1, Math.min(1, Number(m.imgScale) || 1)) * 100)); randomScaleRow.appendChild(randomScale);
        var randomScaleValue = ports.document.createElement('span'); randomScaleValue.className = 'dshwv-volpct'; randomScaleValue.textContent = randomScale.value + '%'; randomScaleRow.appendChild(randomScaleValue);
        randomScale.addEventListener('input', lifecycle.guard(function () { m.imgScale = Number(randomScale.value) / 100; randomScaleValue.textContent = randomScale.value + '%'; })); moduleBodyEl.appendChild(randomScaleRow);
        if (!bubbleImgList.length) loadBubbleImgs(renderRandomImages); else renderRandomImages();
      } else if (m.type === 'image') {
        moduleImgSelect = ports.document.createElement('select');
        moduleImgSelect.className = 'dshwv-sound';
        moduleBodyEl.appendChild(moduleImgSelect);
        moduleImgDrop = ports.dshwCustSel(moduleImgSelect);
        moduleImgPreviewEl = ports.document.createElement('img');
        moduleImgPreviewEl.className = 'dshwv-bubimgprev';
        moduleImgPreviewEl.alt = '';
        moduleBodyEl.appendChild(moduleImgPreviewEl);
        function fillImgSel() {
          moduleImgSelect.innerHTML = '';
          var opt0 = ports.document.createElement('option');
          opt0.value = '';
          opt0.textContent = '— 选择泡泡图库图片 —';
          moduleImgSelect.appendChild(opt0);
          for (var i = 0; i < bubbleImgList.length; i++) {
            var o = ports.document.createElement('option');
            o.value = bubbleImgList[i].id;
            o.textContent = bubbleImgList[i].name;
            moduleImgSelect.appendChild(o);
          }
          if (m.imgId) moduleImgSelect.value = m.imgId;
          moduleImgSelect.dispatchEvent(new Event('change'));
          if (moduleImgDrop) moduleImgDrop.refresh();
        }
        moduleImgSelect.addEventListener('change', lifecycle.guard(function () {
          m.imgId = moduleImgSelect.value;
          if (m.imgId) {
            moduleImgPreviewEl.src = '/dsh-whale/bubble-img.png?id=' + encodeURIComponent(m.imgId);
            moduleImgPreviewEl.style.display = 'block';
          } else moduleImgPreviewEl.style.display = 'none';
        }));
        var fileInput = ports.document.createElement('input');
        fileInput.type = 'file';
        fileInput.accept = 'image/png,image/gif';
        fileInput.style.display = 'none';
        var upBtn = ports.document.createElement('button');
        upBtn.type = 'button';
        upBtn.className = 'dshwv-snapbtn dshwv-snapbtn-no';
        upBtn.textContent = '上传图片(png/gif)';
        upBtn.addEventListener('click', lifecycle.guard(function () {
          fileInput.click();
        }));
        fileInput.addEventListener('change', lifecycle.guard(function () {
          var f = fileInput.files && fileInput.files[0];
          if (!f) return;
          bubbleUploadImg(f, function (ok) {
            if (ok) fillImgSel();
            fileInput.value = '';
          });
        }));
        moduleBodyEl.appendChild(upBtn);
        moduleBodyEl.appendChild(fileInput);
        var scRow = ports.document.createElement('div');
        scRow.className = 'dshwv-audiorow';
        var scL = ports.document.createElement('span');
        scL.textContent = '显示大小';
        scRow.appendChild(scL);
        var scInit = Number(m.imgScale);
        if (!isFinite(scInit) || scInit <= 0) scInit = 1;
        var scInp = ports.document.createElement('input');
        scInp.type = 'range';
        scInp.min = '10';
        scInp.max = '100';
        scInp.step = '5';
        scInp.className = 'dshwv-cropzoom';
        scInp.style.flex = '1';
        scInp.value = String(Math.round(scInit * 100));
        scInp.addEventListener('input', lifecycle.guard(function () {
          m.imgScale = Math.max(0.1, Math.min(1, Number(scInp.value) / 100));
          scVal.textContent = scInp.value + '%';
          try {
            if (moduleImgPreviewEl) moduleImgPreviewEl.style.maxWidth = Math.round(120 * m.imgScale) + 'px';
          } catch (err) {}
        }));
        scRow.appendChild(scInp);
        var scVal = ports.document.createElement('span');
        scVal.className = 'dshwv-volpct';
        scVal.textContent = scInp.value + '%';
        scRow.appendChild(scVal);
        moduleBodyEl.appendChild(scRow);
        try {
          if (moduleImgPreviewEl) moduleImgPreviewEl.style.maxWidth = Math.round(120 * scInit) + 'px';
        } catch (err) {}
        if (!bubbleImgList.length) loadBubbleImgs(fillImgSel); else fillImgSel();
      } else {
        {
          var note = ports.document.createElement('div');
          note.className = 'dshwv-bubhint';
          note.textContent = '该模块为内置数值,内容自动获取,可调下方颜色/字号';
          moduleBodyEl.appendChild(note);
          moduleTplRow();
        }
      }
      if (m.type !== 'image' && m.type !== 'randimg' && m.type !== 'random') {
        var sec = ports.document.createElement('div');
        sec.className = 'dshwv-bubsec';
        sec.textContent = '样式';
        moduleBodyEl.appendChild(sec);
        moduleBodyEl.appendChild(bubbleFontEditRow(function () {
          return m.fontFamily || '';
        }, function (v) {
          m.fontFamily = v || '';
        }));
        var sizeRow = ports.document.createElement('div');
        sizeRow.className = 'dshwv-audiorow';
        var sl = ports.document.createElement('span');
        sl.textContent = '字号';
        sizeRow.appendChild(sl);
        moduleSizeEl = ports.document.createElement('input');
        moduleSizeEl.type = 'range';
        moduleSizeEl.min = '1';
        moduleSizeEl.max = '50';
        moduleSizeEl.step = '1';
        moduleSizeEl.className = 'dshwv-cropzoom';
        moduleSizeEl.value = String(m.size || 6);
        sizeRow.appendChild(moduleSizeEl);
        var sizeNum = ports.document.createElement('span');
        sizeNum.className = 'dshwv-volpct';
        sizeNum.textContent = String(m.size || 6);
        moduleSizeEl.addEventListener('input', lifecycle.guard(function () {
          sizeNum.textContent = moduleSizeEl.value;
        }));
        sizeRow.appendChild(sizeNum);
        moduleBodyEl.appendChild(sizeRow);
        var glyphRow = ports.document.createElement('div');
        glyphRow.className = 'dshwv-audiorow';
        function glyphBox(label, key) {
          var lab = ports.document.createElement('label');
          lab.style.display = 'inline-flex';
          lab.style.alignItems = 'center';
          lab.style.gap = '3px';
          lab.style.marginRight = '10px';
          var cb = ports.document.createElement('input');
          cb.type = 'checkbox';
          cb.checked = !!m[key];
          cb.addEventListener('change', lifecycle.guard(function () {
            m[key] = cb.checked;
          }));
          var tx = ports.document.createElement('span');
          tx.textContent = label;
          lab.appendChild(cb);
          lab.appendChild(tx);
          return lab;
        }
        glyphRow.appendChild(glyphBox('加粗', 'bold'));
        glyphRow.appendChild(glyphBox('斜体', 'italic'));
        glyphRow.appendChild(glyphBox('下划线', 'ul'));
        moduleBodyEl.appendChild(glyphRow);
        {
          var w3cc = qColorSelectBuild(m.rgb ? m.rgb : 'solid', function (v) {
            if (v === 'solid') {
              m.rgb = '';
              if (!m.color) m.color = '#203170';
            } else {
              m.rgb = v;
              m.color = '';
            }
            var mode2 = v === 'solid' ? 'solid' : v;
            w3cc.sync(mode2, m.color, function (hex) {
              m.color = hex;
            });
          });
          moduleBodyEl.appendChild(w3cc.row);
          w3cc.sync(m.rgb ? m.rgb : 'solid', m.color || '#203170', function (hex) {
            m.color = hex;
          });
        }
        {
          var bgCur = m.bgRgb ? m.bgRgb : m.bg ? 'solid' : 'none';
          var bgcc = qColorSelectBuild(bgCur, function (v) {
            if (v === 'none') {
              m.bgRgb = '';
              m.bg = '';
            } else if (v === 'solid') {
              m.bgRgb = '';
              if (!m.bg) m.bg = '#dbe4f5';
            } else {
              m.bgRgb = v;
              m.bg = '';
            }
            bgcc.sync(v === 'none' ? 'none' : v, m.bg, function (hex) {
              m.bg = hex;
            });
          }, {
            label: '底色',
            defaultHex: '#dbe4f5',
            defaultText: '默认',
            allowNone: true
          });
          moduleBodyEl.appendChild(bgcc.row);
          bgcc.sync(bgCur, m.bg || '#dbe4f5', function (hex) {
            m.bg = hex;
          });
        }
      }
    }
var moduleNamePromptModule = null;
function openModuleNamePrompt(m) {
      try {
        moduleNamePromptModule = m || moduleEditRef || null;
        moduleNameInput.value = '';
        moduleNamePromptMask.style.display = 'flex';
        lifecycle.timeout(function () {
          try {
            moduleNameInput.focus();
          } catch (err) {}
        }, 30);
      } catch (err) {}
    }
function closeModuleNamePrompt() {
      moduleNamePromptMask.style.display = 'none';
      moduleNamePromptModule = null;
    }
function saveModuleNamePrompt() {
      var m = moduleNamePromptModule || moduleEditRef;
      if (!m) {
        closeModuleNamePrompt();
        return;
      }
      bubbleLibAdd(moduleNameInput.value, m);
      moduleNameInput.value = '';
      closeModuleNamePrompt();
      if (bubblePalEl) renderBubblePal();
    }
function openModuleEditor(m, onSave, isNew) {
      try {
        whaleZClean();
        moduleEditRef = m;
        moduleOnSave = onSave || null;
        moduleEditNew = !!isNew;
        renderModuleEditor();
        moduleMask.style.display = 'flex';
      } catch (err) {}
    }
function closeModuleEditor(saved) {
      try {
        if (saved && moduleEditRef) {
          if (moduleColorEl) moduleEditRef.color = moduleColorEl.value === '#203170' && !moduleEditRef.color ? '' : moduleColorEl.value;
          if (moduleSizeEl) moduleEditRef.size = Math.max(1, Math.min(50, Math.round(Number(moduleSizeEl.value) || 6)));
          if (moduleEditRef.type === 'image' && !moduleEditRef.imgId) {
            ports.showConfirm('请先选择或上传一张图片', function () {});
            return;
          }
          if (moduleEditRef.type === 'randimg' && !(moduleEditRef.imgs || []).some(function (item) { return item && item.imgId; })) {
            ports.showConfirm('请至少选择一张随机图片', function () {});
            return;
          }
          if (moduleOnSave) moduleOnSave(moduleEditRef);
        }
        moduleMask.style.display = 'none';
        moduleEditRef = null;
        moduleOnSave = null;
        moduleEditNew = false;
      } catch (err) {
        moduleMask.style.display = 'none';
      }
    }
moduleMask = ports.document.createElement('div');
moduleMask.className = 'dshwv-bubmask';
moduleMask.style.display = 'none';
var moduleCard = ports.document.createElement('div');
moduleCard.className = 'dshwv-bubcard';
moduleTitleEl = ports.document.createElement('div');
moduleTitleEl.className = 'dshwv-bubtitle';
moduleCard.appendChild(moduleTitleEl);
moduleBodyEl = ports.document.createElement('div');
moduleCard.appendChild(moduleBodyEl);
var moduleBtns = ports.document.createElement('div');
moduleBtns.className = 'dshwv-bubbtns';
moduleBtns.appendChild(bubbleBtn('取消', 'dshwv-bubbtn-no', function () {
      closeModuleEditor(false);
    }));
var saveAsBtn = ports.document.createElement('button');
saveAsBtn.type = 'button';
saveAsBtn.className = 'dshwv-bubbtn dshwv-bubbtn-no';
saveAsBtn.textContent = '另存';
saveAsBtn.title = '另存为可选模块:把当前模块存入模块库,可在任意泡泡里复用';
saveAsBtn.addEventListener('click', lifecycle.guard(function (e) {
      e.stopPropagation();
      openModuleNamePrompt(moduleEditRef);
    }));
moduleBtns.appendChild(saveAsBtn);
moduleBtns.appendChild(bubbleBtn('保存', 'dshwv-bubbtn-ok', function () {
      closeModuleEditor(true);
    }));
moduleCard.appendChild(moduleBtns);
moduleMask.appendChild(moduleCard);
ports.document.body.appendChild(moduleMask);
var moduleNamePromptMask = ports.document.createElement('div');
moduleNamePromptMask.className = 'dshwv-confirmmask';
moduleNamePromptMask.style.display = 'none';
var moduleNamePromptCard = ports.document.createElement('div');
moduleNamePromptCard.className = 'dshwv-audiowin';
var moduleNamePromptTitle = ports.document.createElement('div');
moduleNamePromptTitle.className = 'dshwv-audiotitle';
moduleNamePromptTitle.textContent = '存为可选模块';
moduleNamePromptCard.appendChild(moduleNamePromptTitle);
var moduleNameInput = ports.document.createElement('input');
moduleNameInput.type = 'text';
moduleNameInput.className = 'dshwv-audionameinput';
moduleNameInput.maxLength = 20;
moduleNameInput.placeholder = '模块名称(留空自动编号)';
moduleNamePromptCard.appendChild(moduleNameInput);
var moduleNameBtns = ports.document.createElement('div');
moduleNameBtns.className = 'dshwv-cropbtns';
var moduleNameCancel = ports.document.createElement('button');
moduleNameCancel.type = 'button';
moduleNameCancel.className = 'dshwv-cropbtn dshwv-cropbtn-no';
moduleNameCancel.textContent = '取消';
moduleNameCancel.addEventListener('click', lifecycle.guard(closeModuleNamePrompt));
var moduleNameOk = ports.document.createElement('button');
moduleNameOk.type = 'button';
moduleNameOk.className = 'dshwv-cropbtn dshwv-cropbtn-ok';
moduleNameOk.textContent = '保存';
moduleNameOk.addEventListener('click', lifecycle.guard(saveModuleNamePrompt));
moduleNameBtns.appendChild(moduleNameCancel);
moduleNameBtns.appendChild(moduleNameOk);
moduleNamePromptCard.appendChild(moduleNameBtns);
moduleNamePromptMask.appendChild(moduleNamePromptCard);
ports.document.body.appendChild(moduleNamePromptMask);
moduleNameInput.addEventListener('keydown', lifecycle.guard(function (e) {
      try {
        if (e.key === 'Enter') saveModuleNamePrompt(); else if (e.key === 'Escape') closeModuleNamePrompt();
      } catch (err) {}
    }));
var bubbleLib = [];
function bubbleLibAdd(name, module) {
      try {
        if (!module) return null;
        var id = 'bmod_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 6);
        var it = {
          id: id,
          name: String(name || '').trim().slice(0, 20) || '模块' + (bubbleLib.length + 1),
          module: ports.bubbleCloneModule(module)
        };
        bubbleLib.push(it);
        return it;
      } catch (err) {
        return null;
      }
    }
function bubbleLibDel(id) {
      bubbleLib = bubbleLib.filter(function (x) {
        return x.id !== id;
      });
    }
var closeNoticeEditor = null;
function usageAlertBudgetEditor(key, onSave, customConfig, onCancel) {
      closeNoticeEditor?.();
      try {
        var isCost = key === 'turnCost';
        var isAlert = key === 'alert';
        var isWait = key === 'question' || key === 'approval';
        var cfg = customConfig || ports.getNoticeConfig(key) || {};
        var numDef = isAlert ? 50 : 20;
        var numInit = isAlert ? cfg.below != null ? cfg.below : numDef : cfg.amount != null ? cfg.amount : numDef;
        var nativeCurrency = cfg.currency || ports.getCurrency() || 'USD';
        var nativeDraft = Number(numInit);
        var step = {
          kind: 'custom',
          modules: JSON.parse(JSON.stringify(isCost ? (customConfig && Array.isArray(customConfig.lines) ? customConfig.lines : ports.usageTurnCostLines()) : isWait ? ports.usageWaitLinesOf(cfg, key) : ports.usageRemindLinesOf(cfg, isAlert)))
        };
        var bkEditItems = bubbleEditItems;
        var bkEditorSnap = bubbleEditorSnap;
        var bkItemSnap = bubbleItemSnap;
        var bkEditIdx = bubbleEditItemIdx;
        var bkSide = bubbleEditSide;
        var bkPal = bubblePalEl;
        var bkPv = bubblePvEl;
        var bkPrev = bubblePvPrevEl;
        var bkRenderPv = renderBubblePv;
        var bkQeditEnsure = qeditEnsure;
        var bkModMaskZ = moduleMask ? moduleMask.style.zIndex : '';
        bubbleEditItems = [step];
        bubbleEditItemIdx = 0;
        bubbleEditSide = -1;
        bubbleItemSnap = JSON.parse(JSON.stringify(step));
        bubbleEditorSnap = null;
        var mask = ports.document.createElement('div');
        mask.className = 'dshwv-bubmask';
        mask.style.zIndex = '26000';
        var card = ports.document.createElement('div');
        card.className = 'dshwv-bubcard';
        card.style.maxHeight = '88vh';
        card.style.overflow = 'hidden auto';
        var title = ports.document.createElement('div');
        title.className = 'dshwv-bubtitle';
        title.textContent = '编辑 ' + (isCost ? '每轮消耗' : isWait ? (key === 'approval' ? '授权' : '提问') : isAlert ? '余额预警' : '今日预算') + '提示内容(可拖动下方模块入框)';
        card.appendChild(title);
        var secCond = ports.document.createElement('div');
        secCond.className = 'dshwv-bubsec dshwv-bubsec-first';
        secCond.textContent = isCost ? '显示条件与关闭时间' : isWait ? '' : isAlert ? '触发条件(余额低于该值时提醒)' : '触发条件(今日已观测达到该值时提醒)';
        card.appendChild(secCond);
        var chk = ports.document.createElement('input');
        chk.type = 'checkbox';
        chk.className = 'dshwv-check';
        chk.checked = isCost ? ports.turnCostOn : !!cfg.on;
        var numInp = ports.document.createElement('input');
        numInp.type = 'number';
        numInp.min = '0';
        numInp.step = '0.01';
        numInp.className = 'dshwv-number';
        numInp.style.width = '80px';
        numInp.dataset.moneyInput = key;
        ports.WhaleMoney.bind(numInp, function () { return ports.WhaleMoney.formatNumber(nativeDraft, nativeCurrency); }, function (value) { numInp.value = value; });
        var condBox = ports.document.createElement('div');
        condBox.style.padding = '2px 0';
        condBox.style.display = 'flex';
        condBox.style.flexWrap = 'wrap';
        condBox.style.alignItems = 'center';
        condBox.style.gap = '6px 14px';
        condBox.style.textAlign = 'left';
        condBox.style.fontSize = '12px';
        condBox.style.color = '#203170';
        function segCond() {
          var s = ports.document.createElement('span');
          s.style.display = 'inline-flex';
          s.style.alignItems = 'center';
          s.style.gap = '5px';
          s.style.whiteSpace = 'nowrap';
          return s;
        }
        var gOn = segCond();
        gOn.appendChild(chk);
        gOn.appendChild(qLabel(isCost ? '启用每轮提示' : '启用提醒'));
        condBox.appendChild(gOn);
        var gNum = segCond();
        if (!isCost) {
          gNum.appendChild(qLabel(isAlert ? '余额 ≤ ' : '今日已观测 ≥ '));
          gNum.appendChild(numInp);
          var currencyUnit = qLabel('');
          ports.WhaleMoney.bind(currencyUnit, function () { return ' ' + ports.WhaleMoney.unit() + '时提醒'; });
          gNum.appendChild(currencyUnit);
          condBox.appendChild(gNum);
        }
        var condBrk = ports.document.createElement('span');
        condBrk.style.flex = '1 0 100%';
        condBrk.style.height = '0';
        condBrk.style.margin = '0';
        condBox.appendChild(condBrk);
        var acChk = ports.document.createElement('input');
        acChk.type = 'checkbox';
        acChk.className = 'dshwv-check';
        acChk.checked = isCost ? ports.turnCostCloseMs > 0 : cfg.autoClose !== false;
        var defSec = Number(cfg.ttlSec);
        if (isCost) defSec = Math.max(0, Math.round(ports.turnCostCloseMs / 1000));
        else if (!isFinite(defSec) || defSec <= 0) defSec = 6;
        var secInp = ports.document.createElement('input');
        secInp.type = 'number';
        secInp.min = '0';
        secInp.step = '1';
        secInp.className = 'dshwv-number';
        secInp.style.width = '56px';
        secInp.value = String(defSec);
        var gAc = segCond();
        gAc.appendChild(acChk);
        gAc.appendChild(qLabel('自动关闭'));
        condBox.appendChild(gAc);
        var gSec = segCond();
        gSec.appendChild(secInp);
        var lSec = qLabel('秒(0=不自动关闭)');
        lSec.style.opacity = '.75';
        lSec.style.fontSize = '11px';
        gSec.appendChild(lSec);
        condBox.appendChild(gSec);
        card.appendChild(condBox);
        if (isWait || customConfig && customConfig.layoutOnly) { condBox.style.display = 'none'; secCond.style.display = 'none'; }
        var secPal = ports.document.createElement('div');
        secPal.className = 'dshwv-bubsec dshwv-bubsec-first';
        secPal.textContent = '可选模块(点击或拖入下方内容框)';
        card.appendChild(secPal);
        bubblePalEl = ports.document.createElement('div');
        bubblePalEl.className = 'dshwv-bubpal';
        card.appendChild(bubblePalEl);
        var secPv = ports.document.createElement('div');
        secPv.className = 'dshwv-bubsec';
        secPv.textContent = isCost ? '提示内容(支持 {turn_title} {turn_primary} {turn_detail} {cost} 和 token 占位符)' : isWait ? '提示内容(支持 {session} 表示当前对话；模块可点击或拖入下方内容框)' : '提醒内容(同一行模块并排 ≤6;拖模块到行边缘=并排、上/下=拆行、拖 ⠿ 整行排序;{below} / {amount} 触发时替换)';
        card.appendChild(secPv);
        bubblePvEl = ports.document.createElement('div');
        bubblePvEl.className = 'dshwv-bubpvbox';
        card.appendChild(bubblePvEl);
        bubblePvPrevEl = ports.document.createElement('div');
        bubblePvPrevEl.className = 'dshwv-bubprev';
        card.appendChild(bubblePvPrevEl);
        bubblePvEl.addEventListener('dragover', lifecycle.guard(function (e) {
          try {
            if (e.target && e.target.closest && e.target.closest('.dshwv-pvrow')) return;
            e.preventDefault();
          } catch (err) {}
        }));
        bubblePvEl.addEventListener('drop', lifecycle.guard(function (e) {
          try {
            if (e.target && e.target.closest && e.target.closest('.dshwv-pvrow')) return;
            e.preventDefault();
            if (bubbleModDrag) {
              var mdd = bubbleModDrag;
              bubbleModDrag = null;
              bubblePvDropBlockEnd(mdd.ri, mdd.mi);
              return;
            }
            var key = bubbleDragKey;
            if (!key) return;
            bubbleDragKey = null;
            if (key === 'image') {
              bubblePickImageToAdd();
              return;
            }
            if (key === 'wizard') {
              bubbleModuleAdd({
                type: 'text',
                text: '新内容',
                size: 6,
                bold: true
              });
              return;
            }
            var m = bubblePaletteModule(key);
            if (m) bubbleModuleAdd(m);
          } catch (err) {}
        }));
        var btns = ports.document.createElement('div');
        btns.className = 'dshwv-bubbtns';
        var editorCompleted = false;
        function cleanup(outcome) {
          if (editorCompleted) return;
          closeNoticeEditor = null;
          try {
            ports.WhaleMoney.clearBindings(mask);
            ports.document.body.removeChild(mask);
            bubbleEditItems = bkEditItems;
            bubbleEditorSnap = bkEditorSnap;
            bubbleItemSnap = bkItemSnap;
            bubbleEditItemIdx = bkEditIdx;
            bubbleEditSide = bkSide;
            bubblePalEl = bkPal;
            bubblePvEl = bkPv;
            bubblePvPrevEl = bkPrev;
            renderBubblePv = bkRenderPv;
            qeditEnsure = bkQeditEnsure;
            if (moduleMask) moduleMask.style.zIndex = bkModMaskZ;
            var zsEl = ports.document.getElementById('dshw-remind-overlay-z');
            if (zsEl) {
              try {
                ports.document.head.removeChild(zsEl);
              } catch (err) {}
            }
            ports.window.__dshwRemindMask = null;
          } catch (err) {}
          if (!editorCompleted) {
            editorCompleted = true;
            if (outcome !== 'saved' && onCancel) onCancel();
          }
        }
        closeNoticeEditor = cleanup;
        var noBtn = ports.document.createElement('button');
        noBtn.type = 'button';
        noBtn.className = 'dshwv-bubbtn dshwv-bubbtn-no';
        noBtn.textContent = '取消';
        noBtn.addEventListener('click', lifecycle.guard(cleanup));
        btns.appendChild(noBtn);
        var resBtn = ports.document.createElement('button');
        resBtn.type = 'button';
        resBtn.className = 'dshwv-bubbtn dshwv-bubbtn-no';
        resBtn.textContent = '恢复默认';
        resBtn.title = '恢复为默认提醒内容(触发条件保持不变)';
        resBtn.addEventListener('click', lifecycle.guard(function () {
          step.modules = JSON.parse(JSON.stringify(isCost ? ports.usageTurnCostDefaultLines() : isWait ? ports.usageWaitDefaultLines(key) : ports.usageRemindDefaultLines(isAlert)));
          renderBubblePv();
        }));
        btns.appendChild(resBtn);
        var okBtn = ports.document.createElement('button');
        okBtn.type = 'button';
        okBtn.className = 'dshwv-bubbtn dshwv-bubbtn-ok';
        okBtn.textContent = '保存';
        okBtn.addEventListener('click', lifecycle.guard(function () {
          if (!isCost && !isWait && !numInp.reportValidity()) return;
          try {
            bubbleRowsCanon(step.modules);
          } catch (err) {}
          var o = {
            on: chk.checked,
            lines: JSON.parse(JSON.stringify(step.modules)),
            autoClose: isCost ? Number(secInp.value) > 0 : acChk.checked,
            ttlSec: isCost && !acChk.checked ? 0 : Math.max(0, Number(secInp.value) || 0)
          };
          if (!isCost && !isWait) { if (isAlert) o.below = nativeDraft; else o.amount = nativeDraft; }
          cleanup('saved');
          if (onSave) onSave(o);
        }));
        btns.appendChild(okBtn);
        card.appendChild(btns);
        try {
          if (moduleMask) moduleMask.style.zIndex = '27000';
        } catch (err) {}
        var remindZStyle = ports.document.createElement('style');
        remindZStyle.id = 'dshw-remind-overlay-z';
        remindZStyle.textContent = '.dshwv-confirmmask,.dshwv-cropmask,.dshwv-audiomask,.dshwv-snapmask,.dshwv-usage-mask{z-index:28500!important}';
        ports.document.head.appendChild(remindZStyle);
        var qeditEnsureSuper = bkQeditEnsure;
        qeditEnsure = function () {
          var el = qeditEnsureSuper();
          try {
            if (el) el.style.zIndex = '28000';
          } catch (err) {}
          return el;
        };
        try {
          if (qeditEl) qeditEl.style.zIndex = '28000';
        } catch (err) {}
        var renderPvSuper = bkRenderPv;
        renderBubblePv = function () {
          try {
            renderPvSuper();
          } catch (err) {}
          try {
            var it = bubbleEditTarget();
            var below = isAlert ? nativeDraft : null;
            var amount = isAlert || isCost || isWait ? null : nativeDraft;
            var previewNotice = ports.WhaleTurnNotice.snapshot({ ok: true, amount: 0.08, costState: 'estimated', tokens: 12840, sessionLabel: '当前对话', byModel: { preview: { input_tokens: 10240, output_tokens: 2600, cached_input_tokens: 6000, reasoning_output_tokens: 800 } } }, ports.getCurrency());
            if (customConfig && customConfig.previewNotice) previewNotice = customConfig.previewNotice;
            if (it && Array.isArray(it.modules) && bubblePvPrevEl) ports.bubblePreviewInto(bubblePvPrevEl, ports.usageAlertModsResolved(it.modules, below, amount, isCost || customConfig ? previewNotice : null));
          } catch (err) {}
        };
        function editNativeAmount() {
          try {
            var inputValue = Number(numInp.value);
            if (!isFinite(inputValue) || inputValue < 0 || numInp.value === '') throw new Error('请输入有效金额');
            nativeDraft = ports.WhaleMoney.fromDisplay(inputValue, nativeCurrency);
            numInp.setCustomValidity(''); renderBubblePv();
          } catch (err) { numInp.setCustomValidity(err.message); }
        }
        if (!isCost && !isWait) numInp.addEventListener('input', lifecycle.guard(editNativeAmount));
        chk.addEventListener('change', lifecycle.guard(renderBubblePv));
        mask.appendChild(card);
        mask.addEventListener('click', lifecycle.guard(function (e) {
          if (e.target === mask) cleanup();
        }));
        ports.window.__dshwRemindMask = mask;
        ports.document.body.appendChild(mask);
        renderBubblePal();
        renderBubblePv();
      } catch (err) {}
    }
function dispose() {
  closeNoticeEditor?.(); qeditClose(); bubbleColorSelect.dispose(); lifecycle.dispose();
  bubbleMask?.remove(); bubbleItemMask?.remove(); moduleMask?.remove(); qeditEl?.remove(); moduleNamePromptMask?.remove();
}
return { dispose, usageAlertBudgetEditor, bubbleDefaultQueue, openBubbleEditor, bubbleUploadImg, dshwDropOpen,
  replaceImages(images) { bubbleImgList = images; }, replaceLibrary(library) { bubbleLib = library; }
};
}
