// API usage overview formatting and its compact daily summary view.
export function createUsageOverviewView(deps) {
  const { document, WhaleMoney, getCurrency, getMain, getPanel, openRecords,
    nowMs = Date.now } = deps;
    function whaleCurrencySymbol() {
      return WhaleMoney.symbol();
    }
    function usageMoney(x, currency) {
      if (x == null) return '—';
      var text = WhaleMoney.formatMoney(x, currency || getCurrency());
      return String(text).replace(/^([$¥])\s*/, '$1\u00a0');
    }
    function usageMoneyText(x, currency) {
      var nativeCurrency = currency || getCurrency();
      return function () { return usageMoney(x, nativeCurrency); };
    }
    function bindUsageMoney(element, x, currency) {
      element.classList.add('dshwv-usage-money');
      element.classList.toggle('dshwv-usage-money-unknown', x == null);
      return WhaleMoney.bind(element, usageMoneyText(x, currency));
    }
    function usageDayLabel(day) {
      try {
        var d = day.split('-');
        if (d.length !== 3) return day;
        var now = new Date(nowMs());
        var cur = String(now.getFullYear()) + '-' + String(now.getMonth() + 1).padStart(2, '0') + '-' + String(now.getDate()).padStart(2, '0');
        if (day === cur) return '今天';
        return d[1] + '-' + d[2];
      } catch (err) {
        return day;
      }
    }
    function uSectionTitle(leftTxt, rightTxt, rightValue) {
      var h = document.createElement('div');
      h.className = 'dshwv-usage-sec';
      var l = document.createElement('span');
      l.textContent = leftTxt;
      h.appendChild(l);
      var r = document.createElement('span');
      r.className = 'dshwv-usage-total';
      if (arguments.length > 2) bindUsageMoney(r, rightValue);
      else if (typeof rightTxt === 'function') WhaleMoney.bind(r, rightTxt);
      else r.textContent = rightTxt;
      h.appendChild(r);
      return h;
    }
    function fillUsagePanel(d) {
      var hostEl = getMain() || getPanel();
      hostEl.innerHTML = '';
      var wrap = document.createElement('div');
      wrap.className = 'dshwv-usagebody';
      if (!d || !d.ok) {
        wrap.textContent = '记录加载失败';
        hostEl.appendChild(wrap);
        return;
      }
      var today = d.today || ({});
      var todayModels = today.models || [];
      var hasEvToday = todayModels.length > 0;
      wrap.appendChild(uSectionTitle('本机模型费用', null, today.total));
      var todayBox = document.createElement('div');
      todayBox.className = 'dshwv-usage-scroll dshwv-usage-today';
      if (hasEvToday) {
        todayModels.forEach(function (row) {
          var r = document.createElement('div');
          r.className = 'dshwv-usage-row';
          var n = document.createElement('span');
          n.textContent = row.model || '未知';
          n.className = 'dshwv-usage-model';
          r.appendChild(n);
          var c = document.createElement('span');
          bindUsageMoney(c, row.cost);
          r.appendChild(c);
          todayBox.appendChild(r);
        });
      } else if ((today.total || 0) > 0) {
        var noM = document.createElement('div');
        noM.className = 'dshwv-usage-hint';
        noM.textContent = '今日总额来自余额差值,暂不含模型明细(启用会话记录后将按模型展示)';
        todayBox.appendChild(noM);
      } else {
        var empty = document.createElement('div');
        empty.className = 'dshwv-usage-hint';
        empty.textContent = '今日暂无消费记录';
        todayBox.appendChild(empty);
      }
      wrap.appendChild(todayBox);
      wrap.appendChild(uSectionTitle(d.total7Complete === false ? '近7天使用记录（已知小计）' : '近7天使用记录', null, d.total7));
      var daysBox = document.createElement('div');
      daysBox.className = 'dshwv-usage-scroll dshwv-usage-days';
      (d.days7 || []).forEach(function (row) {
        var r = document.createElement('div');
        r.className = 'dshwv-usage-row';
        var n = document.createElement('span');
        n.textContent = usageDayLabel(row.date);
        r.appendChild(n);
        var c = document.createElement('span');
        bindUsageMoney(c, row.total);
        r.appendChild(c);
        daysBox.appendChild(r);
      });
      wrap.appendChild(daysBox);
      var more = document.createElement('button');
      more.type = 'button';
      more.className = 'dshwv-usage-more dshwv-usage-history';
      more.dataset.action = 'open-usage-history';
      more.textContent = '更多消费记录…';
      more.title = '打开窗口查看全部有记录的消费';
      more.addEventListener('click', function (e) {
        e.stopPropagation();
        openRecords();
      });
      wrap.appendChild(more);
      (getMain() || getPanel()).appendChild(wrap);
    }
  return { currencySymbol: whaleCurrencySymbol, money: usageMoney, moneyText: usageMoneyText,
    bindMoney: bindUsageMoney, sectionTitle: uSectionTitle, fill: fillUsagePanel };
}
