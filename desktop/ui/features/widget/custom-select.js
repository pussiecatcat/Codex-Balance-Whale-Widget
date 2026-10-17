// Owns the custom select popup, its suppression window, and document
// listeners. Callers provide only the menu positioning and name rendering UI.
export function createCustomSelectController({ document, window, dropOpen, makeNameCell, bindNameMarquee, now = Date.now }) {
  var dshwCustSelOpen = null;
  var dshwCustSuppressAt = 0;
  const nameDisposers = [];
  function dshwCustSelClose() {
    var o = dshwCustSelOpen;
    dshwCustSelOpen = null;
    if (!o) return;
    try {
      o.menu.classList.remove('dshwv-rgbopen');
      if (o.btn) o.btn.setAttribute('aria-expanded', 'false');
      if (o.menu.parentNode === document.body) document.body.removeChild(o.menu);
    } catch (err) {}
  }
  if (!window.__dshwCustBound) {
    window.__dshwCustBound = true;
    document.addEventListener('pointerdown', function (e) {
      var o = dshwCustSelOpen;
      if (!o) return;
      try {
        var onBtn = !!(e.target && e.target.closest && e.target.closest('.dshwv-custbtn'));
        if (onBtn) {
          dshwCustCloseNow();
          return;
        }
        if (e.target && o.menu.contains(e.target)) return;
      } catch (err) {}
      dshwCustSelClose();
    }, true);
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') dshwCustCloseNow();
    }, true);
    window.addEventListener('resize', function () {
      dshwCustCloseNow();
    });
  }
  function dshwCustCloseNow() {
    dshwCustSelClose();
    dshwCustSuppressAt = now();
  }
  function dshwCustSel(sel, opts) {
    if (!sel || !sel.parentNode) return {
      sync: function () {},
      refresh: function () {}
    };
    if (sel.__dshwCustDrop) return sel.__dshwCustDrop;
    if (sel.__dshwCust) return {
      sync: function () {},
      refresh: function () {}
    };
    sel.__dshwCust = true;
    var parent = sel.parentNode;
    var wrap = document.createElement('div');
    wrap.className = 'dshwv-custwrap';
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'dshwv-custbtn';
    btn.title = sel.title || '';
    btn.setAttribute('aria-haspopup', 'listbox');
    btn.setAttribute('aria-expanded', 'false');
    var lab = document.createElement('span');
    lab.className = 'dshwv-custlab';
    btn.appendChild(lab);
    parent.insertBefore(wrap, sel);
    wrap.appendChild(btn);
    wrap.appendChild(sel);
    sel.style.display = 'none';
    var menu = document.createElement('div');
    menu.className = 'dshwv-rgbmenu dshwv-custmenu';
    menu.setAttribute('role', 'listbox');
    function labelOf(v) {
      for (var i = 0; i < sel.options.length; i++) {
        if (String(sel.options[i].value) === String(v)) return String(sel.options[i].textContent || sel.options[i].text || '');
      }
      return '';
    }
    function sync() {
      try {
        lab.textContent = labelOf(sel.value) || '—';
        btn.disabled = !!sel.disabled;
      } catch (err) {}
    }
    function fill() {
      for (const dispose of nameDisposers.splice(0)) { try { dispose(); } catch (error) {} }
      menu.innerHTML = '';
      var cur = sel.value;
      for (var i = 0; i < sel.options.length; i++) {
        (function (opt) {
          var d = document.createElement('div');
          var lab = String(opt.textContent || opt.text || opt.value);
          d.setAttribute('role', 'option');
          d.setAttribute('aria-selected', String(opt.value) === String(cur) ? 'true' : 'false');
          if (opts && opts.scrollNames) {
            d.className = 'dshwv-rgbopt dshwv-custrow' + (String(opt.value) === String(cur) ? ' dshwv-rgbcur' : '');
            var nm = makeNameCell('dshwv-custnm', lab);
            d.appendChild(nm);
            const releaseName = bindNameMarquee(d, nm);
            if (typeof releaseName === 'function') nameDisposers.push(releaseName);
          } else {
            d.className = 'dshwv-rgbopt' + (String(opt.value) === String(cur) ? ' dshwv-rgbcur' : '');
            var txt = document.createElement('span');
            txt.className = 'dshwv-custtext';
            txt.textContent = lab;
            d.appendChild(txt);
          }
          if (opt.disabled) d.classList.add('dshwv-custdisabled');
          var mark = document.createElement('span');
          mark.className = 'dshwv-custcheck';
          mark.textContent = '✓';
          mark.setAttribute('aria-hidden', 'true');
          d.appendChild(mark);
          d.addEventListener('click', function (e) {
            e.stopPropagation();
            if (opt.disabled) return;
            try {
              sel.value = opt.value;
            } catch (err) {}
            sync();
            dshwCustSelClose();
            try {
              sel.dispatchEvent(new Event('change'));
            } catch (err) {}
          });
          menu.appendChild(d);
        })(sel.options[i]);
      }
    }
    sel.addEventListener('change', sync);
    btn.addEventListener('keydown', function (e) {
      if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
      e.preventDefault();
      var count = sel.options.length;
      if (!count) return;
      var direction = e.key === 'ArrowDown' ? 1 : -1;
      var index = Math.max(0, sel.selectedIndex);
      for (var step = 0; step < count; step++) {
        index = (index + direction + count) % count;
        if (sel.options[index].disabled) continue;
        sel.selectedIndex = index;
        sync();
        try {
          sel.dispatchEvent(new Event('change'));
        } catch (err) {}
        break;
      }
    });
    btn.addEventListener('click', function (e) {
      e.stopPropagation();
      if (btn.disabled) return;
      if (dshwCustSuppressAt && now() - dshwCustSuppressAt < 350) {
        dshwCustSuppressAt = 0;
        return;
      }
      if (dshwCustSelOpen && dshwCustSelOpen.btn === btn) {
        dshwCustSelClose();
        return;
      }
      dshwCustSelClose();
      fill();
      sync();
      if (menu.parentNode !== document.body) document.body.appendChild(menu);
      dropOpen(menu, btn);
      btn.setAttribute('aria-expanded', 'true');
      if (opts && typeof opts.bottom === 'function') {
        try {
          var bEl = opts.bottom();
          if (bEl && bEl.getBoundingClientRect) {
            var bTop = bEl.getBoundingClientRect().top;
            var mTop = menu.getBoundingClientRect().top;
            var avail = Math.floor(bTop - mTop - 6);
            if (avail >= 40) menu.style.maxHeight = Math.min(avail, 220) + 'px';
          }
        } catch (err) {}
      }
      dshwCustSelOpen = {
        menu: menu,
        btn: btn
      };
    });
    sync();
    var api = {
      sync: sync,
      refresh: function () {
        fill();
        sync();
      },
      close: dshwCustSelClose,
      button: btn,
      menu: menu
    };
    sel.__dshwCustDrop = api;
    return api;
  }
  return {
    enhance: dshwCustSel,
    close: dshwCustSelClose,
    sync: sel => sel?.__dshwCustDrop?.sync(),
    refresh: sel => sel?.__dshwCustDrop?.refresh(),
  };
}
