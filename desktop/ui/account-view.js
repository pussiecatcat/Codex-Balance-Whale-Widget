(() => {
  'use strict';
  const validMode = value => value === 'api' || value === 'subscription';
  const number = value => typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null;
  function windowText(item) {
    const used = number(item.usedPercent);
    return used === null ? '额度比例未知' : `已用 ${used.toFixed(1)}% · 剩余 ${Math.max(0, 100 - used).toFixed(1)}%${item.stale ? '（快照已过期）' : ''}`;
  }
  function tokenText(value) { const n = number(value); return n === null ? '暂无记录' : n.toLocaleString() + ' token'; }
  function quotaLabel(item) { return item.windowDurationMins === 300 ? '5 小时额度' : item.windowDurationMins === 10080 ? '每周额度' : item.label || '额度窗口'; }
  function noticeText(value) {
    if (!value || value.notify === false) return '';
    if (value.failureKind === 'high-demand') return '挤不进去...';
    return number(value.tokens) === null ? '本轮 token 暂无记录' : '本轮本机已观测：' + tokenText(value.tokens);
  }
  if (typeof module !== 'undefined' && module.exports) module.exports = { validMode, windowText, tokenText, noticeText, quotaLabel };
  if (typeof window === 'undefined' || typeof document === 'undefined') return;
  const key = 'dshw-account-view';
  let mode = 'subscription', card = null, content = null, root = null, generation = 0, switching = false, latestNotice = null;
  let modeButtons = [], modeSelect = null, status = null, modeRevision = 0;
  try { const saved = localStorage.getItem(key); if (validMode(saved)) mode = saved; } catch {}
  function text(parent, tag, value) { const el = document.createElement(tag); el.textContent = value; parent.append(el); return el; }
  function date(value) { if (!value) return '未知'; const d = new Date(typeof value === 'number' && value < 1e12 ? value * 1000 : value); return Number.isFinite(d.getTime()) ? d.toLocaleString() : '未知'; }
  function close() { generation++; card?.remove(); card = content = null; }
  function position() {
    if (!card) return;
    const anchor = (root || document).querySelector('.dshwv-img') || document.querySelector('.dshwv-img');
    if (!anchor) return;
    const bounds = anchor.getBoundingClientRect(), width = card.offsetWidth || 280, height = card.offsetHeight || 220;
    const left = Math.max(8, Math.min(window.innerWidth - width - 8, bounds.right - width)) + 'px';
    const top = Math.max(8, Math.min(window.innerHeight - height - 8, bounds.top - height - 10 >= 8 ? bounds.top - height - 10 : bounds.bottom + 10)) + 'px';
    if(card.style.left!==left)card.style.left=left;
    if(card.style.top!==top)card.style.top=top;
  }
  function updateButtons() { for (const button of modeButtons) { button.disabled = switching; button.setAttribute('aria-pressed', String(button.dataset.mode === mode)); }
    if (modeSelect) { modeSelect.disabled = switching; modeSelect.value = mode; }
    for(const el of document.querySelectorAll('[data-account-api]'))el.hidden=mode==='subscription';
    document.documentElement.dataset.accountMode = mode;
    for (const el of document.querySelectorAll('.whale-mode-description')) el.textContent = mode === 'subscription' ? '查看 5 小时 / 周额度与本机 token 用量' : '查看当前 API 余额与消费记录';
    for (const el of document.querySelectorAll('.whale-mode-open')) el.textContent = mode === 'subscription' ? '查看订阅额度 →' : '配置 API 余额 →';
  }
  function followCard(ownCard) {
    if (card !== ownCard) return;
    position(); window.requestAnimationFrame(() => followCard(ownCard));
  }
  function commit(next) {
    mode = next; try { localStorage.setItem(key, mode); } catch {}
    close(); latestNotice = null; updateButtons();
    window.dispatchEvent(new CustomEvent('whale-account-view', { detail: { mode } }));
  }
  async function setMode(next) {
    if (!validMode(next) || switching) return false;
    modeRevision++; switching = true; updateButtons(); if (status) status.textContent = '正在保存…';
    try {
      const response = await fetch('/api/display-mode', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ mode: next }) });
      if (!response.ok) throw Error('切换失败，请重试');
      const result = await response.json();
      if (result.ok === false || (result.mode || result.displayMode) !== next) throw Error('模式未保存，请重试');
      commit(next); if (status) status.textContent = next === 'subscription' ? '已切换。点击下方按钮查看额度。' : '已切换为 API 余额模式。'; return true;
    } catch (e) { if (status) status.textContent = e.message || '切换失败，请重试'; return false; }
    finally { switching = false; updateButtons(); }
  }
  async function refresh(force = false) {
    if (mode !== 'subscription' || !card) return;
    const own = ++generation, ownContent = content;
    if (!ownContent) return;
    ownContent.replaceChildren(); text(ownContent, 'p', '正在读取订阅快照…'); position();
    try {
      const response = await fetch('/api/insights' + (force ? '?refresh=1' : ''), { cache: 'no-store' }); if (!response.ok) throw Error('暂时无法读取订阅快照');
      const data = await response.json(); if (own !== generation || !card || content !== ownContent) return;
      ownContent.replaceChildren(); const sub = data.subscription || {};
      if (!sub.available) text(ownContent, 'p', sub.reason || '暂无可用订阅额度快照。使用订阅账号完成 Codex 请求后刷新。');
      else {
        if (!(sub.windows || []).length) text(ownContent, 'p', '暂无可用额度窗口');
        for (const item of sub.windows || []) {
          const section = text(ownContent, 'section', ''); text(section, 'strong', quotaLabel(item)); text(section, 'p', windowText(item));
          const used = number(item.usedPercent);
          if (used !== null) { const meter = document.createElement('progress'); meter.max = 100; meter.value = Math.min(100, used); meter.setAttribute('aria-label', item.label || '已用额度'); section.append(meter); }
          text(section, 'small', '重置：' + date(item.resetsAt));
        }
      }
      const tokens = sub.tokens || data.tokens || {};
      text(ownContent, 'p', '本机近 7 天：' + tokenText(tokens.total)); text(ownContent, 'p', '本机滚动 5 小时：' + tokenText(tokens.last5Hours));
      if (tokens.complete === false) text(ownContent, 'small', '扫描尚不完整，仅显示部分记录。');
      text(ownContent, 'small', 'token 是本机观测，非官方订阅剩余额度；不包含其他设备，不能用百分比换算剩余 token。');
      const notice = noticeText(latestNotice); if (notice) text(ownContent, 'p', notice); position();
    } catch (e) { if (own === generation && content === ownContent) { ownContent.replaceChildren(); text(ownContent, 'p', e.message || '读取失败，请稍后重试'); position(); } }
  }
  function toggleBubble(anchorRoot) {
    if (mode !== 'subscription') return false;
    if (card) { close(); return true; }
    root = anchorRoot?.querySelector ? anchorRoot : document;
    card = document.createElement('section'); card.className = 'whale-account-card'; card.setAttribute('aria-label', '会员订阅额度');
    const header = text(card, 'div', ''); header.className = 'whale-account-header'; text(header, 'strong', '会员订阅额度');
    const closeButton = text(header, 'button', '关闭'); closeButton.onclick = close;
    content = text(card, 'div', ''); const refreshButton = text(card, 'button', '刷新'); refreshButton.onclick = () => refresh(true);
    document.body.append(card); followCard(card); refresh(false); return true;
  }
  function notice(value) {
    if (mode !== 'subscription') return;
    latestNotice = value;
    const message = noticeText(value);
    if (message) window.whaleToast?.(message);
    if (card) refresh(false);
  }
  function init() {
    const style = document.createElement('style'); style.textContent = `.whale-account-card{position:fixed;z-index:2147483646;width:280px;max-width:calc(100vw - 16px);max-height:calc(100vh - 16px);overflow:auto;box-sizing:border-box;padding:14px;border:1px solid #9fcbd5;border-radius:12px;background:#f6fdff;color:#173d48;box-shadow:0 8px 26px #163f4433;font:13px/1.5 system-ui;pointer-events:auto}.whale-account-card p{margin:8px 0}.whale-account-card small{display:block;color:#496873}.whale-account-card progress{width:100%;accent-color:#258b9c}.whale-account-header{display:flex;justify-content:space-between;align-items:center}.whale-account-switch{border-top:1px solid rgba(32,49,112,.2);padding-top:6px;margin-top:6px!important}.whale-account-switch>span{color:#203170;font-size:12px;flex:0 0 auto}.whale-account-switch select{flex:1;min-width:0;margin:0;padding:3px 4px}`; document.head.append(style);
    const menu = document.querySelector('.dshwv-menu');
    if (menu) {
      const view = menu.querySelector('.dshwv-menuview');
      if (view) {
        const row = text(view, 'div', ''); row.className = 'dshwv-menu-row whale-account-switch';
        text(row, 'span', '数据显示');
        modeSelect = document.createElement('select'); modeSelect.className = 'dshwv-sound'; modeSelect.setAttribute('aria-label', '数据显示');
        for (const [value, label] of [['subscription', 'Codex 额度'], ['api', 'API 余额']]) { const option = document.createElement('option'); option.value = value; option.textContent = label; modeSelect.append(option); }
        modeSelect.addEventListener('change', () => setMode(modeSelect.value)); row.append(modeSelect);
        status = document.createElement('span'); status.hidden = true; status.setAttribute('role', 'status'); row.append(status); updateButtons();
      }
    }
    const initialRevision = modeRevision;
    fetch('/api/display-mode', { cache: 'no-store' }).then(async response => { if (!response.ok) return; const data = await response.json(); const next = data.mode || data.displayMode; if (validMode(next) && !switching && modeRevision === initialRevision) commit(next); }).catch(() => {});
    window.addEventListener('resize', position);
    window.addEventListener('whale-mode-changing', close);
  }
  window.WhaleAccountView = { get mode() { return mode; }, toggleBubble, refresh, notice, close, setMode, quotaLabel };
  // Deferred scripts run at readyState=interactive before the widget creates its menu.
  if (document.readyState !== 'complete') document.addEventListener('DOMContentLoaded', init, { once: true }); else init();
})();
