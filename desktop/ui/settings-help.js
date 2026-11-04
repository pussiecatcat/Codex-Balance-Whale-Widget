// 可复用的圆形 `!` 说明浮层。
//
// 沿用挂件里参考汇率那一行已经验证过的交互（assets/whale-widget.js 的
// .dshwv-fx-info-button / .dshwv-fx-info）：中性色圆形按钮、可聚焦、带
// aria-expanded，Esc / 点击外部 / 窗口尺寸变化时关闭，关闭后焦点回到原按钮。
// 这里把它抽成组件，六个分类里每个字段都能挂。
(() => {
  'use strict';

  let openCard = null;
  let openButton = null;

  function closeHelp(restoreFocus) {
    if (!openCard) return;
    const card = openCard;
    openCard = null;
    if (openButton) openButton.setAttribute('aria-expanded', 'false');
    openButton = null;
    card.remove();
    if (restoreFocus && document.contains(card)) { /* 卡片已移除，焦点交还给调用方记录的原按钮 */ }
  }

  function closeHelpAndRestore() {
    const button = openButton;
    closeHelp(false);
    if (button && document.contains(button)) button.focus();
  }

  function place(card, anchor) {
    const box = anchor.getBoundingClientRect();
    card.style.visibility = 'hidden';
    card.style.left = '0px';
    card.style.top = '0px';
    const size = card.getBoundingClientRect();
    const margin = 8;
    let left = box.right - size.width;
    let top = box.bottom + 6;
    if (left < margin) left = margin;
    if (left + size.width > window.innerWidth - margin) left = Math.max(margin, window.innerWidth - size.width - margin);
    // 下方放不下就翻到按钮上方。
    if (top + size.height > window.innerHeight - margin) top = Math.max(margin, box.top - size.height - 6);
    card.style.left = Math.round(left) + 'px';
    card.style.top = Math.round(top) + 'px';
    card.style.visibility = '';
  }

  const onDocPointerDown = event => {
    if (openCard && event.target instanceof Node && (openCard.contains(event.target) || openButton?.contains(event.target))) return;
    closeHelpAndRestore();
  };
  const onKeyDown = event => { if (event.key === 'Escape' && openCard) { event.preventDefault(); closeHelpAndRestore(); } };
  const onReflow = () => { if (openCard && openButton) place(openCard, openButton); };

  document.addEventListener('pointerdown', onDocPointerDown, true);
  document.addEventListener('keydown', onKeyDown, true);
  window.addEventListener('resize', onReflow);
  window.addEventListener('scroll', onReflow, true);

  function buildCard(field) {
    const card = document.createElement('div');
    card.className = 'set-help';
    card.setAttribute('role', 'region');
    card.tabIndex = -1;
    const heading = document.createElement('div');
    heading.className = 'set-help-title';
    heading.textContent = field.label;
    card.append(heading);
    const add = (name, text) => {
      if (!text) return;
      const row = document.createElement('p');
      row.className = 'set-help-row';
      const tag = document.createElement('strong');
      tag.textContent = name;
      row.append(tag, document.createTextNode(text));
      card.append(row);
    };
    add('有什么用', field.help.use);
    add('怎么调', field.help.adjust);
    add('什么时候生效', field.help.apply);
    add('适合怎么选', field.help.recommend);
    if (field.help.example) add('例子', field.help.example);
    if (Array.isArray(field.subFields) && field.subFields.length) {
      const list = document.createElement('ul');
      list.className = 'set-help-list';
      for (const sub of field.subFields) {
        const item = document.createElement('li');
        item.textContent = sub.label + '（' + sub.key + '）';
        list.append(item);
      }
      card.append(list);
    }
    return card;
  }

  /**
   * 给一个控件挂上说明按钮。
   * @param {HTMLElement} anchor 控件容器，`!` 追加在它最后
   * @param {object} field 设置目录里的字段
   */
  function attach(anchor, field) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'set-help-button';
    button.textContent = '!';
    button.setAttribute('aria-label', '查看「' + field.label + '」的说明');
    button.setAttribute('aria-expanded', 'false');
    button.addEventListener('click', event => {
      event.preventDefault();
      event.stopPropagation();
      if (openCard && openButton === button) { closeHelpAndRestore(); return; }
      closeHelp(false);
      const card = buildCard(field);
      document.body.append(card);
      place(card, button);
      openCard = card;
      openButton = button;
      button.setAttribute('aria-expanded', 'true');
      card.focus();
    });
    // 方案要求「右侧控件与 !」，所以说明按钮排在控件之后。
    anchor.append(button);
    return button;
  }

  window.WhaleSettingsHelp = { attach, close: closeHelpAndRestore };
})();
