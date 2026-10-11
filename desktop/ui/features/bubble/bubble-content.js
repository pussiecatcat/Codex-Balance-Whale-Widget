// Snapshot content is selected once per bubble open, with prior random picks scoped here.
export function createBubbleContent(deps) {
  const { window, getState, getLastTurnNotice, fmt, whaleMoneyTemplates,
    usageFillText, bubbleCloneModule, random = Math.random } = deps;
    function bubbleModuleFontU(level) {
      var n = Number(level) || 6;
      n = Math.max(1, Math.min(50, Math.round(n)));
      return Math.round(40 + (n - 1) * 200 / 49);
    }
    function bubbleTokenValue(value) {
      return typeof value === 'number' && isFinite(value) && value >= 0 ? Math.floor(value).toLocaleString('en-US') : '暂无';
    }
    function bubbleContentTokenMap(m, snapshot) {
      m = m || ({});
      var values = snapshot || getState();
      var v = '';
      var map = {};
      if (m.type === 'balance') {
        v = values.balance === null ? '…' : fmt(values.balance, values.currency);
        map['balance_ds'] = v;
        map['balance_api'] = v;
      } else if (m.type === 'today') {
        v = values.todayUsage !== null && values.todayUsage !== undefined ? fmt(values.todayUsage, values.currency) : '--';
        map['expense_ds'] = v;
        map['expense_api'] = v;
      } else if (m.type === 'turn') {
        map['turn_tokens'] = bubbleTokenValue(values && values.tokens);
        map['turn_input'] = bubbleTokenValue(values && values.inputTokens);
        map['turn_output'] = bubbleTokenValue(values && values.outputTokens);
        map['turn_cached'] = bubbleTokenValue(values && values.cachedInputTokens);
        map['turn_reasoning'] = bubbleTokenValue(values && values.reasoningOutputTokens);
      } else if (m.type === 'session') {
        map['session_name'] = values && values.sessionLabel ? String(values.sessionLabel) : '当前会话';
      }
      return map;
    }
    function bubbleTplHelpItems(m) {
      m = m || ({});
      var arr = [];
      function add(k, d) {
        arr.push({
          k: '{' + k + '}',
          d: d
        });
      }
      if (m.type === 'balance') add('balance_ds', '余额数值'); else if (m.type === 'today') add('expense_ds', '今日已观测金额');
      else if (m.type === 'quota') {
        add('quota_left', '剩余百分比（1 位小数）'); add('quota_left_round', '剩余百分比（整数）'); add('quota_used', '已用百分比');
        add('quota_reset', '精确重置倒计时'); add('quota_reset_short', '简洁重置倒计时'); add('quota_reset_at', '重置时间'); add('quota_updated_at', '快照更新时间');
        add('quota_bar', '剩余额度条'); add('quota_label', '额度窗口名称');
        add('quota_source', '额度数据来源');
      } else if (m.type === 'turn') {
        add('turn_tokens', '上轮总 token'); add('turn_input', '输入 token'); add('turn_output', '输出 token');
        add('turn_cached', '缓存输入 token'); add('turn_reasoning', '推理输出 token');
      } else if (m.type === 'session') add('session_name', '当前 Codex 项目或工作区名称');
      else if (m.type === 'plan') { add('plan_name', 'Codex 套餐名称'); add('plan_type', '套餐原始标识'); }
      else if (m.type === 'peak' || m.type === 'nextpeak') {
        add('peak_phase', '当前峰谷状态'); add('peak_countdown', '距离下次切换'); add('peak_switch_at', '下次切换时间'); add('peak_note', '峰谷规则说明');
      }
      return arr;
    }
    function bubbleContentText(m, autoTxt, snapshot) {
      m = m || ({});
      if (!m.tpl || !String(m.tpl).length) return autoTxt;
      var map = bubbleContentTokenMap(m, snapshot);
      var s = String(m.tpl);
      var keys = Object.keys(map).sort(function (a, b) {
        return b.length - a.length;
      });
      for (var i = 0; i < keys.length; i++) s = s.split('{' + keys[i] + '}').join(String(map[keys[i]]));
      return s;
    }
    function bubblePickLine(lines, avoidIdx) {
      if (!Array.isArray(lines) || !lines.length) return null;
      if (lines.length === 1) return 0;
      var total = 0;
      for (var i = 0; i < lines.length; i++) total += Math.max(1, Number(lines[i].w) || 1);
      var pick;
      for (var guard = 0; guard < 6; guard++) {
        var r = random() * total;
        var acc = 0;
        pick = lines.length - 1;
        for (var j = 0; j < lines.length; j++) {
          acc += Math.max(1, Number(lines[j].w) || 1);
          if (r < acc) {
            pick = j;
            break;
          }
        }
        if (pick !== avoidIdx) break;
      }
      return pick;
    }

    function bubbleRowContentOf(mod) {
      mod = mod || ({});
      var state = getState();
      var lastTurnNotice = getLastTurnNotice();
      if (mod.apiModelId && (mod.type === 'balance' || mod.type === 'today' || mod.type === 'quota' || mod.type === 'plan')) {
        var apiModelText = function () { return window.WhaleApiModels?.text(mod) || 'API 模型加载中…'; };
        return { txt: apiModelText(), line: null, apiModelText: apiModelText };
      }
      if (mod.type === 'quota' || mod.type === 'plan' || mod.type === 'peak' || mod.type === 'nextpeak') {
        var quotaText = function () { return window.WhaleQuota?.text(mod) || '额度加载中…'; };
        return { txt: quotaText(), line: null, quotaText: quotaText };
      }
      if (mod.type === 'turn') {
        var defaultTurnText = lastTurnNotice && lastTurnNotice.tokens != null ? '上轮使用 ' + bubbleTokenValue(lastTurnNotice.tokens) + ' tokens' : '暂无上轮用量';
        return { txt: bubbleContentText(mod, defaultTurnText, lastTurnNotice || {}), line: null };
      }
      if (mod.type === 'session') {
        var defaultSessionText = lastTurnNotice && lastTurnNotice.sessionLabel ? '当前会话 · ' + lastTurnNotice.sessionLabel : '当前会话';
        return { txt: bubbleContentText(mod, defaultSessionText, lastTurnNotice || {}), line: null };
      }
      if (mod.type === 'balance' || mod.type === 'today') {
        var captured = { balance: state.balance, todayUsage: state.todayUsage, currency: state.currency || 'USD' };
        var moneyText = function () {
          var value = mod.type === 'balance' ? captured.balance === null ? '…' : fmt(captured.balance, captured.currency) :
            '今日已观测 ' + (captured.todayUsage != null ? fmt(captured.todayUsage, captured.currency) : '--');
          return bubbleContentText(mod, value, captured);
        };
        return { txt: moneyText(), line: null, moneyText: moneyText };
      }
      var reminder = whaleMoneyTemplates.get(mod);
      function reminderText(template) {
        return function () { return usageFillText(template, reminder.below, reminder.amount, reminder.currency, reminder.notice); };
      }
      if (mod.type === 'random' && Array.isArray(mod.lines)) {
        var pi = bubblePickLine(mod.lines, mod._lastPick);
        if (pi !== null && pi !== undefined && mod.lines[pi]) {
          mod._lastPick = pi;
          var selectedText = mod.lines[pi].t;
          var selectedMoney = reminder ? reminderText(selectedText) : null;
          return {
            txt: selectedMoney ? selectedMoney() : selectedText,
            line: mod.lines[pi],
            moneyText: selectedMoney
          };
        }
        return {
          txt: '',
          line: null
        };
      }
      var templateText = reminder ? reminderText(reminder.template) : null;
      return { txt: templateText ? templateText() : mod.text || '', line: null, moneyText: templateText };
    }
    var bubblePreviousPicks = new WeakMap();
    var bubblePreviousImagePicks = new WeakMap();
    function bubbleSnapshot(mods, remember) {
      var rows = new Map();
      var copies = (Array.isArray(mods) ? mods : []).map(function (original) {
        var copy = bubbleCloneModule(original);
        if (copy.type === 'random') copy._lastPick = remember && original && typeof original === 'object' ? bubblePreviousPicks.get(original) : undefined;
        if (copy.type === 'randimg') {
          var pool = (Array.isArray(copy.imgs) ? copy.imgs : []).filter(function (item) { return item && item.imgId; });
          var lastImage = remember && original && typeof original === 'object' ? bubblePreviousImagePicks.get(original) : undefined;
          var pickedImage = bubblePickLine(pool, lastImage);
          copy.imgId = pickedImage != null && pool[pickedImage] ? pool[pickedImage].imgId : '';
          if (remember && original && typeof original === 'object' && pickedImage != null) bubblePreviousImagePicks.set(original, pickedImage);
        }
        var content = bubbleRowContentOf(copy);
        if (remember && copy.type === 'random' && original && typeof original === 'object') bubblePreviousPicks.set(original, copy._lastPick);
        rows.set(copy, Object.freeze(content));
        return copy;
      });
      return { modules: copies, rows: rows };
    }
  return { fontU: bubbleModuleFontU, tokenValue: bubbleTokenValue,
    tplHelpItems: bubbleTplHelpItems, text: bubbleContentText,
    pickLine: bubblePickLine, snapshot: bubbleSnapshot };
}
