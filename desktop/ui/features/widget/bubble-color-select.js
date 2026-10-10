// The color picker owns its menu state and one document-level dismiss handler.
export function createBubbleColorSelect(deps) {
  const { document, qRow, qLabel, dshwDropOpen } = deps;
  const QC_SCHEMES = [['macaron', '马卡龙'], ['candy', '糖果'], ['rouge', '酒红'], ['bamboo', '翠青'], ['aurora', '极光幻彩'], ['deepsea', '深海蓝调'], ['sunset', '落日熔金'], ['forest', '森林秘语'], ['champagne', '香槟鎏金'], ['lavender', '薰衣草梦境'], ['mint', '薄荷汽水'], ['lava', '岩浆熔岩'], ['galaxy', '银河星紫'], ['ink', '墨韵黑白'], ['indigo', '靛蓝夜曲']];
  let openMenu = null;
  let bound = false;
    function qColorSelectBuild(current, onPick, opts) {
      opts = opts || ({});
      var allowNone = !!opts.allowNone;
      var oLabel = opts.label || '颜色';
      var oHex = opts.defaultHex || '#203170';
      var oText = opts.defaultText || '默认色';
      var row = qRow();
      row.appendChild(qLabel(oLabel));
      var wrap = document.createElement('div');
      wrap.className = 'dshwv-rgbwrap dshwv-qcolwrap';
      var head = document.createElement('button');
      head.type = 'button';
      head.className = 'dshwv-rgbhead';
      head.title = '颜色:纯色或跑马灯';
      wrap.appendChild(head);
      var menu = document.createElement('div');
      menu.className = 'dshwv-rgbmenu dshwv-qcolmenu';
      wrap.appendChild(menu);
      var sw = document.createElement('span');
      sw.className = 'dshwv-qcolorhost';
      function modeOf(v) {
        if (v === 'none') return allowNone ? 'none' : 'solid';
        if (v === 'solid' || isScheme(v)) return v;
        return allowNone ? 'none' : 'solid';
      }
      var curMode = modeOf(current);
      function isScheme(v) {
        for (var i = 0; i < QC_SCHEMES.length; i++) if (QC_SCHEMES[i][0] === v) return true;
        return false;
      }
      function labelOf(v) {
        if (v === 'none') return '无';
        if (v === 'solid') return '纯色';
        for (var i = 0; i < QC_SCHEMES.length; i++) if (QC_SCHEMES[i][0] === v) return QC_SCHEMES[i][1];
        return allowNone ? '无' : '纯色';
      }
      function renderSolid(hex, onSet) {
        sw.innerHTML = '';
        var ci = document.createElement('input');
        ci.type = 'color';
        ci.value = hex;
        ci.title = '选择纯色';
        ci.addEventListener('input', function () {
          if (onSet) onSet(ci.value);
        });
        ci.addEventListener('change', function () {
          if (onSet) onSet(ci.value);
        });
        sw.appendChild(ci);
        var def = document.createElement('button');
        def.type = 'button';
        def.className = 'dshwv-bubmini';
        def.textContent = oText;
        def.title = '恢复为' + oText + '色值';
        def.style.width = 'auto';
        def.style.padding = '0 6px';
        def.addEventListener('click', function () {
          if (onSet) onSet(oHex);
        });
        sw.appendChild(def);
      }
      function fill() {
        menu.innerHTML = '';
        function add(v, lab) {
          var o = document.createElement('div');
          o.className = 'dshwv-rgbopt' + (v === curMode ? ' dshwv-rgbcur' : '');
          if (v !== 'solid' && v !== 'none') {
            o.classList.add('optgrad');
            o.classList.add('opt-' + v);
          }
          o.textContent = (v === curMode ? '✓ ' : '') + lab;
          o.addEventListener('click', function () {
            curMode = v;
            closeMenu();
            if (onPick) onPick(v);
          });
          menu.appendChild(o);
        }
        if (allowNone) add('none', '无');
        add('solid', '纯色');
        for (var i = 0; i < QC_SCHEMES.length; i++) add(QC_SCHEMES[i][0], QC_SCHEMES[i][1]);
      }
      var hexSetter = null;
      function sync(mode, hex, onSet) {
        curMode = modeOf(mode);
        hexSetter = onSet || null;
        head.textContent = labelOf(curMode);
        if (curMode === 'solid') renderSolid(hex || oHex, function (h) {
          if (hexSetter) hexSetter(h);
        }); else sw.innerHTML = '';
        fill();
      }
      function closeMenu() {
        menu.classList.remove('dshwv-rgbopen');
        openMenu = null;
      }
      head.addEventListener('click', function (e) {
        e.stopPropagation();
        if (openMenu === menu) {
          closeMenu();
          return;
        }
        if (openMenu) openMenu.classList.remove('dshwv-rgbopen');
        fill();
        openMenu = menu;
        dshwDropOpen(menu, head);
      });
      if (!bound) {
        bound = true;
        document.addEventListener('pointerdown', function (e) {
          if (!openMenu) return;
          try {
            if (e.target && e.target.closest && (e.target.closest('.dshwv-qcolwrap') || e.target.closest('.dshwv-rgbmenu'))) return;
          } catch (err) {}
          openMenu.classList.remove('dshwv-rgbopen');
          openMenu = null;
        }, true);
      }
      row.appendChild(wrap);
      row.appendChild(sw);
      fill();
      return {
        row: row,
        sync: sync
      };
    }
  return { build: qColorSelectBuild };
}
