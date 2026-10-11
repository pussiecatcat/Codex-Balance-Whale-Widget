(() => {
  'use strict';
  function text(parent, tag, value) { const el = document.createElement(tag); el.textContent = value; parent.append(el); return el; }
  function time(value) { if (!value) return '未知'; const d = new Date(typeof value === 'number' && value < 1e12 ? value * 1000 : value); return Number.isFinite(d.getTime()) ? d.toLocaleString() : '未知'; }
  function switchDesktop(command) {
    const expected=command==='desktop'?'standalone':'follow-codex';
    return new Promise((resolve,reject)=>{
      const clean=()=>{clearTimeout(timer);window.removeEventListener('whale-desktop-mode',done);};
      const done=e=>{if(e.detail===expected){clean();requestAnimationFrame(()=>requestAnimationFrame(resolve));}};
      const timer=setTimeout(()=>{clean();reject(Error('切换尚未完成，请稍后重试或查看运行状态'));},8000);
      window.addEventListener('whale-desktop-mode',done);
      window.dispatchEvent(new Event('whale-mode-changing'));
      Promise.resolve(window.whaleDesktop.command(command)).then(result=>{if(result===false||result?.ok===false){clean();reject(Error('切换未完成'));}},e=>{clean();reject(e);});
    });
  }
  function open() {
    if (window.WhaleAccountView?.mode === 'subscription') return;
    const dialog = document.createElement('dialog'); dialog.className = 'whale-v3-dialog';
    text(dialog, 'h2', 'DeepSeek 峰谷'); const content = document.createElement('div'); dialog.append(content);
    const actions = document.createElement('div'); actions.className = 'dialog-actions'; const refresh = text(actions, 'button', '刷新'), close = text(actions, 'button', '关闭'); dialog.append(actions);
    let generation = 0;
    async function load() {
      const own = ++generation; refresh.disabled = true; content.replaceChildren(); text(content, 'p', '正在读取…');
      try {
        const response = await fetch('/api/insights', { cache: 'no-store' }); if (!response.ok) throw Error('暂时无法读取额度'); const data = await response.json();
        if (own !== generation || !dialog.isConnected) return; content.replaceChildren();
        const p=data.pricing||{};
        if(p.visible){text(content,'p',p.phase==='peak'?'当前为高峰期':p.phase==='off-peak'?'当前为谷期':'规则待更新');text(content,'p','下次切换：'+time(p.nextChangeAt));text(content,'p',p.note||'');}
        else text(content,'p','当前 API 没有适用的峰谷时段。');
      } catch (error) { if (own === generation) { content.replaceChildren(); text(content, 'p', error.message || '读取失败，请稍后重试'); } }
      finally { if (own === generation) refresh.disabled = false; }
    }
    refresh.onclick = load; close.onclick = () => dialog.close(); dialog.onclose = () => { generation++; dialog.remove(); }; document.body.append(dialog); dialog.showModal(); load();
  }
  const menu = document.querySelector('.dshwv-menu');
  if (menu) {
    const container = menu.querySelector('.dshwv-menu-root') || menu.firstElementChild || menu;
    const row = document.createElement('div'); row.className = 'dshwv-menu-row';
    const insights = text(row, 'button', '峰谷时段'); insights.className = 'dshwv-sound';
    insights.onclick = open; container.append(row);
    const accountModeChanged=async()=>{
      const member=window.WhaleAccountView?.mode==='subscription';insights.hidden=true;row.hidden=true;
      if(!member){try{const p=await fetch('/api/pricing').then(r=>r.json());if(window.WhaleAccountView?.mode!=='subscription'){insights.hidden=!p.visible;row.hidden=!p.visible;}}catch{}}
    };
    accountModeChanged(); window.addEventListener('whale-account-view',accountModeChanged);setInterval(accountModeChanged,60000);
    if (window.whaleDesktop?.command) {
      const modeRow = document.createElement('div'); modeRow.className = 'dshwv-menu-row whale-mode-row whale-utility-row';
      const button = text(modeRow, 'button', '桌面驻留'); button.className = 'dshwv-sound whale-mode-button';
      let currentMode = 'follow-codex';
      const paintMode = mode => {currentMode=mode==='standalone'?'standalone':'follow-codex';button.textContent=currentMode==='standalone'?'窗口随行':'桌面驻留';button.title=currentMode==='standalone'?'让桌宠随 Codex 窗口移动':'让桌宠在 Codex 隐藏后仍驻留桌面';};
      button.onclick = async () => {const command=currentMode==='standalone'?'follow':'desktop';button.disabled=true;try{await switchDesktop(command);window.whaleToast?.(command==='desktop'?'已切换为桌面驻留':'已切换为窗口随行');}catch(e){window.whaleToast?.(e.message);}finally{button.disabled=false;}};
      window.addEventListener('whale-desktop-mode',event=>paintMode(event.detail));
      Promise.resolve(window.whaleDesktop.command('mode')).then(paintMode).catch(()=>{});
      container.append(modeRow);
    }
  }
  window.addEventListener('whale-open-insights', open);
})();
