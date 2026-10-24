// Snap region editor: draft controls, preview geometry, and pointer handling.
export function createSnapEditor(deps) {
  const { document, viewport, cloneSnap, clampSnapKey, fixSnapConfig,
    getSnapConfig, setSnapConfig, saveSnapConfig, closeRolePanel,
    closeAudioGroupPanel, setFlip, express, snapCheck } = deps;
    var SNAP_PREVIEW = 190;
    var snapPvW = SNAP_PREVIEW;
    var snapPvH = SNAP_PREVIEW;
    var snapEdit = null;
    var snapLineDrag = null;
    var snapMask = null;
    var snapCard = null;
    var snapRadio = {};
    var snapNum = {};
    var snapNumUnit = {};
    var snapPreview = null;
    function unitOf(mode) {
      return mode === 'px' ? 'px' : '%';
    }
    function ensureSnapPx(cfg) {
      try {
        if (!(cfg.px.F >= 0)) {
          cfg.px.L = 80;
          cfg.px.T = 0;
          cfg.px.R = 80;
          cfg.px.B = 80;
          cfg.px.F = Math.round(Math.max(1, viewport().w) / 2);
        }
      } catch (err) {}
    }
    function snapSetVal(key, val) {
      try {
        if (!snapEdit || snapEdit.mode === 'off') return;
        var m = snapEdit.mode;
        var vp = viewport();
        var set = m === 'px' ? snapEdit.px : snapEdit.ratio;
        var clamped = clampSnapKey(m, key, val, vp, snapEdit);
        set[key] = Math.max(0, Math.round(clamped));
      } catch (err) {}
    }
    function snapPvSize() {
      var vp = viewport();
      var maxW = 210, maxH = 190, minSide = 56;
      var ar = Math.max(0.05, vp.w / vp.h);
      var w, h;
      if (ar * maxH <= maxW) {
        h = maxH;
        w = maxH * ar;
      } else {
        w = maxW;
        h = maxW / ar;
      }
      w = Math.round(Math.max(minSide, Math.min(maxW, w)));
      h = Math.round(Math.max(minSide, Math.min(maxH, h)));
      return {
        w: w,
        h: h
      };
    }
    function snapFrac() {
      var vp = viewport();
      var f = {
        Lf: 0,
        Tf: 0,
        Rf: 1,
        Bf: 1,
        Ff: 0.5
      };
      try {
        var m = snapEdit.mode;
        var w = Math.max(1, vp.w), h = Math.max(1, vp.h);
        if (m === 'ratio') {
          f.Lf = Math.min(100, Math.max(0, snapEdit.ratio.L)) / 100;
          f.Tf = Math.min(100, Math.max(0, snapEdit.ratio.T)) / 100;
          f.Rf = 1 - Math.min(100, Math.max(0, snapEdit.ratio.R)) / 100;
          f.Bf = 1 - Math.min(100, Math.max(0, snapEdit.ratio.B)) / 100;
          f.Ff = Math.min(100, Math.max(0, snapEdit.ratio.F)) / 100;
        } else if (m === 'px') {
          f.Lf = Math.min(w, Math.max(0, snapEdit.px.L)) / w;
          f.Tf = Math.min(h, Math.max(0, snapEdit.px.T)) / h;
          f.Rf = 1 - Math.min(w, Math.max(0, snapEdit.px.R)) / w;
          f.Bf = 1 - Math.min(h, Math.max(0, snapEdit.px.B)) / h;
          f.Ff = Math.min(w, Math.max(0, snapEdit.px.F)) / w;
        }
      } catch (err) {}
      return f;
    }

    // ==== [快照预览] ====
    function renderSnapPreview() {
      try {
        if (!snapEdit || !snapPreview) return;
        snapPreview.innerHTML = '';
        var W = snapPvW;
        var H = snapPvH;
        if (snapEdit.mode === 'off') {
          var off = document.createElement('div');
          off.className = 'dshwv-snapoff';
          off.textContent = '已关闭：无吸附、无翻转，自由摆放';
          snapPreview.appendChild(off);
          return;
        }
        var f = snapFrac();
        var Lx = Math.max(0, Math.min(W, f.Lf * W));
        var Rx = Math.max(0, Math.min(W, f.Rf * W));
        var Ty = Math.max(0, Math.min(H, f.Tf * H));
        var By = Math.max(0, Math.min(H, f.Bf * H));
        var Fx = Math.max(0, Math.min(W, f.Ff * W));
        var flipBg = document.createElement('div');
        flipBg.className = 'dshwv-snapflip';
        flipBg.style.width = Fx + 'px';
        flipBg.style.height = H + 'px';
        snapPreview.appendChild(flipBg);
        var zoneDefs = [{
          l: 0,
          t: 0,
          w: Lx,
          h: H,
          bg: 'rgba(59,130,246,.20)'
        }, {
          l: Rx,
          t: 0,
          w: Math.max(0, W - Rx),
          h: H,
          bg: 'rgba(245,158,11,.18)'
        }, {
          l: 0,
          t: 0,
          w: W,
          h: Ty,
          bg: 'rgba(16,185,129,.16)'
        }, {
          l: 0,
          t: By,
          w: W,
          h: Math.max(0, H - By),
          bg: 'rgba(239,68,68,.14)'
        }];
        var i, zd;
        for (i = 0; i < zoneDefs.length; i++) {
          zd = zoneDefs[i];
          if (zd.w < 1 || zd.h < 1) continue;
          var z = document.createElement('div');
          z.className = 'dshwv-snapzone';
          z.style.left = zd.l + 'px';
          z.style.top = zd.t + 'px';
          z.style.width = zd.w + 'px';
          z.style.height = zd.h + 'px';
          z.style.background = zd.bg;
          snapPreview.appendChild(z);
        }
        var lineDefs = [{
          key: 'L',
          x: Lx,
          horizontal: false,
          flip: false
        }, {
          key: 'R',
          x: Rx,
          horizontal: false,
          flip: false
        }, {
          key: 'T',
          y: Ty,
          horizontal: true,
          flip: false
        }, {
          key: 'B',
          y: By,
          horizontal: true,
          flip: false
        }, {
          key: 'F',
          x: Fx,
          horizontal: false,
          flip: true
        }];
        for (i = 0; i < lineDefs.length; i++) {
          var ld = lineDefs[i];
          var p = ld.horizontal ? Math.max(0, Math.min(H, ld.y)) : Math.max(0, Math.min(W, ld.x));
          var ln = document.createElement('div');
          ln.className = 'dshwv-snapline' + (ld.flip ? ' dshwv-snapline-flip' : '');
          if (ld.horizontal) {
            ln.style.left = '0px';
            ln.style.top = p + 'px';
            ln.style.width = W + 'px';
            ln.style.height = '2px';
          } else {
            ln.style.left = p + 'px';
            ln.style.top = '0px';
            ln.style.width = '2px';
            ln.style.height = H + 'px';
          }
          snapPreview.appendChild(ln);
          var hd = document.createElement('div');
          hd.className = 'dshwv-snaphandle' + (ld.flip ? ' dshwv-snaphandle-flip' : '') + (ld.horizontal ? ' dshwv-snaphandle-h' : '');
          hd.style.left = (ld.horizontal ? W / 2 : p) + 'px';
          hd.style.top = (ld.horizontal ? p : H / 2) + 'px';
          hd.title = ld.key === 'F' ? '翻转线（左侧为翻转区）' : '吸附区边界线（可拖动）';
          hd.addEventListener('pointerdown', (function (key, horizontal) {
            return function (e) {
              startSnapLineDrag(e, key, horizontal);
            };
          })(ld.key, ld.horizontal));
          snapPreview.appendChild(hd);
        }
      } catch (err) {}
    }
    function syncSnapInputs() {
      try {
        if (!snapEdit) return;
        var m = snapEdit.mode;
        var set = m === 'px' ? snapEdit.px : snapEdit.ratio;
        var keys = ['L', 'T', 'R', 'B', 'F'];
        var unit = unitOf(m);
        var i;
        for (i = 0; i < keys.length; i++) {
          var k = keys[i];
          snapNum[k].value = String(Math.round(set[k]));
          snapNum[k].disabled = m === 'off';
          snapNumUnit[k].textContent = unit;
        }
      } catch (err) {}
    }
    function renderSnapModes() {
      try {
        if (snapEdit && snapRadio[snapEdit.mode]) snapRadio[snapEdit.mode].checked = true;
      } catch (err) {}
    }
    function startSnapLineDrag(e, key, horizontal) {
      try {
        e.preventDefault();
        try {
          e.stopPropagation();
        } catch (err) {}
        if (!snapEdit || snapEdit.mode === 'off') return;
        var vp = viewport();
        var axis = horizontal ? vp.h : vp.w;
        var domain = snapEdit.mode === 'px' ? axis : 100;
        var set = snapEdit.mode === 'px' ? snapEdit.px : snapEdit.ratio;
        snapLineDrag = {
          key: key,
          horizontal: horizontal,
          sx: e.clientX,
          sy: e.clientY,
          factor: domain / (horizontal ? Math.max(1, snapPvH) : Math.max(1, snapPvW)),
          orig: set[key]
        };
        document.addEventListener('pointermove', onSnapLineMove, true);
        document.addEventListener('pointerup', onSnapLineUp, true);
        document.addEventListener('pointercancel', onSnapLineUp, true);
      } catch (err) {}
    }
    function onSnapLineMove(e) {
      try {
        if (!snapLineDrag) return;
        var d = snapLineDrag;
        var delta = d.horizontal ? e.clientY - d.sy : e.clientX - d.sx;
        var val;
        if (d.key === 'R' || d.key === 'B') val = d.orig - delta * d.factor; else val = d.orig + delta * d.factor;
        snapSetVal(d.key, val);
        renderSnapPreview();
        syncSnapInputs();
      } catch (err) {}
    }
    function onSnapLineUp() {
      try {
        snapLineDrag = null;
        document.removeEventListener('pointermove', onSnapLineMove, true);
        document.removeEventListener('pointerup', onSnapLineUp, true);
        document.removeEventListener('pointercancel', onSnapLineUp, true);
      } catch (err) {}
    }
    function onSnapNumInput(key) {
      try {
        var v = Number(snapNum[key].value);
        if (!isFinite(v)) return;
        snapSetVal(key, v);
        renderSnapPreview();
        syncSnapInputs();
      } catch (err) {}
    }
    function resetSnapEdit() {
      try {
        if (!snapEdit) return;
        var m = snapEdit.mode;
        if (m === 'ratio') {
          snapEdit.ratio = {
            L: 10,
            T: 0,
            R: 10,
            B: 15,
            F: 50
          };
        } else if (m === 'px') {
          snapEdit.px = {
            L: 80,
            T: 0,
            R: 80,
            B: 80,
            F: Math.round(Math.max(1, viewport().w) / 2)
          };
        }
        renderSnapModes();
        renderSnapPreview();
        syncSnapInputs();
      } catch (err) {}
    }
    function openSnapModal() {
      try {
        closeRolePanel();
        closeAudioGroupPanel();
        var sz = snapPvSize();
        snapPvW = sz.w;
        snapPvH = sz.h;
        if (snapPreview) {
          snapPreview.style.width = snapPvW + 'px';
          snapPreview.style.height = snapPvH + 'px';
        }
        if (snapGrid) {
          snapGrid.style.gridTemplateColumns = '72px ' + snapPvW + 'px 72px';
          snapGrid.style.gridTemplateRows = '26px ' + snapPvH + 'px 26px';
        }
        snapEdit = cloneSnap(getSnapConfig());
        ensureSnapPx(snapEdit);
        renderSnapModes();
        renderSnapPreview();
        syncSnapInputs();
        snapMask.style.display = 'flex';
      } catch (err) {}
    }
    function closeSnapModal(apply) {
      try {
        if (apply && snapEdit) {
          setSnapConfig(cloneSnap(snapEdit));
          fixSnapConfig(getSnapConfig());
          saveSnapConfig();
          applySnapConfigNow();
        }
        snapEdit = null;
        snapMask.style.display = 'none';
      } catch (err) {}
    }
    function applySnapConfigNow() {
      try {
        if (getSnapConfig().mode === 'off') {
          setFlip(false);
          express();
          return;
        }
        snapCheck();
      } catch (err) {}
    }
    snapMask = document.createElement('div');
    snapMask.className = 'dshwv-snapmask';
    snapMask.style.display = 'none';
    snapCard = document.createElement('div');
    snapCard.className = 'dshwv-snapwin';
    var snapTitle = document.createElement('div');
    snapTitle.className = 'dshwv-snaptitle';
    snapTitle.textContent = '吸附与翻转设置';
    snapCard.appendChild(snapTitle);
    var snapModes = document.createElement('div');
    snapModes.className = 'dshwv-snapmodes';
    var snapModeDefs = [['ratio', '比例吸附'], ['px', '绝对吸附'], ['off', '关闭']];
    var mi;
    for (mi = 0; mi < snapModeDefs.length; mi++) {
      (function (k, label) {
        var lab = document.createElement('label');
        var inp = document.createElement('input');
        inp.type = 'radio';
        inp.name = 'dshwv-snapmode';
        inp.value = k;
        inp.addEventListener('change', function () {
          if (!snapEdit) return;
          snapEdit.mode = k;
          if (k === 'px') ensureSnapPx(snapEdit);
          renderSnapModes();
          renderSnapPreview();
          syncSnapInputs();
        });
        var tx = document.createElement('span');
        tx.textContent = label;
        lab.appendChild(inp);
        lab.appendChild(tx);
        snapModes.appendChild(lab);
        snapRadio[k] = inp;
      })(snapModeDefs[mi][0], snapModeDefs[mi][1]);
    }
    snapCard.appendChild(snapModes);
    var snapGrid = document.createElement('div');
    snapGrid.className = 'dshwv-snapgrid';
    function snapMakeNum(key, labelText) {
      var cell = document.createElement('span');
      cell.className = 'dshwv-snapcell';
      var inp = document.createElement('input');
      inp.type = 'number';
      inp.min = '0';
      inp.step = '1';
      inp.className = 'dshwv-snapnum';
      inp.title = labelText;
      inp.addEventListener('input', function () {
        onSnapNumInput(key);
      });
      inp.addEventListener('change', function () {
        onSnapNumInput(key);
      });
      var un = document.createElement('span');
      un.className = 'dshwv-snapunit';
      un.textContent = '%';
      cell.appendChild(inp);
      cell.appendChild(un);
      snapNum[key] = inp;
      snapNumUnit[key] = un;
      return cell;
    }
    snapPreview = document.createElement('div');
    snapPreview.className = 'dshwv-snappreview';
    var snapGridT = document.createElement('div');
    snapGridT.className = 'dshwv-snapcell';
    snapGridT.style.gridColumn = '2';
    snapGridT.style.gridRow = '1';
    snapGridT.appendChild(snapMakeNum('T', '上侧吸附区：距屏幕顶部的宽度'));
    var snapGridL = document.createElement('div');
    snapGridL.className = 'dshwv-snapcell';
    snapGridL.style.gridColumn = '1';
    snapGridL.style.gridRow = '2';
    snapGridL.appendChild(snapMakeNum('L', '左侧吸附区：距屏幕左边的宽度'));
    var snapGridC = document.createElement('div');
    snapGridC.style.gridColumn = '2';
    snapGridC.style.gridRow = '2';
    snapGridC.style.lineHeight = '0';
    snapGridC.appendChild(snapPreview);
    var snapGridR = document.createElement('div');
    snapGridR.className = 'dshwv-snapcell';
    snapGridR.style.gridColumn = '3';
    snapGridR.style.gridRow = '2';
    snapGridR.appendChild(snapMakeNum('R', '右侧吸附区：距屏幕右边的宽度'));
    var snapGridB = document.createElement('div');
    snapGridB.className = 'dshwv-snapcell';
    snapGridB.style.gridColumn = '2';
    snapGridB.style.gridRow = '3';
    snapGridB.appendChild(snapMakeNum('B', '下侧吸附区：距屏幕底部的宽度'));
    snapGrid.appendChild(snapGridT);
    snapGrid.appendChild(snapGridL);
    snapGrid.appendChild(snapGridC);
    snapGrid.appendChild(snapGridR);
    snapGrid.appendChild(snapGridB);
    snapCard.appendChild(snapGrid);
    var snapFlipRow = document.createElement('div');
    snapFlipRow.className = 'dshwv-snapfliprow';
    var snapFlipLabel = document.createElement('span');
    snapFlipLabel.textContent = '翻转线';
    snapFlipRow.appendChild(snapFlipLabel);
    snapFlipRow.appendChild(snapMakeNum('F', '翻转线：距屏幕左边的位置，线左侧的鲸鱼会左右翻转'));
    snapCard.appendChild(snapFlipRow);
    var snapBtns = document.createElement('div');
    snapBtns.className = 'dshwv-snapbtns';
    function snapBtn(label, cls, fn) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'dshwv-snapbtn ' + cls;
      b.textContent = label;
      b.addEventListener('click', function (e) {
        e.stopPropagation();
        fn();
      });
      return b;
    }
    snapBtns.appendChild(snapBtn('取消', 'dshwv-snapbtn-no', function () {
      closeSnapModal(false);
    }));
    snapBtns.appendChild(snapBtn('重置', 'dshwv-snapbtn-no', resetSnapEdit));
    snapBtns.appendChild(snapBtn('确认', 'dshwv-snapbtn-ok', function () {
      closeSnapModal(true);
    }));
    snapCard.appendChild(snapBtns);
    snapMask.appendChild(snapCard);
    document.body.appendChild(snapMask);
  return { open: openSnapModal, close: closeSnapModal };
}
