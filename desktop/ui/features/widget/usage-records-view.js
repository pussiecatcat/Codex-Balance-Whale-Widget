// The usage history modal owns its expandable charts and daily event view.
export function createUsageRecordsView(deps) {
  const { document, card: usageMoreCard, close: closeUsageRecordsWindow,
    bindUsageMoney, usageMoney, usageMoneyText, usageAggModels, usageRatioRows,
    usageDrawBarChart, usageTodayKeyStr, WhaleMoney, getCurrency } = deps;
    function usageSlide(el, open) {
      try {
        if (!el) return;
        if (el.__dshwSlide) clearTimeout(el.__dshwSlide);
        el.style.transition = 'max-height .24s ease, opacity .16s ease';
        el.style.overflow = 'hidden';
        if (open) {
          el.style.display = 'block';
          var h0 = el.scrollHeight;
          if (h0 <= 0) h0 = 100;
          el.style.opacity = '0';
          el.style.maxHeight = '0px';
          void el.offsetHeight;
          el.style.opacity = '1';
          el.style.maxHeight = h0 + 'px';
          el.__dshwSlide = setTimeout(function () {
            el.style.maxHeight = '';
            el.style.overflow = '';
            el.style.transition = '';
            el.__dshwSlide = null;
          }, 260);
        } else {
          var ch = el.scrollHeight;
          if (ch <= 0) {
            el.style.display = 'none';
            el.style.transition = '';
            return;
          }
          el.style.maxHeight = ch + 'px';
          void el.offsetHeight;
          el.style.opacity = '0';
          el.style.maxHeight = '0px';
          el.__dshwSlide = setTimeout(function () {
            el.style.display = 'none';
            el.style.maxHeight = '';
            el.style.opacity = '';
            el.style.overflow = '';
            el.style.transition = '';
            el.__dshwSlide = null;
          }, 250);
        }
      } catch (err) {
        try {
          el.style.display = open ? 'block' : 'none';
        } catch (err2) {}
      }
    }
    function usageCollapseBlock(parent, label, openDefault, build) {
      var box = document.createElement('div');
      var hd = document.createElement('button');
      hd.type = 'button';
      hd.className = 'dshwv-usage-collapse';
      var inner = document.createElement('div');
      inner.className = 'dshwv-usage-collapse-body';
      inner.style.display = 'none';
      var opened = false;
      var st = false;
      function ensureBuild() {
        if (!opened) {
          opened = true;
          try {
            build(inner);
          } catch (err) {}
        }
      }
      function openNow() {
        st = true;
        inner.style.display = 'block';
        inner.style.maxHeight = '0px';
        inner.style.overflow = 'hidden';
        ensureBuild();
        usageSlide(inner, true);
        paint();
      }
      function closeNow() {
        st = false;
        usageSlide(inner, false);
        paint();
      }
      function paint() {
        hd.innerHTML = '';
        var l = document.createElement('span');
        l.textContent = label;
        hd.appendChild(l);
        var ch = document.createElement('span');
        ch.className = 'dshwv-usage-chev';
        ch.textContent = st ? '▾' : '▸';
        hd.appendChild(ch);
      }
      hd.addEventListener('click', function () {
        if (st) closeNow(); else openNow();
      });
      box.__open = openNow;
      box.__close = closeNow;
      paint();
      box.appendChild(hd);
      box.appendChild(inner);
      parent.appendChild(box);
      if (openDefault) openNow();
      return box;
    }
    function usageEvTime(ev) {
      try {
        var dd = new Date(ev.ts);
        var p2 = function (n) {
          return String(n).padStart(2, '0');
        };
        return p2(dd.getHours()) + ':' + p2(dd.getMinutes());
      } catch (err) {
        return '';
      }
    }
    function fillUsageRecordsWindow(d) {
      var card = usageMoreCard;
      card.innerHTML = '';
      var title = document.createElement('div');
      title.className = 'dshwv-usage-wintitle';
      title.textContent = 'API 消费记录';
      card.appendChild(title);
      var closeBtn = document.createElement('button');
      closeBtn.type = 'button';
      closeBtn.className = 'dshwv-usage-close';
      closeBtn.textContent = '×';
      closeBtn.title = '关闭';
      closeBtn.addEventListener('click', closeUsageRecordsWindow);
      card.appendChild(closeBtn);
      var body = document.createElement('div');
      body.className = 'dshwv-usage-windowbody';
      card.appendChild(body);
      if (!d || !d.ok) {
        body.textContent = '加载失败';
        return;
      }
      var allDays = (d.all && d.all.days || []).slice().sort(function (a, b) {
        return a.date < b.date ? -1 : 1;
      });
      var evAll = (d.all && d.all.events || []).slice();
      var sumAll = 0;
      var maxDay = null;
      var missingDays = 0;
      for (var s1 = 0; s1 < allDays.length; s1++) {
        if (allDays[s1].total == null || !Number.isFinite(Number(allDays[s1].total))) { missingDays++; continue; }
        sumAll += Number(allDays[s1].total);
        if (!maxDay || Number(allDays[s1].total) > Number(maxDay.total)) maxDay = allDays[s1];
      }
      var totalIncomplete = missingDays > 0 || d.all && d.all.totalComplete === false;
      var ov = document.createElement('div');
      ov.className = 'dshwv-usage-oview';
      var ovL = document.createElement('div');
      ovL.textContent = totalIncomplete ? '全部消费（已知小计）' : '全部消费';
      ov.appendChild(ovL);
      var ovN = document.createElement('div');
      ovN.className = 'dshwv-usage-oview-num';
      if (totalIncomplete && !maxDay) ovN.textContent = '未知';
      else bindUsageMoney(ovN, sumAll);
      ov.appendChild(ovN);
      var ovS = document.createElement('div');
      ovS.className = 'dshwv-usage-hint';
      var recordCurrency = getCurrency();
      WhaleMoney.bind(ovS, function () { return '显示最近 ' + evAll.length + ' 笔明细' +
        (totalIncomplete ? ' · ' + missingDays + ' 天汇总未知，未计入小计' : '') +
        (maxDay ? ' · 已知峰值 ' + maxDay.date + ' ' + usageMoney(maxDay.total, recordCurrency) : ''); });
      ov.appendChild(ovS);
      body.appendChild(ov);
      var detailBox = null;
      usageCollapseBlock(body, '统计图表(近30天 / 模型占比)', false, function (inner) {
        usageDrawBarChart(inner, '近30天消费(绿柱=今天,点柱定位到当日)', allDays.slice(-30), {
          today: usageTodayKeyStr(),
          onPick: function (date) {
            try {
              if (!detailBox) return;
              detailBox.__open();
              setTimeout(function () {
                var tr = detailBox.querySelector('[data-usage-day="' + String(date) + '"]');
                if (tr) {
                  tr.scrollIntoView({
                    block: 'center',
                    behavior: 'smooth'
                  });
                  tr.style.boxShadow = 'inset 0 0 0 2px rgba(32,49,112,.55)';
                  setTimeout(function () {
                    tr.style.boxShadow = '';
                  }, 1400);
                }
              }, 120);
            } catch (err) {}
          }
        });
        var todayAgg = usageAggModels(d.today && d.today.models ? [{
          models: d.today.models
        }] : []);
        usageRatioRows(inner, '今日模型估算占比', todayAgg, usageMoneyText(d.today && d.today.total || 0));
        var sevenAgg = usageAggModels(d.days7 || []);
        usageRatioRows(inner, d.total7Complete === false ? '近7天模型估算占比（合计不完整）' : '近7天模型估算占比', sevenAgg, usageMoneyText(d.total7));
      });
      detailBox = usageCollapseBlock(body, '每日与逐条明细', false, function (inner) {
        var search = document.createElement('input');
        search.type = 'text';
        search.className = 'dshwv-colnat';
        search.style.width = '100%';
        search.style.margin = '2px 0 6px';
        search.placeholder = '搜索:日期(如 07-21)或模型名,过滤逐条明细…';
        inner.appendChild(search);
        var evMap = {};
        evAll.forEach(function (ev) {
          var day = ev.day || '';
          if (!day) {
            try {
              var dd2 = new Date(ev.ts);
              day = dd2.getFullYear() + '-' + String(dd2.getMonth() + 1).padStart(2, '0') + '-' + String(dd2.getDate()).padStart(2, '0');
            } catch (err) {}
          }
          if (!day) return;
          (evMap[day] = evMap[day] || []).push(ev);
        });
        var dayTot = {};
        allDays.forEach(function (dx) {
          dayTot[dx.date] = dx.total == null ? null : Number(dx.total);
        });
        var todayKeyStr2 = usageTodayKeyStr();
        function dayGroup(day, evs) {
          var row = document.createElement('div');
          row.className = 'dshwv-usage-row';
          row.style.cursor = 'pointer';
          row.setAttribute('data-usage-day', day);
          var name = document.createElement('span');
          name.style.flex = '1 1 auto';
          name.style.minWidth = '0';
          name.style.overflow = 'hidden';
          name.style.textOverflow = 'ellipsis';
          name.style.whiteSpace = 'nowrap';
          name.textContent = day + (evs.length ? ' (' + evs.length + ')' : '');
          row.appendChild(name);
          var c = document.createElement('span');
          c.style.flex = '0 0 auto';
          var dayV = dayTot[day];
          if (dayV === undefined && day === todayKeyStr2 && d.today && d.today.total != null && isFinite(Number(d.today.total))) dayV = Number(d.today.total);
          if (dayV == null || !isFinite(dayV)) {
            c.textContent = '未知';
            c.title = '旧日汇总缺失；逐轮观测区间可能重叠，不能相加补成每日账单';
          } else bindUsageMoney(c, dayV);
          row.appendChild(c);
          var chev = document.createElement('span');
          chev.className = 'dshwv-usage-chev';
          chev.textContent = '▸';
          row.appendChild(chev);
          var detail = document.createElement('div');
          detail.className = 'dshwv-usage-daydetail';
          detail.style.display = 'none';
          var built = false;
          row.addEventListener('click', function (e) {
            var on = detail.style.display !== 'block';
            if (on) {
              if (!built) {
                built = true;
                var lim = Math.min(evs.length, 100);
                for (var i = 0; i < lim; i++) {
                  var ev = evs[i];
                  var r2 = document.createElement('div');
                  r2.className = 'dshwv-usage-row';
                  r2.style.padding = '2px 0 2px 6px';
                  var n2 = document.createElement('span');
                  n2.style.flex = '1 1 auto';
                  n2.style.minWidth = '0';
                  n2.style.overflow = 'hidden';
                  n2.style.textOverflow = 'ellipsis';
                  n2.style.whiteSpace = 'nowrap';
                  n2.textContent = (usageEvTime(ev) ? usageEvTime(ev) + '  ' : '') + (ev.model || '未知');
                  n2.title = n2.textContent;
                  r2.appendChild(n2);
                  var c2 = document.createElement('span');
                  c2.style.flex = '0 0 auto';
                  bindUsageMoney(c2, ev.cost);
                  r2.appendChild(c2);
                  detail.appendChild(r2);
                }
                if (evs.length > lim) {
                  var moreTxt = document.createElement('div');
                  moreTxt.className = 'dshwv-usage-hint';
                  moreTxt.textContent = '… 该日共 ' + evs.length + ' 条,仅显示前 ' + lim + ' 条';
                  detail.appendChild(moreTxt);
                }
                if (!evs.length) {
                  var nd = document.createElement('div');
                  nd.className = 'dshwv-usage-hint';
                  nd.textContent = '该日仅总额(启用模型明细后展示逐条)';
                  detail.appendChild(nd);
                }
              }
              chev.textContent = '▾';
            } else chev.textContent = '▸';
            usageSlide(detail, on);
          });
          row.appendChild(detail);
          return row;
        }
        var listWrap = document.createElement('div');
        inner.appendChild(listWrap);
        function renderGroups(q) {
          var ql = String(q || '').trim().toLowerCase();
          var groups = [];
          for (var gi = 0; gi < allDays.length; gi++) {
            var day0 = allDays[gi].date;
            var evs = evMap[day0] || [];
            var hit = !ql || day0.toLowerCase().indexOf(ql) >= 0;
            if (!hit) {
              for (var ei = 0; ei < evs.length && !hit; ei++) if (String(evs[ei].model || '').toLowerCase().indexOf(ql) >= 0) hit = true;
            }
            if (hit || day0 === usageTodayKeyStr() && !ql) groups.push(day0);
          }
          groups.sort(function (a, b) {
            return a < b ? 1 : a > b ? -1 : 0;
          });
          var step = 12;
          var shown = step;
          listWrap.innerHTML = '';
          if (!groups.length) {
            var noR = document.createElement('div');
            noR.className = 'dshwv-usage-hint';
            noR.textContent = ql ? '没有匹配的记录' : '暂无每日记录';
            listWrap.appendChild(noR);
            return;
          }
          function paintDays() {
            listWrap.innerHTML = '';
            var upto = Math.min(shown, groups.length);
            for (var k = 0; k < upto; k++) {
              var dayK = groups[k];
              listWrap.appendChild(dayGroup(dayK, evMap[dayK] || []));
            }
            if (shown < groups.length) {
              var mb = document.createElement('button');
              mb.type = 'button';
              mb.className = 'dshwv-usage-more';
              mb.textContent = '加载更早记录(还剩 ' + (groups.length - shown) + ' 天)';
              mb.addEventListener('click', function () {
                shown += step;
                paintDays();
              });
              listWrap.appendChild(mb);
            }
          }
          paintDays();
        }
        search.addEventListener('input', function () {
          renderGroups(search.value);
        });
        renderGroups('');
      });
    }
  return { fill: fillUsageRecordsWindow };
}
