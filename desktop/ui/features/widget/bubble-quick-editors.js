// Quick controls for text, data modules, and random sentence lines.
export function createBubbleQuickEditors(deps) {
  const { document, window, qeditClose, qeditEnsure, qRow, qLabel,
    bubbleFontEditRow, qColorSelectBuild, renderBubblePv, qeditPlace,
    getPreviewElement, bubbleTplHelpToggle } = deps;
    function qStyleChecksBuild(getBool, setBool) {
      var row = qRow();
      [['加粗', 'bold'], ['斜体', 'italic'], ['下划线', 'ul']].forEach(function (item) {
        var lab = document.createElement('label');
        lab.style.display = 'inline-flex';
        lab.style.alignItems = 'center';
        lab.style.gap = '3px';
        var cb = document.createElement('input');
        cb.type = 'checkbox';
        cb.checked = !!getBool(item[1]);
        cb.addEventListener('change', function () {
          setBool(item[1], cb.checked);
        });
        lab.appendChild(cb);
        lab.appendChild(document.createTextNode(item[0]));
        row.appendChild(lab);
      });
      return row;
    }
    function openQuickTextEditor(m) {
      if (!m || m.type !== 'text' && m.type !== 'link') return;
      qeditClose();
      var box = qeditEnsure();
      box.innerHTML = '';
      function changed() {
        try {
          renderBubblePv();
        } catch (err) {}
      }
      var r0 = qRow();
      r0.appendChild(qLabel(m.type === 'link' ? '链接文字' : '内容'));
      var tx = document.createElement('input');
      tx.type = 'text';
      tx.maxLength = 60;
      tx.className = 'dshwv-qedit-content';
      tx.value = m.text || '';
      tx.addEventListener('input', function () {
        m.text = tx.value || ' ';
        changed();
      });
      r0.appendChild(tx);
      box.appendChild(r0);
      if (m.type === 'link') {
        var rUrl = qRow();
        rUrl.appendChild(qLabel('链接'));
        var uInp = document.createElement('input');
        uInp.type = 'text';
        uInp.className = 'dshwv-qedit-content';
        uInp.value = m.url || '';
        uInp.placeholder = 'https:// …';
        uInp.title = '点击打开;需以 http:// 或 https:// 开头';
        uInp.addEventListener('input', function () {
          m.url = uInp.value || '';
        });
        rUrl.appendChild(uInp);
        box.appendChild(rUrl);
      }
      box.appendChild(bubbleFontEditRow(function () {
        return m.fontFamily || '';
      }, function (v) {
        m.fontFamily = v || '';
        changed();
      }));
      var r1 = qRow();
      r1.appendChild(qLabel('字号'));
      var sz = document.createElement('input');
      sz.type = 'range';
      sz.min = '1';
      sz.max = '50';
      sz.step = '1';
      sz.className = 'dshwv-range';
      sz.style.flex = '1';
      sz.value = String(Math.max(1, Math.min(50, Math.round(Number(m.size) || 6))));
      var szNum = document.createElement('span');
      szNum.className = 'dshwv-volpct';
      szNum.textContent = sz.value;
      sz.addEventListener('input', function () {
        m.size = Math.round(Number(sz.value) || 3);
        szNum.textContent = sz.value;
        changed();
      });
      r1.appendChild(sz);
      r1.appendChild(szNum);
      box.appendChild(r1);
      box.appendChild(qStyleChecksBuild(function (k) {
        return m[k] === true;
      }, function (k, v) {
        m[k] = v;
        changed();
      }));
      var grpT = document.createElement('div');
      grpT.className = 'dshwv-stylerow';
      var curColor = m.rgb ? m.rgb : 'solid';
      var cc = qColorSelectBuild(curColor, function (v) {
        onPick(v);
      });
      grpT.appendChild(cc.row);
      function onPick(v) {
        if (v === 'solid') {
          m.rgb = '';
          if (!m.color) m.color = '#203170';
        } else {
          m.rgb = v;
          m.color = '';
        }
        cc.sync(v === 'solid' ? 'solid' : v, m.color, function (hex) {
          m.color = hex;
          changed();
        });
        changed();
      }
      var bgCurT = m.bgRgb ? m.bgRgb : m.bg ? 'solid' : 'none';
      var bgt = qColorSelectBuild(bgCurT, function (v) {
        if (v === 'none') {
          m.bgRgb = '';
          m.bg = '';
        } else if (v === 'solid') {
          m.bgRgb = '';
          if (!m.bg) m.bg = '#dbe4f5';
        } else {
          m.bgRgb = v;
          m.bg = '';
        }
        bgt.sync(v === 'none' ? 'none' : v, m.bg, function (hex) {
          m.bg = hex;
          changed();
        });
        changed();
      }, {
        label: '底色',
        defaultHex: '#dbe4f5',
        defaultText: '默认',
        allowNone: true
      });
      grpT.appendChild(bgt.row);
      box.appendChild(grpT);
      cc.sync(curColor, m.color || '#203170', function (hex) {
        m.color = hex;
        changed();
      });
      bgt.sync(bgCurT, m.bg || '#dbe4f5', function (hex) {
        m.bg = hex;
        changed();
      });
      try {
        var pr = getPreviewElement().getBoundingClientRect();
        qeditPlace(pr, Math.max(230, Math.round(pr.width - 24)), true);
      } catch (err) {
        qeditPlace({
          left: 40,
          right: 360,
          top: 200,
          bottom: 300,
          width: 320
        }, 320, false);
      }
    }
    function openQuickModuleEditor(m) {
      if (!m || m.type === 'image' || m.type === 'random' || m.type === 'text') return;
      qeditClose();
      var box = qeditEnsure();
      box.innerHTML = '';
      function changed() {
        try {
          renderBubblePv();
        } catch (err) {}
      }
      function sizeRow() {
        var r = qRow();
        r.appendChild(qLabel('字号'));
        var sz = document.createElement('input');
        sz.type = 'range';
        sz.min = '1';
        sz.max = '50';
        sz.step = '1';
        sz.className = 'dshwv-range';
        sz.style.flex = '1';
        sz.value = String(Math.max(1, Math.min(50, Math.round(Number(m.size) || 6))));
        var num = document.createElement('span');
        num.className = 'dshwv-volpct';
        num.textContent = sz.value;
        sz.addEventListener('input', function () {
          m.size = Math.round(Number(sz.value) || 3);
          num.textContent = sz.value;
          changed();
        });
        r.appendChild(sz);
        r.appendChild(num);
        box.appendChild(r);
      }
      function glyphRow() {
        box.appendChild(qStyleChecksBuild(function (k) {
          return m[k] === true;
        }, function (k, v) {
          m[k] = v;
          changed();
        }));
      }
      function tplRow() {
        var r = qRow();
        r.appendChild(qLabel('内容'));
        var inp = document.createElement('input');
        inp.type = 'text';
        inp.className = 'dshwv-qedit-content';
        inp.value = m.tpl || '';
        inp.placeholder = m.type === 'balance' ? '例: {balance_api}' : m.type === 'today' ? '例: 今日已观测 {expense_api}' : m.type === 'quota' ? '例: 剩余 {quota_left_round} · {quota_reset_short}' : m.type === 'turn' ? '例: 上轮使用 {turn_tokens} tokens' : m.type === 'session' ? '例: 当前会话 {session_name}' : m.type === 'plan' ? '例: {plan_name}' : m.type === 'peak' || m.type === 'nextpeak' ? '例: {peak_phase} · {peak_countdown}' : '自定义内容';
        inp.title = '可用占位符(英文): ' + (m.type === 'balance' ? '{balance_api}' : m.type === 'today' ? '{expense_api}' : m.type === 'turn' ? '{turn_tokens} {turn_input} {turn_output} {turn_cached} {turn_reasoning}' : m.type === 'session' ? '{session_name}' : m.type === 'plan' ? '{plan_name} {plan_type}' : m.type === 'peak' || m.type === 'nextpeak' ? '{peak_phase} {peak_countdown} {peak_switch_at} {peak_note}' : '{quota_left} {quota_left_round} {quota_used} {quota_reset} {quota_reset_short} {quota_reset_at} {quota_updated_at} {quota_bar}');
        inp.addEventListener('input', function () {
          m.tpl = inp.value;
          changed();
        });
        r.appendChild(inp);
        var qb2 = document.createElement('button');
        qb2.type = 'button';
        qb2.className = 'dshwv-tplq';
        qb2.textContent = '?';
        qb2.title = '可用占位符用法';
        qb2.style.marginLeft = '4px';
        qb2.addEventListener('click', function (e) {
          e.stopPropagation();
          bubbleTplHelpToggle(m, qb2);
        });
        r.appendChild(qb2);
        box.appendChild(r);
      }
      if (m.type === 'balance' || m.type === 'today' || m.type === 'quota') {
        var apiModelRow = qRow(); apiModelRow.appendChild(qLabel('数据来源'));
        var apiModelSelect = document.createElement('select'); apiModelSelect.className = 'dshwv-sound';
        apiModelRow.appendChild(apiModelSelect); box.appendChild(apiModelRow);
        if (window.WhaleApiModels) window.WhaleApiModels.options(apiModelSelect, m.apiModelId || '', function (value) {
          m.apiModelId = value || '';
          if (m.apiModelId && m.type === 'quota') delete m.quotaStyle;
          changed(); qeditClose(); openQuickModuleEditor(m);
        });
      }
      if (m.type === 'quota') {
        var windowRow = qRow();
        windowRow.appendChild(qLabel('额度窗口'));
        var windowSelect = document.createElement('select');
        windowSelect.className = 'dshwv-sound';
        (m.apiModelId ? [['primary','当前周期'],['rolling','滚动窗口'],['weekly','每周'],['monthly','每月']] : [['300', '5 小时'], ['10080', '每周']]).forEach(function (entry) {
          var option = document.createElement('option'); option.value = entry[0]; option.textContent = entry[1]; windowSelect.appendChild(option);
        });
        windowSelect.value = m.apiModelId ? m.quotaKey || 'primary' : String(m.windowDurationMins === 10080 ? 10080 : 300);
        windowSelect.addEventListener('change', function () { if(m.apiModelId)m.quotaKey=windowSelect.value;else m.windowDurationMins = Number(windowSelect.value); changed(); });
        windowRow.appendChild(windowSelect); box.appendChild(windowRow);
        var presetRow = qRow(); presetRow.appendChild(qLabel('内容样式'));
        var preset = document.createElement('select'); preset.className = 'dshwv-sound';
        var quotaPresets = m.apiModelId ? [['', '自定义']] : [['__meter__', '潮汐卡片']];
        quotaPresets = quotaPresets.concat([['{quota_left_round}', '仅剩余百分比'], ['{quota_label} 剩余 {quota_left_round}', '窗口 + 剩余'], ['距离重置 {quota_reset_short}', '重置倒计时'], ['{quota_bar} {quota_left_round}', '进度条 + 剩余'], ['{quota_label} · {quota_left_round} · {quota_reset_short}', '完整信息']]);
        if (!quotaPresets.some(function (entry) { return entry[0] === ''; })) quotaPresets.unshift(['', '自定义']);
        quotaPresets.forEach(function (entry) {
          var option = document.createElement('option'); option.value = entry[0]; option.textContent = entry[1]; preset.appendChild(option);
        });
        preset.value = !m.apiModelId && m.quotaStyle === 'meter' ? '__meter__' : Array.from(preset.options).some(function (option) { return option.value === m.tpl; }) ? m.tpl : '';
        preset.addEventListener('change', function () {
          if (preset.value === '__meter__') {
            m.quotaStyle = 'meter';
          } else {
            delete m.quotaStyle;
            if (preset.value) m.tpl = preset.value;
          }
          changed(); qeditClose(); openQuickModuleEditor(m);
        });
        presetRow.appendChild(preset); box.appendChild(presetRow);
      } else if (m.type === 'turn') {
        var turnPresetRow = qRow(); turnPresetRow.appendChild(qLabel('内容样式'));
        var turnPreset = document.createElement('select'); turnPreset.className = 'dshwv-sound';
        [['', '自定义'], ['上轮使用 {turn_tokens} tokens', '总 token'], ['输入 {turn_input} · 输出 {turn_output}', '输入/输出'], ['缓存 {turn_cached} · 推理 {turn_reasoning}', '缓存/推理'], ['上轮 {turn_tokens} tokens · 输入 {turn_input} / 输出 {turn_output}', '完整信息']].forEach(function (entry) {
          var option = document.createElement('option'); option.value = entry[0]; option.textContent = entry[1]; turnPreset.appendChild(option);
        });
        turnPreset.value = Array.from(turnPreset.options).some(function (option) { return option.value === m.tpl; }) ? m.tpl : '';
        turnPreset.addEventListener('change', function () { if (turnPreset.value) m.tpl = turnPreset.value; changed(); qeditClose(); openQuickModuleEditor(m); });
        turnPresetRow.appendChild(turnPreset); box.appendChild(turnPresetRow);
      } else if (m.type === 'peak' || m.type === 'nextpeak') {
        var peakPresetRow = qRow(); peakPresetRow.appendChild(qLabel('显示样式'));
        var peakPreset = document.createElement('select'); peakPreset.className = 'dshwv-sound';
        [['default','默认'],['liangwen','梁文峰谷'],['qiangqiang','!?强强?!'],['count','倒计时'],['mini','简洁(峰/谷)']].forEach(function(entry){
          var option=document.createElement('option');option.value=entry[0];option.textContent=entry[1];peakPreset.appendChild(option);
        });
        peakPreset.value=m.type==='nextpeak'?'count':m.peakStyle||'default';
        peakPreset.addEventListener('change',function(){m.peakStyle=peakPreset.value;m.tpl=peakPreset.value==='count'?'{peak_countdown}':'{peak_phase}';changed();qeditClose();openQuickModuleEditor(m);});
        peakPresetRow.appendChild(peakPreset);box.appendChild(peakPresetRow);
        [['peak','高峰','#e0433f','#fbe7e6'],['off','空闲','#2fa24c','#e4f3e7']].forEach(function(entry){
          var prefix=entry[0],group=document.createElement('div');group.className='dshwv-peakrow';
          var colorKey=prefix+'Color',rgbKey=prefix+'Rgb',bgKey=prefix+'Bg',bgRgbKey=prefix+'BgRgb';
          var color=qColorSelectBuild(m[rgbKey]||'solid',function(value){
            m[rgbKey]=value==='solid'?'':value;m[colorKey]=value==='solid'?m[colorKey]||entry[2]:'';
            color.sync(value,m[colorKey],function(hex){m[colorKey]=hex;changed();});changed();
          },{label:entry[1]+'色',defaultHex:entry[2]});
          group.appendChild(color.row);
          var bg=qColorSelectBuild(m[bgRgbKey]||(m[bgKey]?'solid':'none'),function(value){
            m[bgRgbKey]=value==='none'||value==='solid'?'':value;m[bgKey]=value==='solid'?m[bgKey]||entry[3]:'';
            bg.sync(value,m[bgKey]||entry[3],function(hex){m[bgKey]=hex;changed();});changed();
          },{label:'底色',defaultHex:entry[3],allowNone:true});
          group.appendChild(bg.row);box.appendChild(group);
          color.sync(m[rgbKey]||'solid',m[colorKey]||entry[2],function(hex){m[colorKey]=hex;changed();});
          bg.sync(m[bgRgbKey]||(m[bgKey]?'solid':'none'),m[bgKey]||entry[3],function(hex){m[bgKey]=hex;changed();});
        });
      }
      tplRow();
      {
        box.appendChild(bubbleFontEditRow(function () {
          return m.fontFamily || '';
        }, function (v) {
          m.fontFamily = v || '';
          changed();
        }));
        sizeRow();
        glyphRow();
        var grp2 = document.createElement('div');
        grp2.className = 'dshwv-stylerow';
        var curC = m.rgb ? m.rgb : 'solid';
        var ccA = qColorSelectBuild(curC, function (v) {
          if (v === 'solid') {
            m.rgb = '';
            if (!m.color) m.color = '#203170';
          } else {
            m.rgb = v;
            m.color = '';
          }
          ccA.sync(v === 'solid' ? 'solid' : v, m.color, function (hex) {
            m.color = hex;
            changed();
          });
          changed();
        });
        grp2.appendChild(ccA.row);
        var bgCur = m.bgRgb ? m.bgRgb : m.bg ? 'solid' : 'none';
        var bgcA = qColorSelectBuild(bgCur, function (v) {
          if (v === 'none') {
            m.bgRgb = '';
            m.bg = '';
          } else if (v === 'solid') {
            m.bgRgb = '';
            if (!m.bg) m.bg = '#dbe4f5';
          } else {
            m.bgRgb = v;
            m.bg = '';
          }
          bgcA.sync(v === 'none' ? 'none' : v, m.bg, function (hex) {
            m.bg = hex;
            changed();
          });
          changed();
        }, {
          label: '底色',
          defaultHex: '#dbe4f5',
          defaultText: '默认',
          allowNone: true
        });
        grp2.appendChild(bgcA.row);
        box.appendChild(grp2);
        ccA.sync(curC, m.color || '#203170', function (hex) {
          m.color = hex;
          changed();
        });
        bgcA.sync(bgCur, m.bg || '#dbe4f5', function (hex) {
          m.bg = hex;
          changed();
        });
      }
      try {
        var pr = getPreviewElement().getBoundingClientRect();
        qeditPlace(pr, Math.max(260, Math.round(pr.width - 16)), true);
      } catch (err) {
        qeditPlace({
          left: 40,
          right: 360,
          top: 200,
          bottom: 300,
          width: 320
        }, 320, false);
      }
    }
    function openQuickSentenceEditor(line, mod, rowTx, anchorBtn) {
      if (!line) return;
      qeditClose();
      var box = qeditEnsure();
      box.innerHTML = '';
      function lv(lk, mk, dft) {
        var v = line[lk];
        if (v !== undefined && v !== null) return v;
        var mv = mod[lk];
        if (mv !== undefined && mv !== null) return mv;
        return dft;
      }
      var r0 = qRow();
      r0.appendChild(qLabel('句子'));
      var tx = document.createElement('input');
      tx.type = 'text';
      tx.className = 'dshwv-qedit-content';
      tx.value = line.t || '';
      tx.addEventListener('input', function () {
        line.t = tx.value || ' ';
        try {
          if (rowTx) rowTx.value = tx.value || '';
        } catch (err) {}
      });
      r0.appendChild(tx);
      box.appendChild(r0);
      box.appendChild(bubbleFontEditRow(function () {
        return lv('fontFamily', 'fontFamily', '') || '';
      }, function (v) {
        line.fontFamily = v || '';
      }));
      var r1 = qRow();
      r1.appendChild(qLabel('字号'));
      var sz = document.createElement('input');
      sz.type = 'range';
      sz.min = '1';
      sz.max = '50';
      sz.step = '1';
      sz.className = 'dshwv-range';
      sz.style.flex = '1';
      sz.value = String(Math.max(1, Math.min(50, Math.round(Number(lv('size', 'size', 6))))));
      var szNum = document.createElement('span');
      szNum.className = 'dshwv-volpct';
      szNum.textContent = sz.value;
      sz.addEventListener('input', function () {
        line.size = Math.round(Number(sz.value) || 3);
        szNum.textContent = sz.value;
      });
      r1.appendChild(sz);
      r1.appendChild(szNum);
      box.appendChild(r1);
      box.appendChild(qStyleChecksBuild(function (k) {
        return !!lv(k, k, false);
      }, function (k, v) {
        line[k] = v;
      }));
      var curColor = lv('rgb', 'rgb', '') || 'solid';
      var cc = qColorSelectBuild(curColor, function (v) {
        onPick(v);
      });
      box.appendChild(cc.row);
      function onPick(v) {
        if (v === 'solid') {
          line.rgb = '';
          if (!line.color) line.color = '#203170';
        } else {
          line.rgb = v;
          line.color = '';
        }
        cc.sync(v === 'solid' ? 'solid' : v, line.color, function (hex) {
          line.color = hex;
        });
      }
      cc.sync(curColor, line.color || mod.color || '#203170', function (hex) {
        line.color = hex;
      });
      var lineBgV = line.bgRgb ? line.bgRgb : line.bg ? 'solid' : mod.bgRgb ? mod.bgRgb : mod.bg ? 'solid' : 'none';
      var lineBgHex0 = line.bg || mod.bg || '#dbe4f5';
      var bgcc2 = qColorSelectBuild(lineBgV, function (v) {
        if (v === 'none') {
          line.bgRgb = '';
          line.bg = '';
        } else if (v === 'solid') {
          line.bgRgb = '';
          if (!line.bg) line.bg = lineBgHex0;
        } else {
          line.bgRgb = v;
          line.bg = '';
        }
        bgcc2.sync(v === 'none' ? 'none' : v, line.bg || lineBgHex0, function (h) {
          line.bg = h;
        });
      }, {
        label: '底色',
        defaultHex: lineBgHex0,
        defaultText: '默认',
        allowNone: true
      });
      box.appendChild(bgcc2.row);
      bgcc2.sync(lineBgV, lineBgHex0, function (h) {
        line.bg = h;
      });
      var r = anchorBtn ? anchorBtn.getBoundingClientRect() : {
        left: 40,
        right: 360,
        top: 200,
        bottom: 260,
        width: 320
      };
      qeditPlace(r, 340, false);
    }
  return { openText: openQuickTextEditor, openModule: openQuickModuleEditor,
    openSentence: openQuickSentenceEditor };
}
