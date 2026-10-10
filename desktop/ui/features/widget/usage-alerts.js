// Usage alert templates, interpolation, and presentation own their transient state.
export function createUsageAlerts(deps) {
  const { document, window, WhaleMoney, whaleMoneyTemplates, fmt, bubbleTokenValue,
    whaleCurrencySymbol, getUsageSet, getLastTurnNotice, getCurrency,
    getBubbleNoticeQueue, getAlertTtl, now = Date.now } = deps;
    var usageAlertBelowFired = false;
    var usageBudgetFiredKey = null;

    // ==== [用量图表、提醒与记录窗口] ====
    function usageTodayKeyStr() {
      var d = new Date(now());
      var p = function (n) {
        return String(n).padStart(2, '0');
      };
      return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
    }
    function usageRemindDefaultLines(isAlert) {
      return [{
        type: 'text',
        text: isAlert ? '余额已低于 {currency}{below}' : '今日已观测已达预算 {currency}{amount}',
        size: 7,
        bold: true
      }];
    }
    function usageTurnCostDefaultLines() {
      return [
        { type: 'text', text: '{turn_title}', size: 6, bold: true },
        { type: 'text', text: '{turn_primary}', size: 16, bold: true, color: '#4059b3' },
        { type: 'text', text: '{turn_detail}', size: 2, color: '#63719a' }
      ];
    }
    function usageWaitDefaultLines(kind) {
      return [
        { type: 'text', text: kind === 'approval' ? 'Codex 正在等你授权' : 'Codex 正在等你回答', size: 6, bold: true },
        { type: 'text', text: '{session}', size: 3, color: '#63719a' }
      ];
    }
    function usageWaitLinesOf(cfg, kind) {
      return cfg && Array.isArray(cfg.lines) && cfg.lines.length ? cfg.lines : usageWaitDefaultLines(kind);
    }
    function usageTurnCostLines() {
      var usageSet = getUsageSet();
      var cfg = usageSet && usageSet.turnCost || ({});
      return Array.isArray(cfg.lines) && cfg.lines.length ? cfg.lines : usageTurnCostDefaultLines();
    }
    function usageRemindTtlMs(cfg) {
      cfg = cfg || ({});
      if (cfg.autoClose === false) return 0;
      var s = Number(cfg.ttlSec);
      if (cfg.ttlSec !== undefined && isFinite(s) && s > 0) return Math.max(500, Math.round(s * 1000));
      return getAlertTtl();
    }
    function usageRemindLinesOf(cfg, isAlert) {
      cfg = cfg || ({});
      if (Array.isArray(cfg.lines) && cfg.lines.length) return cfg.lines;
      return usageRemindDefaultLines(isAlert);
    }
    function usageTurnValues(notice) {
      notice = notice || getLastTurnNotice() || ({});
      var subscription = typeof window !== 'undefined' && window.WhaleAccountView?.mode === 'subscription';
      var title = subscription ? (notice.failureKind === 'high-demand' ? '本轮未完成' : notice.completionKind === 'cancelled' ? '本轮已取消' : notice.completionKind === 'failed' ? '本轮失败' : '本轮已完成') : (notice.label === '上一轮期间 API 扣费:' ? '本轮 API 消耗' : notice.label || '本轮已观测消耗');
      var cost = notice.amount == null ? (notice.costState === 'pending' ? '待记账' : '金额未知') : fmt(notice.amount, notice.currency || getCurrency());
      var primary = subscription ? (notice.tokens == null ? '用量待更新' : bubbleTokenValue(notice.tokens) + ' tokens') : cost;
      var detail = subscription ? (notice.inputTokens != null || notice.outputTokens != null ? '输入 ' + bubbleTokenValue(notice.inputTokens) + ' · 输出 ' + bubbleTokenValue(notice.outputTokens) + (notice.cachedInputTokens ? ' · 缓存 ' + bubbleTokenValue(notice.cachedInputTokens) : '') : '已计入本机统计') :
        (notice.tokens == null ? '' : bubbleTokenValue(notice.tokens) + ' tokens · ') + (notice.costState === 'estimated' ? '配置价格估算' : notice.costState === 'pending' ? '等待账单确认' : notice.costState === 'unknown' ? '以服务商账单为准' : '同密钥区间观测');
      return { turn_title: title, turn_primary: primary, turn_detail: detail, cost: cost,
        turn_tokens: bubbleTokenValue(notice.tokens), turn_input: bubbleTokenValue(notice.inputTokens), turn_output: bubbleTokenValue(notice.outputTokens),
        turn_cached: bubbleTokenValue(notice.cachedInputTokens), turn_reasoning: bubbleTokenValue(notice.reasoningOutputTokens), session: notice.sessionLabel || '当前对话', session_name: notice.sessionLabel || '当前会话',
        api_name: notice.apiName || 'API 模型', api_balance: notice.apiBalance || '12.00', api_cost: notice.apiCost || '0.08', api_quota_left: notice.apiQuotaLeft || '75%' };
    }
    function usageFillText(txt, below, amount, currency, notice) {
      var text = String(txt || '').replace(/\{currency\}/g, whaleCurrencySymbol()).replace(/\{below\}/g, below != null ? WhaleMoney.formatNumber(below, currency) : '').replace(/\{amount\}/g, amount != null ? WhaleMoney.formatNumber(amount, currency) : '');
      var map = usageTurnValues(notice), keys = Object.keys(map).sort(function (a, b) { return b.length - a.length; });
      for (var i = 0; i < keys.length; i++) text = text.split('{' + keys[i] + '}').join(String(map[keys[i]]));
      return text;
    }
    function usageLineFontPx(level) {
      var n = Math.max(1, Math.min(50, Math.round(Number(level) || 7)));
      return Math.min(40, Math.round(12 + (n - 1) * 0.8));
    }
    function usageAppendLine(body, m, below, amount) {
      try {
        m = m || ({});
        var raw = String(m.text != null ? m.text : '');
        var txt = usageFillText(raw, below, amount);
        var div = document.createElement('div');
        div.style.margin = '4px auto';
        div.style.maxWidth = '100%';
        if (!txt) {
          div.style.height = '8px';
          div.style.margin = '2px auto';
          body.appendChild(div);
          return;
        }
        var nativeCurrency = getCurrency();
        WhaleMoney.bind(div, function () { return usageFillText(raw, below, amount, nativeCurrency); });
        div.style.display = 'inline-block';
        div.style.textAlign = 'center';
        div.style.whiteSpace = 'pre-wrap';
        div.style.wordBreak = 'break-word';
        div.style.fontSize = usageLineFontPx(m.size) + 'px';
        div.style.lineHeight = '1.4';
        if (m.bold) div.style.fontWeight = '700';
        if (m.italic) div.style.fontStyle = 'italic';
        if (m.ul) div.style.textDecoration = 'underline';
        if (m.fontFamily) div.style.fontFamily = m.fontFamily;
        var bg = m.bg ? String(m.bg) : '';
        if (bg) {
          div.style.background = bg;
          div.style.borderRadius = '7px';
          div.style.padding = '1px 8px';
        }
        var col = m.color ? String(m.color) : '';
        if (col && !m.rgb && !m.bgRgb) div.style.color = col;
        body.appendChild(div);
      } catch (err) {}
    }
    function checkUsageAlerts(balance, todayUsage) {
      try {
        var usageSet = getUsageSet();
        if (!usageSet) return;
        var a = usageSet.alert;
        if (a && a.on) {
          var below = Number(a.below);
          if (isFinite(below) && typeof balance === 'number' && balance > 0 && balance <= below) {
            if (!usageAlertBelowFired) {
              usageAlertBelowFired = true;
              showUsagePopup('余额预警', usageRemindLinesOf(a, true), below, null, 2, a);
            }
          } else if (typeof balance === 'number' && balance > below) {
            usageAlertBelowFired = false;
          }
        }
        var b = usageSet.budget;
        if (b && b.on) {
          var amt = Number(b.amount);
          if (isFinite(amt) && amt > 0 && typeof todayUsage === 'number' && todayUsage >= amt) {
            var key = usageTodayKeyStr() + ':' + String(amt);
            if (usageBudgetFiredKey !== key) {
              usageBudgetFiredKey = key;
              showUsagePopup('今日预算提醒', usageRemindLinesOf(b, false), null, amt, 1, b);
            }
          }
        }
      } catch (err) {}
    }
    function usageAlertModsResolved(mods, below, amount, notice) {
      var out = [];
      try {
        for (var i = 0; i < mods.length; i++) {
          var m0 = mods[i] || ({});
          var cp = JSON.parse(JSON.stringify(m0));
          var raw = String(m0.text != null ? m0.text : '');
          whaleMoneyTemplates.set(cp, { template: raw, below: below, amount: amount, currency: getCurrency(), notice: notice || null });
          cp.text = raw.length ? usageFillText(raw, below, amount, getCurrency(), notice) : raw;
          out.push(cp);
        }
      } catch (err) {}
      return out;
    }
    function showUsagePopup(title, content, below, amount, rank, cfg) {
      try {
        var mods = [];
        if (typeof content === 'string') mods = [{
          type: 'text',
          text: content,
          size: 7,
          bold: true
        }]; else if (Array.isArray(content)) mods = content;
        if (mods.length && getBubbleNoticeQueue().push({
          kind: 'alert',
          mods: usageAlertModsResolved(mods, below, amount),
          rank: rank === 1 || rank === 2 ? rank : 2,
          ttlMs: usageRemindTtlMs(cfg)
        })) return;
        usagePopupCard(title, content, below, amount);
      } catch (err) {}
    }
    function usagePopupCard(title, content, below, amount) {
      try {
        var mask = document.createElement('div');
        mask.className = 'dshwv-usage-mask';
        var card = document.createElement('div');
        card.className = 'dshwv-usage-card';
        card.style.width = 'min(380px,90vw)';
        var t = document.createElement('div');
        t.className = 'dshwv-usage-wintitle';
        t.textContent = title || '提示';
        card.appendChild(t);
        var body = document.createElement('div');
        body.className = 'dshwv-usage-windowbody';
        body.style.textAlign = 'center';
        if (typeof content === 'string') {
          body.textContent = usageFillText(content, below, amount);
          body.style.whiteSpace = 'pre-wrap';
        } else if (Array.isArray(content)) {
          for (var i = 0; i < content.length; i++) usageAppendLine(body, content[i], below, amount);
        } else {
          body.textContent = '';
        }
        card.appendChild(body);
        var btns = document.createElement('div');
        btns.className = 'dshwv-bubbtns';
        btns.style.justifyContent = 'center';
        var ok = document.createElement('button');
        ok.type = 'button';
        ok.className = 'dshwv-bubbtn dshwv-bubbtn-ok';
        ok.textContent = '知道了';
        ok.addEventListener('click', function () {
          try {
            document.body.removeChild(mask);
          } catch (err) {}
        });
        btns.appendChild(ok);
        card.appendChild(btns);
        mask.appendChild(card);
        mask.addEventListener('click', function (e) {
          if (e.target === mask) {
            try {
              document.body.removeChild(mask);
            } catch (err) {}
          }
        });
        document.body.appendChild(mask);
      } catch (err) {}
    }
  return { usageTodayKeyStr, usageRemindDefaultLines, usageTurnCostDefaultLines,
    usageWaitDefaultLines, usageWaitLinesOf, usageTurnCostLines, usageRemindLinesOf,
    usageFillText, usageAlertModsResolved, checkUsageAlerts, showUsagePopup };
}
