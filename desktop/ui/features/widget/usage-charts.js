// Data aggregation is pure. Canvas and ratio views receive their host UI
// dependencies explicitly so the legacy widget no longer owns chart drawing.
export function aggregateUsageModels(daysArr) {
  var map = {};
  (daysArr || []).forEach(function (day) {
    ;
    (day.models || []).forEach(function (mm) {
      var k = mm && mm.model ? mm.model : '未知';
      map[k] = (map[k] || 0) + (Number(mm.cost) || 0);
    });
  });
  return Object.keys(map).map(function (k) {
    return {
      model: k,
      cost: map[k]
    };
  }).sort(function (a, b) {
    return b.cost - a.cost;
  });
}
export function createUsageCharts({ document, window, sectionTitle, bindMoney, formatMoney, getCurrency, money }) {
  var USAGE_PALETTE = ['#203170', '#e0433f', '#2fa24c', '#b060c8', '#e89a2e', '#3aa6c8', '#d06a8a', '#7a8b2f', '#6a6ad0', '#c84a8a'];
  function usageRatioRows(body, secTitle, agg, totalLabel) {
    body.appendChild(sectionTitle(secTitle, totalLabel));
    if (!agg.length) {
      var no = document.createElement('div');
      no.className = 'dshwv-usage-hint';
      no.textContent = '暂无模型明细';
      body.appendChild(no);
      return;
    }
    var sum = agg.reduce(function (a, x) {
      return a + x.cost;
    }, 0) || 1;
    var costEls = [];
    agg.forEach(function (row, i) {
      var wr = document.createElement('div');
      wr.className = 'dshwv-usage-ratio';
      var lab = document.createElement('span');
      lab.className = 'dshwv-usage-ratio-label';
      lab.textContent = row.model;
      lab.title = row.model;
      wr.appendChild(lab);
      var track = document.createElement('div');
      track.className = 'dshwv-usage-ratio-track';
      var fill = document.createElement('div');
      fill.className = 'dshwv-usage-ratio-fill';
      fill.style.width = Math.round(row.cost / sum * 100) + '%';
      fill.style.background = USAGE_PALETTE[i % USAGE_PALETTE.length];
      track.appendChild(fill);
      wr.appendChild(track);
      var pct = document.createElement('span');
      pct.className = 'dshwv-usage-ratio-pct';
      pct.textContent = Math.round(row.cost / sum * 100) + '%';
      wr.appendChild(pct);
      var cost = document.createElement('span');
      cost.className = 'dshwv-usage-ratio-cost';
      bindMoney(cost, row.cost);
      cost.title = cost.textContent;
      wr.appendChild(cost);
      costEls.push(cost);
      body.appendChild(wr);
    });
    try {
      var parW = costEls[0] && costEls[0].parentNode ? costEls[0].parentNode.clientWidth : 420;
      var capCost = Math.max(50, Math.floor(parW - 96 - 42 - 32));
      var maxCost = 40;
      for (var c1 = 0; c1 < costEls.length; c1++) {
        var cw1 = costEls[c1].scrollWidth || 40;
        if (cw1 > maxCost) maxCost = cw1;
      }
      var useCost = Math.min(maxCost, capCost);
      for (var c2 = 0; c2 < costEls.length; c2++) {
        costEls[c2].style.width = useCost + 'px';
        costEls[c2].style.textAlign = 'right';
        costEls[c2].style.overflow = 'hidden';
        costEls[c2].style.textOverflow = 'ellipsis';
      }
    } catch (err) {}
  }
  function usageDrawBarChart(body, secTitle, days, opts) {
    opts = opts || ({});
    var todayKey = String(opts.today || '');
    var onPick = opts.onPick || null;
    body.appendChild(sectionTitle(secTitle, ''));
    if (!days || !days.length) {
      var no = document.createElement('div');
      no.className = 'dshwv-usage-hint';
      no.textContent = '暂无每日数据';
      body.appendChild(no);
      return;
    }
    var wrap = document.createElement('div');
    wrap.className = 'dshwv-usage-chartwrap';
    var canvas = document.createElement('canvas');
    wrap.appendChild(canvas);
    var tip = document.createElement('div');
    tip.className = 'dshwv-usage-tip';
    tip.style.display = 'none';
    wrap.appendChild(tip);
    body.appendChild(wrap);
    var bars = [];
    function paint(hoverIdx) {
      var cw = Math.max(120, wrap && (wrap.clientWidth || (wrap.getBoundingClientRect ? wrap.getBoundingClientRect().width : 0)) || canvas.clientWidth || 520);
      var ch = 150;
      var dpr = window.devicePixelRatio || 1;
      canvas.width = Math.max(1, Math.round(cw * dpr));
      canvas.height = Math.max(1, Math.round(ch * dpr));
      canvas.style.width = cw + 'px';
      canvas.style.height = ch + 'px';
      var g = canvas.getContext('2d');
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      g.clearRect(0, 0, cw, ch);
      var padL = 42, padR = 10, padT = 10, padB = 22;
      var iw = cw - padL - padR;
      var ih = ch - padT - padB;
      var max = 1;
      for (var i = 0; i < days.length; i++) max = Math.max(max, Number(days[i].total) || 0);
      var step = iw / days.length;
      var bw = Math.max(3, Math.min(36, step * 0.62));
      bars = [];
      for (var k = 0; k < days.length; k++) {
        var unknown = days[k].total == null || !Number.isFinite(Number(days[k].total));
        var val = unknown ? 0 : Number(days[k].total);
        var h = val > 0 ? Math.max(2, val / max * ih) : 0;
        var x = padL + step * k + (step - bw) / 2;
        var y = padT + ih - h;
        var kToday = !!(todayKey && String(days[k].date || '') === todayKey);
        g.fillStyle = k === hoverIdx ? '#e0433f' : kToday ? '#2fa44c' : '#203170';
        if (k === hoverIdx) {
          g.globalAlpha = 0.9;
        }
        if (unknown) {
          g.fillStyle = '#9fb0d9'; g.font = '11px sans-serif'; g.textAlign = 'center';
          g.fillText('?', x + bw / 2, padT + ih - 3);
        } else if (h > 0) {
          g.fillRect(x, y, bw, h);
        } else {
          g.fillStyle = 'rgba(32,49,112,.25)';
          g.fillRect(x, padT + ih - 3, bw, 3);
        }
        g.globalAlpha = 1;
        bars.push({
          x: x,
          w: bw,
          day: days[k]
        });
        if (days.length <= 16 || k % Math.ceil(days.length / 16) === 0) {
          g.fillStyle = '#9fb0d9';
          g.font = '10px sans-serif';
          g.textAlign = 'center';
          var dl = String(days[k].date || '').split('-');
          var lab = dl.length === 3 ? dl[1] + '-' + dl[2] : days[k].date;
          g.fillText(lab, x + bw / 2, ch - 8);
        }
      }
      g.fillStyle = '#9fb0d9';
      g.font = '10px sans-serif';
      g.textAlign = 'right';
      g.fillText(formatMoney(max), padL - 4, padT + 8);
      g.fillText(formatMoney(max / 2), padL - 4, padT + ih / 2 + 3);
      g.fillText(formatMoney(0), padL - 4, padT + ih + 4);
    }
    function move(ev) {
      var r = canvas.getBoundingClientRect();
      var x = ev.clientX - r.left;
      var hover = -1;
      for (var i = 0; i < bars.length; i++) {
        if (x >= bars[i].x && x <= bars[i].x + bars[i].w) {
          hover = i;
          break;
        }
      }
      paint(hover);
      if (hover >= 0) {
        tip.style.display = 'block';
        var day = bars[hover].day, currency = getCurrency();
        money.bind(tip, function () { return day.date + '  ' + (day.total == null ? '汇总未知' : formatMoney(day.total, currency)); });
        var wr = wrap.getBoundingClientRect();
        var tx = ev.clientX - wr.left + 10;
        if (tx + 130 > wr.width) tx = ev.clientX - wr.left - 140;
        var ty = ev.clientY - wr.top + 12;
        tip.style.left = Math.max(0, tx) + 'px';
        tip.style.top = Math.max(0, ty) + 'px';
      } else {
        tip.style.display = 'none';
      }
    }
    canvas.addEventListener('mousemove', move);
    canvas.addEventListener('mouseleave', function () {
      tip.style.display = 'none';
      paint(-1);
    });
    if (onPick) {
      canvas.addEventListener('click', function (ev) {
        try {
          var rc = canvas.getBoundingClientRect();
          var cx = ev.clientX - rc.left;
          for (var bi = 0; bi < bars.length; bi++) {
            if (cx >= bars[bi].x && cx <= bars[bi].x + bars[bi].w) {
              onPick(bars[bi].day.date);
              break;
            }
          }
        } catch (err) {}
      });
    }
    money.bind(canvas, function () { return money.state().displayCurrency; }, function () { paint(-1); tip.style.display = 'none'; });
    try {
      setTimeout(function () {
        try {
          paint(-1);
        } catch (err) {}
      }, 420);
    } catch (err) {}
  }
  return { ratioRows: usageRatioRows, drawBarChart: usageDrawBarChart };
}
