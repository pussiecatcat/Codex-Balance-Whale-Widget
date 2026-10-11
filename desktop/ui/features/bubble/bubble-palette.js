// Palette entries are rendered from current library data and call editor commands.
export function createBubblePalette(deps) {
  const { document, getPaletteElement, getLibrary, setDragKey, bubbleModuleAdd,
    bubbleModuleNew, bubblePickImageToAdd, bubblePaletteModule,
    bubbleCloneModule, bubbleDefaultSecondModules, showConfirm, bubbleLibDel } = deps;
    function renderBubblePal() {
      var bubblePalEl = getPaletteElement();
      var bubbleLib = getLibrary();
      if (!bubblePalEl) return;
      bubblePalEl.innerHTML = '';
      var defs = [{
        key: 'text',
        label: '文本',
        cb: function () { bubbleModuleAdd(bubblePaletteModule('text')); }
      }, {
        key: 'balance',
        label: '余额数值',
        pin: true,
        cb: function () { bubbleModuleAdd(bubblePaletteModule('balance')); }
      }, {
        key: 'today',
        label: '今日已观测',
        pin: true,
        cb: function () { bubbleModuleAdd(bubblePaletteModule('today')); }
      }, {
        key: 'quota5',
        label: '5 小时额度',
        pin: true,
        cb: function () { bubbleModuleAdd(bubblePaletteModule('quota5')); }
      }, {
        key: 'quotaWeek',
        label: '每周额度',
        pin: true,
        cb: function () { bubbleModuleAdd(bubblePaletteModule('quotaWeek')); }
      }, {
        key: 'turn',
        label: '上轮 token',
        pin: true,
        cb: function () { bubbleModuleAdd(bubblePaletteModule('turn')); }
      }, {
        key: 'plan', label: 'Codex 套餐', pin: true,
        cb: function () { bubbleModuleAdd(bubblePaletteModule('plan')); }
      }, {
        key: 'session', label: '当前会话', pin: true,
        cb: function () { bubbleModuleAdd(bubblePaletteModule('session')); }
      }, {
        key: 'peak', label: '峰谷时段', pin: true,
        cb: function () { bubbleModuleAdd(bubblePaletteModule('peak')); }
      }, {
        key: 'random',
        label: '随机语句',
        cb: function () {
          bubbleModuleAdd(bubbleCloneModule(bubbleDefaultSecondModules()[0]));
        }
      }, {
        key: 'link',
        label: '超链接',
        cb: function () {
          bubbleModuleAdd(bubblePaletteModule('link'));
        }
      }, {
        key: 'image',
        label: '图片/动图',
        cb: function () {
          bubblePickImageToAdd();
        }
      }, {
        key: 'randimg',
        label: '随机图片',
        cb: function () {
          bubbleModuleNew(bubblePaletteModule('randimg'));
        }
      }];
      for (var i = 0; i < defs.length; i++) {
        (function (d) {
          var chip = document.createElement('div');
          chip.className = 'dshwv-palchip';
          chip.textContent = d.label;
          chip.title = d.pin ? '自动数据模块（模板和样式均可自定义）' : '点击加入泡泡';
          chip.draggable = true;
          chip.addEventListener('click', function (e) {
            e.stopPropagation();
            d.cb();
          });
          chip.addEventListener('dragstart', function (e) {
            try {
              e.dataTransfer.setData('text/plain', d.key);
            } catch (err) {}
            setDragKey(d.key);
          });
          bubblePalEl.appendChild(chip);
        })(defs[i]);
      }
      for (var li = 0; li < bubbleLib.length; li++) {
        (function (lb) {
          var chip = document.createElement('div');
          chip.className = 'dshwv-libchip';
          chip.title = '从模块库加入: ' + lb.name;
          var body = document.createElement('div');
          body.className = 'dshwv-palchip';
          body.textContent = '▦ ' + lb.name;
          body.draggable = true;
          body.addEventListener('click', function (e) {
            e.stopPropagation();
            bubbleModuleAdd(bubbleCloneModule(lb.module));
          });
          body.addEventListener('dragstart', function (e) {
            try {
              e.dataTransfer.setData('text/plain', 'lib:' + lb.id);
            } catch (err) {}
            setDragKey('lib:' + lb.id);
          });
          chip.appendChild(body);
          var del = document.createElement('button');
          del.type = 'button';
          del.className = 'dshwv-libdel';
          del.textContent = '✕';
          del.title = '从模块库删除: ' + lb.name;
          del.addEventListener('click', function (e) {
            e.stopPropagation();
            showConfirm('从模块库删除「' + lb.name + '」?', function () {
              bubbleLibDel(lb.id);
              if (bubblePalEl) renderBubblePal();
            });
          });
          chip.appendChild(del);
          bubblePalEl.appendChild(chip);
        })(bubbleLib[li]);
      }
      var newChip = document.createElement('div');
      newChip.className = 'dshwv-paladd';
      newChip.textContent = '+ 新建模块';
      newChip.title = '新建模块(先选类型:文本/随机语句/图片动图/随机图片)';
      newChip.draggable = true;
      newChip.addEventListener('click', function (e) {
        e.stopPropagation();
        bubbleModuleWizard();
      });
      newChip.addEventListener('dragstart', function (e) {
        try {
          e.dataTransfer.setData('text/plain', 'wizard');
        } catch (err) {}
        setDragKey('wizard');
      });
      bubblePalEl.appendChild(newChip);
    }
    function bubbleModuleWizard() {
      bubbleModuleAdd(bubblePaletteModule('text'));
    }
  return { render: renderBubblePal };
}
