import { openOver } from '../../services/layers.js';
import { displayLevel, setFontLevel, FONT_LEVEL_MIN, FONT_LEVEL_MAX } from './font-scale.js';
// Renders the module editor body. The mask, title and body elements stay in
// the caller; this module owns the per-render color/size controls and the
// dialog's content construction.
export function createModuleEditorView({
  document, getLib, getPalEl, getImgList, loadImgs, uploadImg, fontEditRow, colorSelect,
  openSentence, renderPal, typeName, tplHelp, enhanceSelect, cloneModule,
  confirm, libDelete,
}) {
  let colorEl = null, sizeEl = null;
  let moduleImgSelect = null, moduleImgDrop = null, moduleImgPreviewEl = null;
    function render(m, isNew, title, body) {
      if (isNew && m.type === 'text' && m.bold === undefined) m.bold = true;
      colorEl = null;
      sizeEl = null;
      body.innerHTML = '';
      title.textContent = (isNew ? '新增模块: ' : '编辑模块: ') + typeName(m.type, m);
      function moduleTplRow() {
        var row = document.createElement('div');
        row.className = 'dshwv-audiorow';
        var lab = document.createElement('span');
        lab.textContent = '内容';
        lab.style.flex = '0 0 auto';
        row.appendChild(lab);
        var inp = document.createElement('input');
        inp.type = 'text';
        inp.style.flex = '1';
        inp.style.minWidth = '0';
        inp.style.boxSizing = 'border-box';
        inp.style.border = '1px solid rgba(32,49,112,.4)';
        inp.style.borderRadius = '6px';
        inp.style.padding = '3px 6px';
        inp.style.fontSize = '12px';
        inp.style.color = '#203170';
        inp.style.background = '#fff';
        inp.value = m.tpl || '';
        function hintOf() {
          if (m.type === 'balance') return '例: {balance_api}';
          if (m.type === 'today') return '例: 今日已观测 {expense_api}';
          if (m.type === 'quota') return '例: 剩余 {quota_left_round} · {quota_reset_short}';
          if (m.type === 'turn') return '例: 上轮使用 {turn_tokens} tokens';
          return '例: 当前 {status}';
        }
        var hp = hintOf();
        inp.placeholder = hp;
        inp.title = '输入内容;右侧 ? 查看可用占位符';
        inp.addEventListener('input', function () {
          m.tpl = inp.value;
        });
        row.appendChild(inp);
        var qb = document.createElement('button');
        qb.type = 'button';
        qb.className = 'dshwv-tplq';
        qb.textContent = '?';
        qb.title = '可用占位符用法';
        qb.addEventListener('click', function (e) {
          e.stopPropagation();
          tplHelp(m, qb);
        });
        row.appendChild(qb);
        body.appendChild(row);
      }
      if (isNew) {
        var tr = document.createElement('div');
        tr.className = 'dshwv-audiorow';
        var tl = document.createElement('span');
        tl.textContent = '类型';
        tr.appendChild(tl);
        var tsel = document.createElement('select');
        tsel.className = 'dshwv-sound';
        var topts = [['text', '文本'], ['random', '随机语句模块'], ['image', '图片/动图'], ['randimg', '随机图片']];
        for (var ti2 = 0; ti2 < topts.length; ti2++) {
          var o2 = document.createElement('option');
          o2.value = topts[ti2][0];
          o2.textContent = topts[ti2][1];
          tsel.appendChild(o2);
        }
        tsel.value = m.type;
        tsel.addEventListener('change', function () {
          m.type = tsel.value;
          if (m.type === 'random' && !Array.isArray(m.lines)) m.lines = [];
          if (m.type === 'random' && m.bold === undefined) m.bold = true;
          if (m.type === 'text' && m.bold === undefined) m.bold = true;
          if (m.type === 'image' && !m.imgId) m.imgId = '';
          if (m.type === 'randimg' && !Array.isArray(m.imgs)) m.imgs = [];
          render(m, isNew, title, body);
        });
        tr.appendChild(tsel);
        enhanceSelect(tsel);
        body.appendChild(tr);
      }
      if (getLib().length) {
        var lr2 = document.createElement('div');
        lr2.className = 'dshwv-bubsec';
        lr2.textContent = '从模块库载入';
        body.appendChild(lr2);
        for (var li3 = 0; li3 < getLib().length; li3++) {
          (function (lb) {
            var lrow = document.createElement('div');
            lrow.className = 'dshwv-bublibrow';
            var lbtn = document.createElement('button');
            lbtn.type = 'button';
            lbtn.className = 'dshwv-bubnewbtn';
            lbtn.textContent = lb.name;
            lbtn.title = '将该模块配置载入当前编辑';
            lbtn.addEventListener('click', function () {
              var c = cloneModule(lb.module);
              var oldKeys = Object.keys(m);
              for (var kk = 0; kk < oldKeys.length; kk++) {
                try {
                  delete m[oldKeys[kk]];
                } catch (err) {}
              }
              var nk = Object.keys(c);
              for (var j2 = 0; j2 < nk.length; j2++) m[nk[j2]] = c[nk[j2]];
              colorEl = null;
              sizeEl = null;
              render(m, isNew, title, body);
            });
            lrow.appendChild(lbtn);
            var ldel = document.createElement('button');
            ldel.type = 'button';
            ldel.className = 'dshwv-bubmini';
            ldel.textContent = '✕';
            ldel.title = '从模块库删除';
            ldel.addEventListener('click', function () {
              confirm('从模块库删除「' + lb.name + '」?', function () {
                libDelete(lb.id);
                render(m, isNew, title, body);
                if (getPalEl()) renderPal();
              });
            });
            lrow.appendChild(ldel);
            body.appendChild(lrow);
          })(getLib()[li3]);
        }
      }
      if (m.type === 'text') {
        var ti = document.createElement('input');
        ti.type = 'text';
        ti.className = 'dshwv-cropname';
        ti.maxLength = 60;
        ti.value = m.text || '';
        ti.placeholder = '文本内容';
        ti.addEventListener('input', function () {
          m.text = ti.value || ' ';
        });
        body.appendChild(ti);
      } else if (m.type === 'random') {
        var hint = document.createElement('div');
        hint.className = 'dshwv-linehead';
        var hw = document.createElement('span');
        hw.className = 'dshwv-lhw';
        hw.textContent = '权重';
        hint.appendChild(hw);
        var hc = document.createElement('span');
        hc.className = 'dshwv-lhc';
        hc.textContent = '内容';
        hint.appendChild(hc);
        var ho = document.createElement('span');
        ho.className = 'dshwv-lho';
        ho.textContent = '操作';
        hint.appendChild(ho);
        body.appendChild(hint);
        if (!Array.isArray(m.lines)) m.lines = [];
        var listEl = document.createElement('div');
        listEl.className = 'dshwv-listbox';
        listEl.style.maxHeight = '240px';
        listEl.style.overflowY = 'auto';
        listEl.style.paddingRight = '2px';
        body.appendChild(listEl);
        function renderLines() {
          listEl.innerHTML = '';
          for (var i = 0; i < m.lines.length; i++) {
            (function (idx) {
              var l = m.lines[idx];
              if (!l) return;
              var wrap = document.createElement('div');
              wrap.className = 'dshwv-linerow';
              var lr = document.createElement('div');
              lr.className = 'dshwv-audiorow';
              var wt = document.createElement('input');
              wt.type = 'number';
              wt.min = '1';
              wt.max = '99';
              wt.className = 'dshwv-linew';
              wt.value = String(l.w || 1);
              wt.title = '权重';
              wt.addEventListener('input', function () {
                l.w = Math.max(1, Math.round(Number(wt.value) || 1));
              });
              lr.appendChild(wt);
              var tx = document.createElement('input');
              tx.type = 'text';
              tx.className = 'dshwv-linetx';
              tx.value = l.t;
              tx.placeholder = '句子';
              tx.addEventListener('input', function () {
                l.t = tx.value || ' ';
              });
              lr.appendChild(tx);
              var ed = document.createElement('button');
              ed.type = 'button';
              ed.className = 'dshwv-bubmini';
              ed.textContent = '✎';
              ed.title = '该句悬浮样式编辑(句子/字号/字体/颜色/字形)';
              ed.addEventListener('click', function (e) {
                e.stopPropagation();
                openSentence(l, m, tx, ed);
              });
              lr.appendChild(ed);
              var cp = document.createElement('button');
              cp.type = 'button';
              cp.className = 'dshwv-bubmini';
              cp.textContent = '⧉';
              cp.title = '复制该行(含样式)';
              cp.addEventListener('click', function () {
                m.lines.splice(idx + 1, 0, JSON.parse(JSON.stringify(l)));
                renderLines();
              });
              lr.appendChild(cp);
              var del = document.createElement('button');
              del.type = 'button';
              del.className = 'dshwv-linedel';
              del.textContent = '✕';
              del.title = '删除该句';
              del.addEventListener('click', function () {
                m.lines.splice(idx, 1);
                renderLines();
              });
              lr.appendChild(del);
              wrap.appendChild(lr);
              listEl.appendChild(wrap);
            })(i);
          }
        }
        renderLines();
        var addL = document.createElement('button');
        addL.type = 'button';
        addL.className = 'dshwv-addline';
        addL.textContent = '+ 添加语句';
        addL.addEventListener('click', function () {
          m.lines.push({
            t: '新句子',
            w: 1
          });
          renderLines();
        });
        body.appendChild(addL);
      } else if (m.type === 'randimg') {
        if (!Array.isArray(m.imgs)) m.imgs = [];
        var randomImageHint = document.createElement('div'); randomImageHint.className = 'dshwv-bubhint';
        randomImageHint.textContent = '每次打开泡泡时按权重随机抽取一张图片。图片可先在资源管理中导入。'; body.appendChild(randomImageHint);
        var randomImageList = document.createElement('div'); randomImageList.className = 'dshwv-listbox';
        randomImageList.style.maxHeight = '230px'; randomImageList.style.overflowY = 'auto'; body.appendChild(randomImageList);
        function renderRandomImages() {
          randomImageList.innerHTML = '';
          for (var ri = 0; ri < m.imgs.length; ri++) (function (index) {
            var item = m.imgs[index] || (m.imgs[index] = { imgId: '', w: 1 });
            var row = document.createElement('div'); row.className = 'dshwv-audiorow';
            var weight = document.createElement('input'); weight.type = 'number'; weight.min = '1'; weight.max = '99';
            weight.className = 'dshwv-linew'; weight.value = String(item.w || 1); weight.title = '抽取权重';
            weight.addEventListener('input', function () { item.w = Math.max(1, Math.round(Number(weight.value) || 1)); }); row.appendChild(weight);
            var select = document.createElement('select'); select.className = 'dshwv-sound'; select.style.minWidth = '0';
            var empty = document.createElement('option'); empty.value = ''; empty.textContent = '— 选择图片 —'; select.appendChild(empty);
            for (var bi = 0; bi < getImgList().length; bi++) { var option = document.createElement('option'); option.value = getImgList()[bi].id; option.textContent = getImgList()[bi].name; select.appendChild(option); }
            select.value = item.imgId || ''; select.addEventListener('change', function () { item.imgId = select.value; }); row.appendChild(select); enhanceSelect(select);
            var del = document.createElement('button'); del.type = 'button'; del.className = 'dshwv-linedel'; del.textContent = '✕'; del.title = '移除这张图片';
            del.addEventListener('click', function () { m.imgs.splice(index, 1); renderRandomImages(); }); row.appendChild(del);
            randomImageList.appendChild(row);
          })(ri);
        }
        var addRandomImage = document.createElement('button'); addRandomImage.type = 'button'; addRandomImage.className = 'dshwv-addline'; addRandomImage.textContent = '+ 添加图片';
        addRandomImage.addEventListener('click', function () { m.imgs.push({ imgId: getImgList()[0] && getImgList()[0].id || '', w: 1 }); renderRandomImages(); }); body.appendChild(addRandomImage);
        var randomScaleRow = document.createElement('div'); randomScaleRow.className = 'dshwv-audiorow';
        var randomScaleLabel = document.createElement('span'); randomScaleLabel.textContent = '显示大小'; randomScaleRow.appendChild(randomScaleLabel);
        var randomScale = document.createElement('input'); randomScale.type = 'range'; randomScale.min = '10'; randomScale.max = '100'; randomScale.step = '5'; randomScale.className = 'dshwv-cropzoom';
        randomScale.value = String(Math.round(Math.max(.1, Math.min(1, Number(m.imgScale) || 1)) * 100)); randomScaleRow.appendChild(randomScale);
        var randomScaleValue = document.createElement('span'); randomScaleValue.className = 'dshwv-volpct'; randomScaleValue.textContent = randomScale.value + '%'; randomScaleRow.appendChild(randomScaleValue);
        randomScale.addEventListener('input', function () { m.imgScale = Number(randomScale.value) / 100; randomScaleValue.textContent = randomScale.value + '%'; }); body.appendChild(randomScaleRow);
        if (!getImgList().length) loadImgs(renderRandomImages); else renderRandomImages();
      } else if (m.type === 'image') {
        moduleImgSelect = document.createElement('select');
        moduleImgSelect.className = 'dshwv-sound';
        body.appendChild(moduleImgSelect);
        moduleImgDrop = enhanceSelect(moduleImgSelect);
        moduleImgPreviewEl = document.createElement('img');
        moduleImgPreviewEl.className = 'dshwv-bubimgprev';
        moduleImgPreviewEl.alt = '';
        body.appendChild(moduleImgPreviewEl);
        function fillImgSel() {
          moduleImgSelect.innerHTML = '';
          var opt0 = document.createElement('option');
          opt0.value = '';
          opt0.textContent = '— 选择泡泡图库图片 —';
          moduleImgSelect.appendChild(opt0);
          for (var i = 0; i < getImgList().length; i++) {
            var o = document.createElement('option');
            o.value = getImgList()[i].id;
            o.textContent = getImgList()[i].name;
            moduleImgSelect.appendChild(o);
          }
          if (m.imgId) moduleImgSelect.value = m.imgId;
          moduleImgSelect.dispatchEvent(new Event('change'));
          if (moduleImgDrop) moduleImgDrop.refresh();
        }
        moduleImgSelect.addEventListener('change', function () {
          m.imgId = moduleImgSelect.value;
          if (m.imgId) {
            moduleImgPreviewEl.src = '/dsh-whale/bubble-img.png?id=' + encodeURIComponent(m.imgId);
            moduleImgPreviewEl.style.display = 'block';
          } else moduleImgPreviewEl.style.display = 'none';
        });
        var fileInput = document.createElement('input');
        fileInput.type = 'file';
        fileInput.accept = 'image/png,image/gif';
        fileInput.style.display = 'none';
        var upBtn = document.createElement('button');
        upBtn.type = 'button';
        upBtn.className = 'dshwv-snapbtn dshwv-snapbtn-no';
        upBtn.textContent = '上传图片(png/gif)';
        upBtn.addEventListener('click', function () {
          fileInput.click();
        });
        fileInput.addEventListener('change', function () {
          var f = fileInput.files && fileInput.files[0];
          if (!f) return;
          uploadImg(f, function (ok) {
            if (ok) fillImgSel();
            fileInput.value = '';
          });
        });
        body.appendChild(upBtn);
        body.appendChild(fileInput);
        var scRow = document.createElement('div');
        scRow.className = 'dshwv-audiorow';
        var scL = document.createElement('span');
        scL.textContent = '显示大小';
        scRow.appendChild(scL);
        var scInit = Number(m.imgScale);
        if (!isFinite(scInit) || scInit <= 0) scInit = 1;
        var scInp = document.createElement('input');
        scInp.type = 'range';
        scInp.min = '10';
        scInp.max = '100';
        scInp.step = '5';
        scInp.className = 'dshwv-cropzoom';
        scInp.style.flex = '1';
        scInp.value = String(Math.round(scInit * 100));
        scInp.addEventListener('input', function () {
          m.imgScale = Math.max(0.1, Math.min(1, Number(scInp.value) / 100));
          scVal.textContent = scInp.value + '%';
          try {
            if (moduleImgPreviewEl) moduleImgPreviewEl.style.maxWidth = Math.round(120 * m.imgScale) + 'px';
          } catch (err) {}
        });
        scRow.appendChild(scInp);
        var scVal = document.createElement('span');
        scVal.className = 'dshwv-volpct';
        scVal.textContent = scInp.value + '%';
        scRow.appendChild(scVal);
        body.appendChild(scRow);
        try {
          if (moduleImgPreviewEl) moduleImgPreviewEl.style.maxWidth = Math.round(120 * scInit) + 'px';
        } catch (err) {}
        if (!getImgList().length) loadImgs(fillImgSel); else fillImgSel();
      } else {
        {
          var note = document.createElement('div');
          note.className = 'dshwv-bubhint';
          note.textContent = '该模块为内置数值,内容自动获取,可调下方颜色/字号';
          body.appendChild(note);
          moduleTplRow();
        }
      }
      if (m.type !== 'image' && m.type !== 'randimg' && m.type !== 'random') {
        var sec = document.createElement('div');
        sec.className = 'dshwv-bubsec';
        sec.textContent = '样式';
        body.appendChild(sec);
        body.appendChild(fontEditRow(function () {
          return m.fontFamily || '';
        }, function (v) {
          m.fontFamily = v || '';
        }));
        var sizeRow = document.createElement('div');
        sizeRow.className = 'dshwv-audiorow';
        var sl = document.createElement('span');
        sl.textContent = '字号';
        sizeRow.appendChild(sl);
        sizeEl = document.createElement('input');
        sizeEl.type = 'range';
        sizeEl.min = String(FONT_LEVEL_MIN);
        sizeEl.max = String(FONT_LEVEL_MAX);
        sizeEl.step = '1';
        sizeEl.className = 'dshwv-cropzoom';
        sizeEl.value = String(displayLevel(m));
        // 保存时只在滑块真的动过（或是新模块）才换到细档位，没碰字号的旧模块原样保留。
        sizeEl.dataset.initial = sizeEl.value;
        sizeRow.appendChild(sizeEl);
        var sizeNum = document.createElement('span');
        sizeNum.className = 'dshwv-volpct';
        sizeNum.textContent = sizeEl.value;
        sizeEl.addEventListener('input', function () {
          sizeNum.textContent = sizeEl.value;
        });
        sizeRow.appendChild(sizeNum);
        body.appendChild(sizeRow);
        var glyphRow = document.createElement('div');
        glyphRow.className = 'dshwv-audiorow';
        function glyphBox(label, key) {
          var lab = document.createElement('label');
          lab.style.display = 'inline-flex';
          lab.style.alignItems = 'center';
          lab.style.gap = '3px';
          lab.style.marginRight = '10px';
          var cb = document.createElement('input');
          cb.type = 'checkbox';
          cb.checked = !!m[key];
          cb.addEventListener('change', function () {
            m[key] = cb.checked;
          });
          var tx = document.createElement('span');
          tx.textContent = label;
          lab.appendChild(cb);
          lab.appendChild(tx);
          return lab;
        }
        glyphRow.appendChild(glyphBox('加粗', 'bold'));
        glyphRow.appendChild(glyphBox('斜体', 'italic'));
        glyphRow.appendChild(glyphBox('下划线', 'ul'));
        body.appendChild(glyphRow);
        {
          var w3cc = colorSelect(m.rgb ? m.rgb : 'solid', function (v) {
            if (v === 'solid') {
              m.rgb = '';
              if (!m.color) m.color = '#203170';
            } else {
              m.rgb = v;
              m.color = '';
            }
            var mode2 = v === 'solid' ? 'solid' : v;
            w3cc.sync(mode2, m.color, function (hex) {
              m.color = hex;
            });
          });
          body.appendChild(w3cc.row);
          w3cc.sync(m.rgb ? m.rgb : 'solid', m.color || '#203170', function (hex) {
            m.color = hex;
          });
        }
        {
          var bgCur = m.bgRgb ? m.bgRgb : m.bg ? 'solid' : 'none';
          var bgcc = colorSelect(bgCur, function (v) {
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
            bgcc.sync(v === 'none' ? 'none' : v, m.bg, function (hex) {
              m.bg = hex;
            });
          }, {
            label: '底色',
            defaultHex: '#dbe4f5',
            defaultText: '默认',
            allowNone: true
          });
          body.appendChild(bgcc.row);
          bgcc.sync(bgCur, m.bg || '#dbe4f5', function (hex) {
            m.bg = hex;
          });
        }
      }
    }

  return { render, get colorEl() { return colorEl; }, get sizeEl() { return sizeEl; } };
}

