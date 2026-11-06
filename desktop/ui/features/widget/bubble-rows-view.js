// Materialize frozen bubble rows into the live scene or the editor preview.
import { isFineScale } from '../../shared/bubble-config/font-scale.js';

// 大数字的门槛按实际字号算（旧档位 12 ≈ 85 单位），新旧两套档位用同一条线。
const HERO_UNITS = 85;

// 小字在挂件缩小时仍要可读。细档位本来就是为了能调得更小，所以底线低一档。
export function bubbleFontFloor(level, module) {
  if (isFineScale(module)) return Number(level) >= 16 ? 11 : 8;
  return Number(level) >= 12 ? 12 : 10;
}

export function createBubbleRowsView(deps) {
  const { document, window, WhaleMoney, bubbleSnapshot, bubbleModuleFontU,
    bubbleRowsOf, bubbleIsImgMod, whaleMoneyTemplates, getBubbleTarget, getSceneController,
    getVisuals, getRoot, getBubbleBox } = deps;
    function bubbleMarqueeDur() {
      return Math.round(1500 + Math.random() * 3000) + 'ms';
    }
    // Rows must wrap against the current shape's content box, not a fixed
    // design-unit constant, or the wider rounded bubble would clip its rows.
    function bubbleRowCapU() {
      try {
        var raw = window.getComputedStyle ? window.getComputedStyle(document.documentElement).getPropertyValue('--dshw-box-wu') : '';
        var n = parseFloat(raw);
        return n > 0 ? n : 560;
      } catch (err) { return 560; }
    }
    function bubbleRowsTo(parentEl, mods, frozenRows) {
      if (!parentEl || !Array.isArray(mods)) return;
      if (!frozenRows) { var preview = bubbleSnapshot(mods, false); mods = preview.modules; frozenRows = preview.rows; }
      var old = parentEl.querySelectorAll('.dshwv-trow, .dshwv-mimg');
      for (var i = 0; i < old.length; i++) {
        try {
          WhaleMoney.clearBindings(old[i]);
          window.WhaleQuota?.clearBindings(old[i]);
          window.WhaleApiModels?.clearBindings(old[i]);
          parentEl.removeChild(old[i]);
        } catch (err) {}
      }
      var ROW_MAX = 6;
      var MOD_MAX = 6;
      function blockOf(m, rowContent) {
        var line = rowContent ? rowContent.line : null;
        var fSize = m.size;
        var fColor = m.color;
        var fBold = m.bold;
        var fItalic = m.italic;
        var fUl = m.ul;
        var fRgb = m.rgb;
        if (line) {
          if (line.size) fSize = line.size;
          if (line.color) fColor = line.color;
          if (line.bold === false) fBold = false; else if (line.bold === true) fBold = true;
          if (line.italic === false) fItalic = false; else if (line.italic === true) fItalic = true;
          if (line.ul === false) fUl = false; else if (line.ul === true) fUl = true;
          if (line.rgb) fRgb = line.rgb;
        }
        if (m.type === 'random' && fBold !== false) fBold = true;
        var effBg = '';
        var effBgRgb = '';
        {
          if (line && line.bgRgb) effBgRgb = String(line.bgRgb); else if (line && line.bg) effBg = String(line.bg);
          if (!effBgRgb && !effBg) {
            if (m.bgRgb) effBgRgb = String(m.bgRgb); else if (m.bg) effBg = String(m.bg);
          }
        }
        if (effBgRgb === 'true') effBgRgb = 'macaron';
        var needBg = !!(effBgRgb || effBg);
        var row = document.createElement('div');
        row.className = 'dshwv-trow';
        if (m.type === 'quota' && m.quotaStyle === 'meter' && !m.apiModelId) row.classList.add('dshwv-quota-shell');
        if (m.type === 'plan' && m.quotaStyle === 'header') row.classList.add('dshwv-quota-heading');
        // 大数字和来源行由样式表定主次；用户在编辑器里设的颜色走行内样式，仍然优先。
        if (m.type === 'quota' && !m.quotaStyle && !m.apiModelId && bubbleModuleFontU(fSize, m) >= HERO_UNITS && fBold !== false) row.classList.add('dshwv-trow-hero');
        if (m.type === 'source') row.classList.add('dshwv-trow-source');
        var tx = row;
        if (needBg) {
          row.classList.add('dshwv-mod-chip');
          tx = document.createElement('span');
          tx.className = 'dshwv-trowtx';
          row.appendChild(tx);
        }
        if (['title', 'badge', 'hero', 'countdown', 'chip'].includes(m.role)) row.classList.add('dshwv-mod-' + m.role);
        tx.textContent = String(rowContent.txt);
        if (rowContent.moneyText) WhaleMoney.bind(tx, rowContent.moneyText);
        if (rowContent.quotaText) window.WhaleQuota?.bind(tx, m);
        if (rowContent.apiModelText) window.WhaleApiModels?.bind(tx, m);
        // Small modules must stay readable when the widget is scaled down.
        var minimum = bubbleFontFloor(fSize, m);
        row.style.fontSize = 'max(' + minimum + 'px, calc(var(--dshw-u) * ' + bubbleModuleFontU(fSize, m) + '))';
        // A countdown changes width with its value, and the widest row decides the
        // fit scale, so without a fixed slot two quota steps render at different sizes.

        if (whaleMoneyTemplates.has(m)) row.classList.add('dshwv-mod-money');
        if (fBold) row.classList.add(m.type === 'balance' ? 'dshwv-mod-balance-bold' : 'dshwv-mod-bold'); else if (m.type === 'balance') row.classList.add('dshwv-mod-balance');
        if (fItalic) row.classList.add('dshwv-mod-italic');
        if (fUl) row.classList.add('dshwv-mod-underline');
        var fFont = m.fontFamily || '';
        if (line && line.fontFamily) fFont = line.fontFamily;
        if (fFont) row.style.fontFamily = fFont;
        var marquee = fRgb;
        function applyTextGradient(target, g) {
          target.classList.add('dshwv-rgb');
          var scheme = g === true ? 'macaron' : String(g || 'macaron');
          if (scheme === 'candy' || scheme === 'rouge' || scheme === 'bamboo' || scheme === 'aurora' || scheme === 'deepsea' || scheme === 'sunset' || scheme === 'forest' || scheme === 'champagne' || scheme === 'lavender' || scheme === 'mint' || scheme === 'lava' || scheme === 'galaxy' || scheme === 'ink' || scheme === 'indigo') target.classList.add('dshwv-rgb-' + scheme);
        }
        if (marquee) {
          var mt = needBg ? tx : row;
          applyTextGradient(mt, marquee);
          mt.style.animationDuration = bubbleMarqueeDur();
        } else if (fColor) {
          row.style.color = fColor;
        }
        if (needBg) {
          if (effBgRgb) {
            row.classList.add('dshwv-bgrgb');
            if (effBgRgb === 'candy' || effBgRgb === 'rouge' || effBgRgb === 'bamboo' || effBgRgb === 'aurora' || effBgRgb === 'deepsea' || effBgRgb === 'sunset' || effBgRgb === 'forest' || effBgRgb === 'champagne' || effBgRgb === 'lavender' || effBgRgb === 'mint' || effBgRgb === 'lava' || effBgRgb === 'galaxy' || effBgRgb === 'ink' || effBgRgb === 'indigo' || effBgRgb === 'macaron') row.classList.add('dshwv-bgrgb-' + effBgRgb);
            row.style.animationDuration = bubbleMarqueeDur();
          } else if (effBg) {
            row.style.background = effBg;
          }
        }
        return {
          el: row,
          tx: tx,
          fSize: fSize,
          mod: m,
          bg: needBg
        };
      }
      function maybeWrap(blk) {
        if (!blk) return;
        try {
          var compFs = window.getComputedStyle ? parseFloat(window.getComputedStyle(blk.el).fontSize) : 0;
          var multNow = bubbleModuleFontU(blk.fSize, blk.mod);
          var capPx = compFs && multNow ? bubbleRowCapU() * compFs / multNow : 0;
          if (capPx > 0 && blk.el.scrollWidth > capPx + 2) {
            blk.el.style.maxWidth = capPx + 'px';
            blk.el.classList.add('dshwv-mod-wrap');
          } else {
            blk.el.classList.remove('dshwv-mod-wrap');
          }
        } catch (err) {}
      }
      function enableLinkRun(blk2) {
        try {
          var lmd = blk2 && blk2.mod;
          if (!lmd || lmd.type !== 'link') return;
          if (!parentEl || parentEl !== getBubbleTarget()) return;
          var u0 = String(lmd.url || '').trim();
          if (!(/^https?:\/\//i).test(u0)) return;
          var lel = blk2.el;
          lel.classList.add('dshwv-mod-link');
          lel.title = u0;
          lel.addEventListener('click', function (e) {
            try {
              e.preventDefault();
            } catch (err) {}
            try {
              e.stopPropagation();
            } catch (err) {}
            try {
              if (window.whaleDesktop && window.whaleDesktop.openExternal) window.whaleDesktop.openExternal(u0);
              else window.open(u0, '_blank', 'noopener');
            } catch (err) {}
          });
        } catch (err) {}
      }
      var groups = bubbleRowsOf(mods);
      var rows = 0;
      var imgDone = false;
      for (var g = 0; g < groups.length; g++) {
        var grp = groups[g];
        if (!grp || !grp.length) continue;
        if (bubbleIsImgMod(grp[0])) {
          var md = grp[0];
          if (imgDone || !md.imgId) continue;
          var im = document.createElement('img');
          im.className = 'dshwv-mimg';
          var scV2 = Number(md.imgScale);
          if (isFinite(scV2) && scV2 > 0) im.style.maxWidth = 'calc(var(--dshw-u) * ' + 540 * Math.max(0.1, Math.min(1, scV2)) + ')';
          im.src = '/dsh-whale/bubble-img.png?id=' + encodeURIComponent(md.imgId);
          im.alt = '';
          im.draggable = false;
          parentEl.appendChild(im);
          imgDone = true;
          continue;
        }
        for (var s = 0; s < grp.length && rows < ROW_MAX; s += MOD_MAX) {
          var chunk = [];
          for (var c = s; c < grp.length && c < s + MOD_MAX; c++) {
            var cm = grp[c] || ({});
            var rowContent = frozenRows.get(cm);
            if (!rowContent || rowContent.txt === '' || rowContent.txt === undefined || rowContent.txt === null) continue;
            chunk.push(blockOf(cm, rowContent));
          }
          if (!chunk.length) continue;
          if (chunk.length === 1) {
            var blk1 = chunk[0];
            parentEl.appendChild(blk1.el);
            enableLinkRun(blk1);
            maybeWrap(blk1);
            rows++;
            continue;
          }
          var capPx2 = 0;
          try {
            var uCss2 = window.getComputedStyle ? window.getComputedStyle(parentEl).getPropertyValue('--dshw-u') : '';
            var uVal2 = parseFloat(uCss2);
            if (uVal2 > 0) capPx2 = bubbleRowCapU() * uVal2;
          } catch (err) {}
          var para = document.createElement('div');
          para.className = 'dshwv-trow dshwv-trowline';

          if (capPx2 > 0) para.style.maxWidth = capPx2 + 'px';
          for (var p = 0; p < chunk.length; p++) {
            var pr = chunk[p];
            var pe = pr.el;
            if (!pr.bg) pe.classList.add('dshwv-mod-plain');
            if (pe.classList.contains('dshwv-mod-badge') || pe.classList.contains('dshwv-mod-countdown')) {
              para.classList.add('dshwv-trowline-fixed');
            }
            para.appendChild(pe);
            enableLinkRun(pr);
          }
          parentEl.appendChild(para);
          rows++;
        }
      }
    }

    function bubbleRenderModules(mods) {
      if (!getSceneController().building) return; // Including switching: only the entry builder may write.
      var snapshot = bubbleSnapshot(mods, true);
      var visuals = getVisuals();
      visuals.gifEl.style.display = 'none';
      visuals.labelEl.style.display = 'none';
      visuals.amountEl.style.display = 'none';
      visuals.hintEl.style.display = 'none';
      bubbleRowsTo(getBubbleTarget(), snapshot.modules, snapshot.rows);
    }
    function bubblePreviewInto(container, mods, widthPx) {
      try {
        if (!container) return;
        var root = getRoot();
        WhaleMoney.clearBindings(container);
        container.innerHTML = '';
        var B = Math.max(120, root && (root.offsetWidth || root.getBoundingClientRect().width) || 300);
        var hostW = Math.max(120, container.parentNode && (container.parentNode.clientWidth || container.parentNode.getBoundingClientRect().width) || 408);
        var W = Math.max(120, Math.min(B, hostW));
        container.style.width = W + 'px';
        container.style.transform = 'none';
        container.style.transformOrigin = '';
        container.style.setProperty('--dshw-u', W / 1026 + 'px');
        var halfGap = Math.max(0, (hostW - W) / 2);
        var shiftR = Math.min(10, Math.max(0, Math.round(halfGap)));
        container.style.marginLeft = Math.max(0, Math.round(halfGap)) + shiftR + 'px';
        container.style.marginRight = Math.max(0, Math.round(halfGap) - shiftR) + 'px';
        var pop = document.createElement('div');
        pop.className = 'dshwv-minipop';
        pop.style.aspectRatio = 'auto';
        var cropTop = Math.max(2, Math.round(W * 0.012));
        pop.style.height = Math.round(W * 560 / 1026) + cropTop + 'px';
        pop.style.overflow = 'hidden';
        var stage = document.createElement('div');
        stage.style.position = 'absolute';
        stage.style.left = '0';
        stage.style.top = cropTop + 'px';
        stage.style.width = '100%';
        stage.style.height = Math.round(W * 700 / 1026) + 'px';
        try {
          var svgEl = getBubbleBox().querySelector('svg');
          if (svgEl) stage.innerHTML = svgEl.outerHTML;
        } catch (err) {}
        try {
          var tailEls = stage.querySelectorAll('.dshwv-b1, .dshwv-b2');
          for (var t1 = 0; t1 < tailEls.length; t1++) {
            try {
              tailEls[t1].style.display = 'none';
            } catch (err) {}
          }
        } catch (err) {}
        var tb = document.createElement('div');
        tb.className = 'dshwv-text';
        tb.style.opacity = '1';
        tb.style.transition = 'none';
        stage.appendChild(tb);
        pop.appendChild(stage);
        container.appendChild(pop);
        bubbleRowsTo(tb, mods || []);
      } catch (err) {}
    }
  return { render: bubbleRenderModules, preview: bubblePreviewInto, rowsTo: bubbleRowsTo };
}
