// Placeholder reference popover for module templates.
export function createBubbleTemplateHelp({ document, viewport, bubbleTplHelpItems }) {
    var dshwvTplHelpEl = null;
    function bubbleTplHelpToggle(m, anchor) {
      try {
        if (!dshwvTplHelpEl) {
          dshwvTplHelpEl = document.createElement('div');
          dshwvTplHelpEl.className = 'dshwv-tplhelp';
          document.body.appendChild(dshwvTplHelpEl);
          document.addEventListener('pointerdown', function (e) {
            if (!dshwvTplHelpEl || dshwvTplHelpEl.style.display === 'none') return;
            try {
              if (e.target && e.target.closest && (e.target.closest('.dshwv-tplq') || e.target.closest('.dshwv-tplhelp'))) return;
            } catch (err) {}
            dshwvTplHelpEl.style.display = 'none';
          }, true);
          document.addEventListener('keydown', function (e) {
            if (e.key === 'Escape') dshwvTplHelpEl.style.display = 'none';
          });
        }
        if (dshwvTplHelpEl.style.display === 'block') {
          dshwvTplHelpEl.style.display = 'none';
          return;
        }
        var items = bubbleTplHelpItems(m);
        var html = '<div style="font-weight:600;margin-bottom:4px">可用占位符(替换到内容里)</div>';
        if (!items.length) html += '<div style="opacity:.8">该模块无自动内容占位</div>';
        for (var i = 0; i < items.length; i++) html += '<div style="margin:1px 0"><b style="color:#2f4488">' + items[i].k + '</b> — ' + items[i].d + '</div>';
        html += '<div style="margin-top:5px;opacity:.65">其余文字原样显示;留空=默认自动内容</div>';
        dshwvTplHelpEl.innerHTML = html;
        dshwvTplHelpEl.style.display = 'block';
        var r = anchor ? anchor.getBoundingClientRect() : {
          left: 60,
          top: 120,
          right: 180,
          width: 100
        };
        var w = 252;
        var vp = viewport();
        var left = Math.max(4, Math.min(r.right - w, vp.w - w - 4));
        var top = r.bottom + 4;
        var h = dshwvTplHelpEl.offsetHeight || 120;
        if (top + h > vp.h - 4) top = Math.max(4, r.top - h - 4);
        dshwvTplHelpEl.style.left = Math.round(left) + 'px';
        dshwvTplHelpEl.style.top = Math.round(top) + 'px';
      } catch (err) {}
    }
  return { toggle: bubbleTplHelpToggle };
}
