import { requestJson } from '/services/request.js';
import { statusForError, statusView } from '/shared/status-tones.js';

(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  let toastTimer;
  const privateFields = ['baseUrl', 'keyEnv', 'profile', 'projectDir', 'dashboardUrl', 'balancePath', 'balanceField', 'usedField'];
  const resetFields = new Set();
  function toast(message) {
    const node = $('toast');
    if (!node) return;
    node.textContent = message;
    node.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      const current = $('toast');
      if (current) current.hidden = true;
    }, 6000);
  }
  window.whaleToast = toast;
  async function api(url, method = 'GET', body, options = {}) {
    return requestJson(url, { method, body, ...options });
  }
  const form = $('settings-form');
  const settingsDialog = $('settings-dialog');
  let dialogOpener = null, settingsDirty = false;
  const element = name => form.elements.namedItem(name);
  for (const key of privateFields) {
    const input = element(key), reset = document.createElement('button');
    input.autocomplete = 'off'; input.spellcheck = false;
    reset.type = 'button'; reset.className = 'private-reset'; reset.textContent = '恢复默认';
    reset.dataset.resetField = key;
    reset.setAttribute('aria-label', '恢复' + input.closest('label').firstChild.textContent.trim() + '默认值');
    reset.addEventListener('click', () => {
      resetFields.add(key); input.value = ''; input.placeholder = '保存后恢复默认'; input.focus();
    });
    input.addEventListener('input', () => { if (input.value.trim()) resetFields.delete(key); });
    input.insertAdjacentElement('afterend', reset);
  }
  async function openSettings() {
    dialogOpener = document.activeElement;
    try {
      const info = await api('/api/config'), settings = info.settings;
      settingsDirty = false;
      $('settings-discard').hidden = true;
      resetFields.clear();
      for (const key of ['provider', 'currency', 'balanceScale', 'billingUsageDivisor', 'quotaPerUnit']) element(key).value = settings[key] ?? '';
      for (const key of privateFields) {
        element(key).value = '';
        element(key).placeholder = info.configured?.[key] ? '已配置（内容隐藏）；留空保持不变' : '留空保持默认；填写新值可修改';
      }
      element('monitorSessions').checked = settings.monitorSessions;
      for (const key of ['priceModel', 'priceInput', 'priceCached', 'priceOutput', 'priceWrite']) element(key).value = '';
      element('removePrice').checked = false;
      const configured = info.configured || {};
      const hasAuto = !!(configured.baseUrl || configured.keyEnv || configured.profile || configured.projectDir);
      autoStatus.textContent = hasAuto ? (info.warning ? '已配置（已从备份恢复）' : '已配置') : '未配置';
      autoStatus.className = 'provider-status ' + (hasAuto ? 'is-ok' : '');
      autoStatus.title = info.warning || '';
      connectionResult.textContent = '';
      connectionResult.className = '';
      $('test-api-connection').disabled = false;
      $('settings-error').hidden = true; settingsDialog.showModal();
    } catch (error) { toast(error.message); }
  }
  function closeSettings() {
    if (settingsDialog.open) settingsDialog.close();
    if (dialogOpener && dialogOpener.isConnected) dialogOpener.focus();
  }
  function requestCloseSettings() {
    if (!settingsDirty) { closeSettings(); return; }
    $('settings-discard').hidden = false;
    $('keep-editing').focus();
  }
  window.addEventListener('whale-open-settings', openSettings);
  for (const id of ['close-settings', 'cancel-settings']) $(id).addEventListener('click', requestCloseSettings);
  settingsDialog.addEventListener('cancel', event => { event.preventDefault(); requestCloseSettings(); });
  form.addEventListener('input', () => { settingsDirty = true; $('settings-discard').hidden = true; });
  form.addEventListener('change', () => { settingsDirty = true; $('settings-discard').hidden = true; });
  $('discard-settings').addEventListener('click', () => { settingsDirty = false; closeSettings(); });
  $('keep-editing').addEventListener('click', () => {
    $('settings-discard').hidden = true;
    const field = form.querySelector('input:not([type=hidden]),select');
    if (field) field.focus();
  });
  function collectSettings() {
    const settings = {};
    for (const key of ['provider', 'currency']) settings[key] = element(key).value.trim();
    for (const key of privateFields) {
      const value = element(key).value.trim();
      if (value) settings[key] = value;
      else if (resetFields.has(key)) settings[key] = key === 'balanceField' ? 'data.balance' : '';
    }
    for (const key of ['balanceScale', 'billingUsageDivisor', 'quotaPerUnit']) settings[key] = Number(element(key).value);
    settings.monitorSessions = element('monitorSessions').checked;
    const fields = ['priceInput', 'priceCached', 'priceOutput'];
    const hasPrice = [...fields, 'priceWrite'].some(key => element(key).value !== '');
    const model = element('priceModel').value.trim();
    if (element('removePrice').checked) {
      if (!model || hasPrice) throw new Error('删除价格时请只填写模型名称，不填写价格');
      settings.pricingUpdate = { model, prices: null };
    } else if (hasPrice) {
      if (!model || fields.some(key => element(key).value === '')) throw new Error('请完整填写模型名称、输入、缓存命中和输出价格');
      const prices = { input: Number(element('priceInput').value), cachedInput: Number(element('priceCached').value), output: Number(element('priceOutput').value) };
      if (element('priceWrite').value !== '') prices.cacheWrite = Number(element('priceWrite').value);
      settings.pricingUpdate = { model, prices };
    } else if (model) throw new Error('请填写完整价格，或选择删除该模型价格');
    return settings;
  }
  form.addEventListener('submit', async event => {
    event.preventDefault();
    try {
      await api('/api/config', 'PUT', collectSettings());
      location.reload();
    } catch (error) { $('settings-error').hidden = false; $('settings-error').textContent = error.message; }
  });
  // Guided setup: probe the draft and ask for a real balance in one click, so
  // a wrong endpoint or a missing environment variable is named here instead
  // of showing up later as an unexplained "查询暂不可用" on the widget.
  const connectionResult = $('api-connection-result');
  const autoStatus = $('provider-auto-status');
  async function probeSettings() {
    const result = await api('/api/config/probe', 'POST', collectSettings(), { timeoutMs: 20000 });
    if (result.stale) {
      const at = result.updatedAt ? new Date(result.updatedAt).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }) : '';
      throw new Error((result.error || '服务商暂时不可用') + (at ? `（当前显示的是 ${at} 的上次数据）` : '（当前显示的是上次数据）'));
    }
    if (!result.ok) throw new Error(result.error || '余额接口没有返回可用的余额');
    return result;
  }
  function connectionSummary(result) {
    const label = result.balanceLabel || result.providerName || '当前 API';
    const amount = typeof result.totalBalance === 'number' ? ` · ${result.totalBalance} ${result.currency || ''}`.trimEnd() : '';
    return `${label}${amount}`;
  }
  $('auto-api-edit').addEventListener('click', () => {
    const group = $('current-api-settings');
    if (group) group.open = true;
    element('baseUrl').focus();
  });
  $('auto-api-test').addEventListener('click', async () => {
    const button = $('auto-api-test');
    button.disabled = true;
    autoStatus.className = 'provider-status';
    autoStatus.textContent = '正在测试…';
    try {
      const result = await probeSettings();
      autoStatus.textContent = '已连接 · ' + connectionSummary(result);
      autoStatus.className = 'provider-status is-ok';
    } catch (error) {
      const view = statusView(statusForError(error));
      autoStatus.textContent = '连接失败：' + (error.message || view.label) + (view.action ? '。' + view.action : '');
      autoStatus.className = 'provider-status is-error';
    } finally { button.disabled = false; }
  });
  $('restart-whale').addEventListener('click', async () => {
    if (!window.whaleDesktop || typeof window.whaleDesktop.command !== 'function') {
      toast('请在桌面挂件中重新启动，或手动退出后重新打开。');
      return;
    }
    try {
      const restarted = await window.whaleDesktop.command('restart');
      if (restarted === false) toast('无法自动重新启动，请手动退出后重新打开。');
    } catch { toast('无法自动重新启动，请手动退出后重新打开。'); }
  });
  $('test-api-connection').addEventListener('click', async () => {
    const button = $('test-api-connection');
    button.disabled = true;
    connectionResult.className = '';
    connectionResult.textContent = '正在测试连接…';
    try {
      // Probe the draft rather than saving it first. Cancelling the dialog
      // after a test must leave providers.json byte-for-byte unchanged.
      const result = await probeSettings();
      connectionResult.textContent = `连接成功：${connectionSummary(result)}（尚未保存）`;
      connectionResult.className = 'is-ok';
    } catch (error) {
      const view = statusView(statusForError(error));
      connectionResult.textContent = '连接失败：' + (error.message || view.label) + (view.action ? '。' + view.action : '');
      connectionResult.className = 'is-error';
    } finally { button.disabled = false; }
  });
})();