// Owns the module dialog, its nested save-as dialog and every event listener.
export function createModuleEditorDialog({ document, view: moduleEditorView, button,
  cleanLayers: whaleZClean, addToLibrary, getPalEl, renderPal, confirm: showConfirm }) {
  var moduleMask, moduleEditRef = null, moduleOnSave = null, moduleEditNew = false;
  var moduleTitleEl, moduleBodyEl;
  function renderModuleEditor() { return moduleEditorView.render(moduleEditRef, moduleEditNew, moduleTitleEl, moduleBodyEl); }
    var moduleNamePromptModule = null;
    function openModuleNamePrompt(m) {
      try {
        moduleNamePromptModule = m || moduleEditRef || null;
        moduleNameInput.value = '';
        openOver(moduleMask, moduleNamePromptMask);
        moduleNamePromptMask.style.display = 'flex';
        setTimeout(function () {
          try {
            moduleNameInput.focus();
          } catch (err) {}
        }, 30);
      } catch (err) {}
    }
    function closeModuleNamePrompt() {
      moduleNamePromptMask.style.display = 'none';
      moduleNamePromptModule = null;
    }
    function saveModuleNamePrompt() {
      var m = moduleNamePromptModule || moduleEditRef;
      if (!m) {
        closeModuleNamePrompt();
        return;
      }
      addToLibrary(moduleNameInput.value, m);
      moduleNameInput.value = '';
      closeModuleNamePrompt();
      if (getPalEl()) renderPal();
    }
    function openModuleEditor(m, onSave, isNew) {
      try {
        whaleZClean();
        moduleEditRef = m;
        moduleOnSave = onSave || null;
        moduleEditNew = !!isNew;
        renderModuleEditor();
        openOver(null, moduleMask);
        moduleMask.style.display = 'flex';
      } catch (err) {}
    }
    function closeModuleEditor(saved) {
      try {
        if (saved && moduleEditRef) {
          if (moduleEditorView.colorEl) moduleEditRef.color = moduleEditorView.colorEl.value === '#203170' && !moduleEditRef.color ? '' : moduleEditorView.colorEl.value;
          var sizeInput = moduleEditorView.sizeEl;
          if (sizeInput && (moduleEditNew || sizeInput.value !== sizeInput.dataset.initial)) setFontLevel(moduleEditRef, sizeInput.value);
          if (moduleEditRef.type === 'image' && !moduleEditRef.imgId) {
            showConfirm('请先选择或上传一张图片', function () {});
            return;
          }
          if (moduleEditRef.type === 'randimg' && !(moduleEditRef.imgs || []).some(function (item) { return item && item.imgId; })) {
            showConfirm('请至少选择一张随机图片', function () {});
            return;
          }
          if (moduleOnSave) moduleOnSave(moduleEditRef);
        }
        moduleMask.style.display = 'none';
        moduleEditRef = null;
        moduleOnSave = null;
        moduleEditNew = false;
      } catch (err) {
        moduleMask.style.display = 'none';
      }
    }
    moduleMask = document.createElement('div');
    moduleMask.className = 'dshwv-bubmask';
    moduleMask.style.display = 'none';
    var moduleCard = document.createElement('div');
    moduleCard.className = 'dshwv-bubcard';
    moduleTitleEl = document.createElement('div');
    moduleTitleEl.className = 'dshwv-bubtitle';
    moduleCard.appendChild(moduleTitleEl);
    moduleBodyEl = document.createElement('div');
    moduleCard.appendChild(moduleBodyEl);
    var moduleBtns = document.createElement('div');
    moduleBtns.className = 'dshwv-bubbtns';
    moduleBtns.appendChild(button('取消', 'dshwv-bubbtn-no', function () {
      closeModuleEditor(false);
    }));
    var saveAsBtn = document.createElement('button');
    saveAsBtn.type = 'button';
    saveAsBtn.className = 'dshwv-bubbtn dshwv-bubbtn-no';
    saveAsBtn.textContent = '另存';
    saveAsBtn.title = '另存为可选模块:把当前模块存入模块库,可在任意泡泡里复用';
    saveAsBtn.addEventListener('click', function (e) {
      e.stopPropagation();
      openModuleNamePrompt(moduleEditRef);
    });
    moduleBtns.appendChild(saveAsBtn);
    moduleBtns.appendChild(button('保存', 'dshwv-bubbtn-ok', function () {
      closeModuleEditor(true);
    }));
    moduleCard.appendChild(moduleBtns);
    moduleMask.appendChild(moduleCard);
    document.body.appendChild(moduleMask);
    var moduleNamePromptMask = document.createElement('div');
    moduleNamePromptMask.className = 'dshwv-confirmmask';
    moduleNamePromptMask.style.display = 'none';
    var moduleNamePromptCard = document.createElement('div');
    moduleNamePromptCard.className = 'dshwv-audiowin';
    var moduleNamePromptTitle = document.createElement('div');
    moduleNamePromptTitle.className = 'dshwv-audiotitle';
    moduleNamePromptTitle.textContent = '存为可选模块';
    moduleNamePromptCard.appendChild(moduleNamePromptTitle);
    var moduleNameInput = document.createElement('input');
    moduleNameInput.type = 'text';
    moduleNameInput.className = 'dshwv-audionameinput';
    moduleNameInput.maxLength = 20;
    moduleNameInput.placeholder = '模块名称(留空自动编号)';
    moduleNamePromptCard.appendChild(moduleNameInput);
    var moduleNameBtns = document.createElement('div');
    moduleNameBtns.className = 'dshwv-cropbtns';
    var moduleNameCancel = document.createElement('button');
    moduleNameCancel.type = 'button';
    moduleNameCancel.className = 'dshwv-cropbtn dshwv-cropbtn-no';
    moduleNameCancel.textContent = '取消';
    moduleNameCancel.addEventListener('click', closeModuleNamePrompt);
    var moduleNameOk = document.createElement('button');
    moduleNameOk.type = 'button';
    moduleNameOk.className = 'dshwv-cropbtn dshwv-cropbtn-ok';
    moduleNameOk.textContent = '保存';
    moduleNameOk.addEventListener('click', saveModuleNamePrompt);
    moduleNameBtns.appendChild(moduleNameCancel);
    moduleNameBtns.appendChild(moduleNameOk);
    moduleNamePromptCard.appendChild(moduleNameBtns);
    moduleNamePromptMask.appendChild(moduleNamePromptCard);
    document.body.appendChild(moduleNamePromptMask);
    moduleNameInput.addEventListener('keydown', function (e) {
      try {
        if (e.key === 'Enter') saveModuleNamePrompt(); else if (e.key === 'Escape') closeModuleNamePrompt();
      } catch (err) {}
    });

  return { mask: moduleMask, open: openModuleEditor, close: closeModuleEditor };
}
