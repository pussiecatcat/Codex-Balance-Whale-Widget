// Reference rate menu controls and their currency display subscription.
export function createFxControls(deps) {
  const { document, window, WhaleMoney, currencyNote, fxInfoBtn, fxRefreshBtn,
    currencySel, currencyDrop, dshwCustSelClose, closeRolePanel,
    closeAudioGroupPanel, assetNotice } = deps;
    function closeFxInfo(restoreFocus) {
      if (!currencyNote || currencyNote.hidden) return;
      currencyNote.hidden = true; fxInfoBtn.setAttribute('aria-expanded', 'false');
      if (restoreFocus) fxInfoBtn.focus({ preventScroll: true });
    }
    function positionFxInfo() {
      if (currencyNote.hidden) return;
      var anchor = fxInfoBtn.getBoundingClientRect(), width = currencyNote.offsetWidth, height = currencyNote.offsetHeight;
      var left = Math.max(8, Math.min(anchor.right - width, window.innerWidth - width - 8));
      var below = anchor.bottom + 7, above = anchor.top - height - 7;
      var top = below + height <= window.innerHeight - 8 ? below : Math.max(8, above);
      currencyNote.style.left = left + 'px';
      currencyNote.style.top = Math.max(8, Math.min(top, window.innerHeight - height - 8)) + 'px';
    }
    fxInfoBtn.addEventListener('click', function (e) {
      e.stopPropagation();
      if (!currencyNote.hidden) { closeFxInfo(true); return; }
      dshwCustSelClose(); closeRolePanel(); closeAudioGroupPanel();
      currencyNote.hidden = false; fxInfoBtn.setAttribute('aria-expanded', 'true');
      positionFxInfo(); currencyNote.focus({ preventScroll: true });
    });
    document.addEventListener('pointerdown', function (e) {
      if (!currencyNote.hidden && !currencyNote.contains(e.target) && !fxInfoBtn.contains(e.target)) closeFxInfo();
    }, true);
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && !currencyNote.hidden) { e.preventDefault(); e.stopPropagation(); closeFxInfo(true); }
    }, true);
    window.addEventListener('resize', function () { closeFxInfo(); });
    function fxTime(value) {
      var date = new Date(value);
      return value && isFinite(date.getTime()) ? date.toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai', hour12: false }) : '尚未成功获取';
    }
    function updateFxButton() {
      var moneyState = WhaleMoney.state();
      var seconds = Math.ceil((moneyState.cooldownRemainingMs || 0) / 1000);
      fxRefreshBtn.disabled = !!moneyState.refreshing || seconds > 0;
      fxRefreshBtn.textContent = moneyState.refreshing ? '检查中…' : seconds > 0 ? seconds + ' 秒后刷新' : '刷新汇率';
    }
    fxRefreshBtn.addEventListener('click', function (e) {
      e.stopPropagation();
      WhaleMoney.refreshQuote({ force: true, apply: true, reason: 'manual' }).then(function (ok) {
        assetNotice(ok ? '参考汇率已检查，金额显示已同步' : '本次汇率检查未成功，继续使用可用汇率');
      }).catch(function (error) { assetNotice(error.message); });
      updateFxButton();
    });
    var refreshTimer = setInterval(updateFxButton, 1000);
    var stopMoneyUpdates = WhaleMoney.onChange(function (moneyState) {
      currencySel.value = moneyState.displayCurrency;
      currencySel.disabled = ['USD', 'CNY'].indexOf(moneyState.nativeCurrency) < 0;
      currencyDrop.refresh();
      var fx = moneyState.quote;
      var latest = moneyState.latestQuote || fx;
      currencyNote.textContent = (fx ? '1 美元 = ' + fx.usdCny + ' 人民币\nFrankfurter · 汇率日期 ' + fx.date : '正在获取参考汇率…') +
        (latest && latest.stale ? ' · 离线缓存' : '') +
        '\n最近成功获取：' + fxTime(latest && latest.retrievedAt) +
        '\n最近检查：' + fxTime(moneyState.checkedAt) + '（北京时间）' +
        '\n每天 00:15 检查；休市日可能沿用上个交易日' +
        (moneyState.hasPendingQuote ? '\n新汇率已就绪，下次打开或切换气泡时应用' : '') +
        (moneyState.error ? '\n' + moneyState.error : '');
      currencyNote.title = latest ? (latest.source || 'Frankfurter') + '；API 原始金额和记账币种不变。手动刷新立即应用，自动刷新保留当前气泡快照。' : '';
      updateFxButton();
      positionFxInfo();
    });
    currencySel.addEventListener('change', function () {
      var next = currencySel.value;
      currencySel.value = WhaleMoney.state().displayCurrency;
      currencyDrop.refresh();
      WhaleMoney.setDisplayCurrency(next).catch(function () {});
    });
  function dispose() { clearInterval(refreshTimer); stopMoneyUpdates(); }
  window.addEventListener('beforeunload', dispose, { once: true });
  return { close: closeFxInfo, dispose };
}
