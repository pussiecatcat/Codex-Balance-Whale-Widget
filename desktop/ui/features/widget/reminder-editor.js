import { openOver } from '../../services/layers.js';
// Reminder/budget editor. It borrows the bubble editor"s live state and its
// temporary render/quick-edit overrides through ctx; those bindings belong to
// the entry and must stay writable there.
export function createReminderEditor(deps) {
  const {
    document, window, WhaleMoney, WhaleTurnNotice, state, usagePanelApi, bubbleEditorState, ctx,
    qLabel, bubblePaletteModule, bubbleModuleAdd, bubblePickImageToAdd,
    bubblePvDropBlockEnd, bubbleRowsCanon, bubblePreviewInto, bubbleEditTarget,
    usageTurnCostLines, usageWaitLinesOf, usageRemindLinesOf,
    usageTurnCostDefaultLines, usageWaitDefaultLines, usageRemindDefaultLines,
    usageAlertModsResolved, getAccountMode = () => 'api',
  } = deps;
  return function usageAlertBudgetEditor(key, onSave, customConfig, onCancel) {
      try {
        var isCost = key === 'turnCost';
        var isAlert = key === 'alert';
        var isWait = key === 'question' || key === 'approval';
        var templateMode = isCost ? (customConfig && customConfig.templateMode || getAccountMode()) : null;
        var cfg = customConfig || (isWait ? ((usagePanelApi.getUsageSet() || {}).events || {})[key] : (usagePanelApi.getUsageSet() || ({}))[isCost ? 'turnCost' : isAlert ? 'alert' : 'budget']) || ({});
        var numDef = isAlert ? 50 : 20;
        var numInit = isAlert ? cfg.below != null ? cfg.below : numDef : cfg.amount != null ? cfg.amount : numDef;
        var nativeCurrency = cfg.currency || state.currency || 'USD';
        var nativeDraft = Number(numInit);
        var step = {
          kind: 'custom',
          modules: JSON.parse(JSON.stringify(isCost ? (customConfig && Array.isArray(customConfig.lines) && customConfig.lines.length ? customConfig.lines : usageTurnCostLines(templateMode)) : isWait ? usageWaitLinesOf(cfg, key) : usageRemindLinesOf(cfg, isAlert)))
        };
        var bkEditItems = bubbleEditorState.items;
        var bkEditorSnap = bubbleEditorState.editorSnap;
        var bkItemSnap = bubbleEditorState.itemSnap;
        var bkEditIdx = bubbleEditorState.itemIdx;
        var bkSide = bubbleEditorState.itemSide;
        var bkPal = bubbleEditorState.palEl;
        var bkPv = bubbleEditorState.pvEl;
        var bkPrev = bubbleEditorState.pvPrevEl;
        var bkRenderPv = ctx.renderPv;
        var bkQeditEnsure = ctx.qeditEnsure;
        var bkModMaskZ = ctx.moduleMask ? ctx.moduleMask.style.zIndex : '';
        bubbleEditorState.items = [step];
        bubbleEditorState.itemIdx = 0;
        bubbleEditorState.itemSide = -1;
        bubbleEditorState.itemSnap = JSON.parse(JSON.stringify(step));
        bubbleEditorState.editorSnap = null;
        var mask = document.createElement('div');
        mask.className = 'dshwv-bubmask';
        openOver(null, mask);
        var card = document.createElement('div');
        card.className = 'dshwv-bubcard';
        card.style.maxHeight = '88vh';
        card.style.overflow = 'hidden auto';
        var title = document.createElement('div');
        title.className = 'dshwv-bubtitle';
        title.textContent = '编辑 ' + (isCost ? (templateMode === 'subscription' ? 'Codex 订阅任务用量' : 'API 任务用量') : isWait ? (key === 'approval' ? '授权' : '提问') : isAlert ? '余额预警' : '今日预算') + '提示内容(可拖动下方模块入框)';
        card.appendChild(title);
        var secCond = document.createElement('div');
        secCond.className = 'dshwv-bubsec dshwv-bubsec-first';
        secCond.textContent = isCost ? '显示条件与关闭时间' : isWait ? '' : isAlert ? '触发条件(余额低于该值时提醒)' : '触发条件(今日已观测达到该值时提醒)';
        card.appendChild(secCond);
        var chk = document.createElement('input');
        chk.type = 'checkbox';
        chk.className = 'dshwv-check';
        chk.checked = isCost ? ctx.turnCostOn : !!cfg.on;
        var numInp = document.createElement('input');
        numInp.type = 'number';
        numInp.min = '0';
        numInp.step = '0.01';
        numInp.className = 'dshwv-number';
        numInp.style.width = '80px';
        numInp.dataset.moneyInput = key;
        WhaleMoney.bind(numInp, function () { return WhaleMoney.formatNumber(nativeDraft, nativeCurrency); }, function (value) { numInp.value = value; });
        var condBox = document.createElement('div');
        condBox.style.padding = '2px 0';
        condBox.style.display = 'flex';
        condBox.style.flexWrap = 'wrap';
        condBox.style.alignItems = 'center';
        condBox.style.gap = '6px 14px';
        condBox.style.textAlign = 'left';
        condBox.className += ' dshwv-form-inline';
        function segCond() {
          var s = document.createElement('span');
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
          WhaleMoney.bind(currencyUnit, function () { return ' ' + WhaleMoney.unit() + '时提醒'; });
          gNum.appendChild(currencyUnit);
          condBox.appendChild(gNum);
        }
        var condBrk = document.createElement('span');
        condBrk.style.flex = '1 0 100%';
        condBrk.style.height = '0';
        condBrk.style.margin = '0';
        condBox.appendChild(condBrk);
        var acChk = document.createElement('input');
        acChk.type = 'checkbox';
        acChk.className = 'dshwv-check';
        acChk.checked = isCost ? ctx.turnCostCloseMs > 0 : cfg.autoClose !== false;
        var defSec = Number(cfg.ttlSec);
        if (isCost) defSec = Math.max(0, Math.round(ctx.turnCostCloseMs / 1000));
        else if (!isFinite(defSec) || defSec <= 0) defSec = 6;
        var secInp = document.createElement('input');
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
        lSec.className += ' dshwv-hint-dim';
        gSec.appendChild(lSec);
        condBox.appendChild(gSec);
        card.appendChild(condBox);
        if (isWait || customConfig && customConfig.layoutOnly) { condBox.style.display = 'none'; secCond.style.display = 'none'; }
        var secPal = document.createElement('div');
        secPal.className = 'dshwv-bubsec dshwv-bubsec-first';
        secPal.textContent = '可选模块(点击或拖入下方内容框)';
        card.appendChild(secPal);
        bubbleEditorState.palEl = document.createElement('div');
        bubbleEditorState.palEl.className = 'dshwv-bubpal';
        card.appendChild(bubbleEditorState.palEl);
        var secPv = document.createElement('div');
        secPv.className = 'dshwv-bubsec';
        secPv.textContent = isCost ? '提示内容(支持 {turn_title} {turn_primary} {turn_detail} {cost} 和 token 占位符)' : isWait ? '提示内容(支持 {session} 表示当前对话；模块可点击或拖入下方内容框)' : '提醒内容(同一行模块并排 ≤6;拖模块到行边缘=并排、上/下=拆行、拖 ⠿ 整行排序;{below} / {amount} 触发时替换)';
        card.appendChild(secPv);
        bubbleEditorState.pvEl = document.createElement('div');
        bubbleEditorState.pvEl.className = 'dshwv-bubpvbox';
        card.appendChild(bubbleEditorState.pvEl);
        bubbleEditorState.pvPrevEl = document.createElement('div');
        bubbleEditorState.pvPrevEl.className = 'dshwv-bubprev';
        card.appendChild(bubbleEditorState.pvPrevEl);
        bubbleEditorState.pvEl.addEventListener('dragover', function (e) {
          try {
            if (e.target && e.target.closest && e.target.closest('.dshwv-pvrow')) return;
            e.preventDefault();
          } catch (err) {}
        });
        bubbleEditorState.pvEl.addEventListener('drop', function (e) {
          try {
            if (e.target && e.target.closest && e.target.closest('.dshwv-pvrow')) return;
            e.preventDefault();
            if (ctx.modDrag) {
              var mdd = ctx.modDrag;
              ctx.modDrag = null;
              bubblePvDropBlockEnd(mdd.ri, mdd.mi);
              return;
            }
            var key = ctx.dragKey;
            if (!key) return;
            ctx.dragKey = null;
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
        });
        var btns = document.createElement('div');
        btns.className = 'dshwv-bubbtns';
        var editorCompleted = false;
        function cleanup(outcome) {
          try {
            WhaleMoney.clearBindings(mask);
            document.body.removeChild(mask);
            bubbleEditorState.items = bkEditItems;
            bubbleEditorState.editorSnap = bkEditorSnap;
            bubbleEditorState.itemSnap = bkItemSnap;
            bubbleEditorState.itemIdx = bkEditIdx;
            bubbleEditorState.itemSide = bkSide;
            bubbleEditorState.palEl = bkPal;
            bubbleEditorState.pvEl = bkPv;
            bubbleEditorState.pvPrevEl = bkPrev;
            ctx.renderPv = bkRenderPv;
            ctx.qeditEnsure = bkQeditEnsure;
            if (ctx.moduleMask) ctx.moduleMask.style.zIndex = bkModMaskZ;
            var zsEl = document.getElementById('dshw-remind-overlay-z');
            if (zsEl) {
              try {
                document.head.removeChild(zsEl);
              } catch (err) {}
            }
            window.__dshwRemindMask = null;
          } catch (err) {}
          if (!editorCompleted) {
            editorCompleted = true;
            if (outcome !== 'saved' && onCancel) onCancel();
          }
        }
        var noBtn = document.createElement('button');
        noBtn.type = 'button';
        noBtn.className = 'dshwv-bubbtn dshwv-bubbtn-no';
        noBtn.textContent = '取消';
        noBtn.addEventListener('click', cleanup);
        btns.appendChild(noBtn);
        var resBtn = document.createElement('button');
        resBtn.type = 'button';
        resBtn.className = 'dshwv-bubbtn dshwv-bubbtn-no';
        resBtn.textContent = '恢复默认';
        resBtn.title = '恢复为默认提醒内容(触发条件保持不变)';
        resBtn.addEventListener('click', function () {
          step.modules = JSON.parse(JSON.stringify(isCost ? usageTurnCostDefaultLines(templateMode) : isWait ? usageWaitDefaultLines(key) : usageRemindDefaultLines(isAlert)));
          ctx.renderPv();
        });
        btns.appendChild(resBtn);
        var okBtn = document.createElement('button');
        okBtn.type = 'button';
        okBtn.className = 'dshwv-bubbtn dshwv-bubbtn-ok';
        okBtn.textContent = '保存';
        okBtn.addEventListener('click', function () {
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
          if (isCost) o.templateMode = templateMode;
          if (!isCost && !isWait) { if (isAlert) o.below = nativeDraft; else o.amount = nativeDraft; }
          cleanup('saved');
          if (onSave) onSave(o);
        });
        btns.appendChild(okBtn);
        card.appendChild(btns);
        try {
          if (ctx.moduleMask) openOver(mask, ctx.moduleMask);
        } catch (err) {}
        var qeditEnsureSuper = bkQeditEnsure;
        ctx.qeditEnsure = function () {
          var el = qeditEnsureSuper();
          try {
            if (el) openOver(ctx.moduleMask || mask, el);
          } catch (err) {}
          return el;
        };
        try {
          if (ctx.qeditEl) openOver(ctx.moduleMask || mask, ctx.qeditEl);
        } catch (err) {}
        var renderPvSuper = bkRenderPv;
        ctx.renderPv = function () {
          try {
            renderPvSuper();
          } catch (err) {}
          try {
            var it = bubbleEditTarget();
            var below = isAlert ? nativeDraft : null;
            var amount = isAlert || isCost || isWait ? null : nativeDraft;
            var previewNotice = WhaleTurnNotice.snapshot({ ok: true, amount: 0.08, costState: 'estimated', tokens: 12840, sessionLabel: '当前对话', byModel: { preview: { input_tokens: 10240, output_tokens: 2600, cached_input_tokens: 6000, reasoning_output_tokens: 800 } } }, state.currency);
            if (customConfig && customConfig.previewNotice) previewNotice = customConfig.previewNotice;
            if (it && Array.isArray(it.modules) && bubbleEditorState.pvPrevEl) bubblePreviewInto(bubbleEditorState.pvPrevEl, usageAlertModsResolved(it.modules, below, amount, isCost || customConfig ? previewNotice : null, templateMode));
          } catch (err) {}
        };
        function editNativeAmount() {
          try {
            var inputValue = Number(numInp.value);
            if (!isFinite(inputValue) || inputValue < 0 || numInp.value === '') throw new Error('请输入有效金额');
            nativeDraft = WhaleMoney.fromDisplay(inputValue, nativeCurrency);
            numInp.setCustomValidity(''); ctx.renderPv();
          } catch (err) { numInp.setCustomValidity(err.message); }
        }
        if (!isCost && !isWait) numInp.addEventListener('input', editNativeAmount);
        chk.addEventListener('change', ctx.renderPv);
        mask.appendChild(card);
        mask.addEventListener('click', function (e) {
          if (e.target === mask) cleanup();
        });
        window.__dshwRemindMask = mask;
        document.body.appendChild(mask);
        ctx.renderPal();
        ctx.renderPv();
      } catch (err) {}
  };
}
