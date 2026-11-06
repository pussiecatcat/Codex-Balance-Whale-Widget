import { requestJson } from '/services/request.js';

(() => {
  'use strict';
  function text(parent, tag, value) { const el = document.createElement(tag); el.textContent = value; parent.append(el); return el; }
  function time(value) { if (!value) return '未知'; const d = new Date(typeof value === 'number' && value < 1e12 ? value * 1000 : value); return Number.isFinite(d.getTime()) ? d.toLocaleString() : '未知'; }
  function open() {
    if (window.WhaleAccountView?.mode === 'subscription') return;
    const dialog = document.createElement('dialog'); dialog.className = 'whale-v3-dialog';
    text(dialog, 'h2', 'DeepSeek 峰谷'); const content = document.createElement('div'); dialog.append(content);
    const actions = document.createElement('div'); actions.className = 'dialog-actions'; const refresh = text(actions, 'button', '刷新'), close = text(actions, 'button', '关闭'); dialog.append(actions);
    let generation = 0;
    async function load() {
      const own = ++generation; refresh.disabled = true; content.replaceChildren(); text(content, 'p', '正在读取…');
      try {
        const data = await requestJson('/api/insights');
        if (own !== generation || !dialog.isConnected) return; content.replaceChildren();
        const p=data.pricing||{};
        if(p.visible){text(content,'p',p.phase==='peak'?'当前为高峰期':p.phase==='off-peak'?'当前为谷期':'规则待更新');text(content,'p','下次切换：'+time(p.nextChangeAt));text(content,'p',p.note||'');}
        else text(content,'p','当前 API 没有适用的峰谷时段。');
      } catch (error) { if (own === generation) { content.replaceChildren(); text(content, 'p', error.message || '读取失败，请稍后重试'); } }
      finally { if (own === generation) refresh.disabled = false; }
    }
    refresh.onclick = load; close.onclick = () => dialog.close(); dialog.onclose = () => { generation++; dialog.remove(); }; document.body.append(dialog); dialog.showModal(); load();
  }
  window.addEventListener('whale-open-insights', open);
})();
