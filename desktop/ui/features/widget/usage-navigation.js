// Sliding menu navigation owns its timers and open state.
export function createUsageNavigation(deps) {
  const { window, menuBox, menuRootView, usageArea, usagePanel, usageRecBtn,
    renderUsagePanel } = deps;
    var usagePanelOpen = false;
    var usageRefreshTimer = null;
    function toggleUsagePanel() {
      if (usagePanelOpen) {
        hideUsageSub();
        return;
      }
      showUsageSub();
    }
    var usageHideTimer = null;
    var usageShowTimer = null;
    function setUsageNavBtn(inUsage) {
      try {
        usageRecBtn.textContent = inUsage ? '‹ 返回' : '- = 小龙娘记账 = -';
        usageRecBtn.title = inUsage ? '返回' : '打开小龙娘记账';
      } catch (err) {}
    }
    function showUsageSub() {
      try {
        if (usageHideTimer) {
          clearTimeout(usageHideTimer);
          usageHideTimer = null;
        }
      } catch (err) {}
      usagePanelOpen = true;
      var w0 = 300;
      var h0 = 360;
      try {
        var mb = menuBox.getBoundingClientRect();
        if (mb.width > 0) w0 = Math.round(mb.width);
        if (mb.height > 0) h0 = Math.round(mb.height);
      } catch (err) {}
      menuBox.classList.add('dshwv-ledger-open');
      menuBox.style.width = w0 + 'px';
      menuBox.style.maxWidth = w0 + 'px';
      menuBox.style.height = h0 + 'px';
      menuBox.style.overflow = 'hidden';
      menuBox.style.display = 'flex';
      menuBox.style.flexDirection = 'column';
      try {
        if (menuRootView && usageArea) {
          if (menuRootView.parentNode !== usageArea) usageArea.appendChild(menuRootView);
        }
      } catch (err) {}
      usageArea.style.display = 'block';
      usagePanel.style.display = 'block';
      usagePanel.style.position = 'absolute';
      usagePanel.style.top = '0';
      usagePanel.style.left = '0';
      usagePanel.style.width = '100%';
      usagePanel.style.height = '100%';
      usagePanel.style.maxHeight = 'none';
      usagePanel.style.overflowY = 'auto';
      usagePanel.style.overscrollBehavior = 'contain';
      usagePanel.scrollTop = 0;
      usagePanel.style.zIndex = '1';
      usagePanel.style.transform = 'translateY(100%)';
      usagePanel.style.transition = 'none';
      if (menuRootView) {
        menuRootView.style.display = 'block';
        menuRootView.style.position = 'absolute';
        menuRootView.style.top = '0';
        menuRootView.style.left = '0';
        menuRootView.style.width = '100%';
        menuRootView.style.height = '100%';
        menuRootView.style.zIndex = '2';
        menuRootView.style.transform = 'translateY(0)';
        menuRootView.style.transition = 'none';
      }
      setUsageNavBtn(true);
      renderUsagePanel();
      try {
        void usageArea.offsetHeight;
      } catch (err) {}
      usagePanel.style.transition = 'transform .22s ease';
      usagePanel.style.transform = 'translateY(0)';
      if (menuRootView) {
        menuRootView.style.transition = 'transform .22s ease';
        menuRootView.style.transform = 'translateY(-100%)';
      }
      usageShowTimer = setTimeout(function () {
        try {
          if (menuRootView) menuRootView.style.display = 'none';
        } catch (err) {}
      }, 240);
      if (usageRefreshTimer) {
        clearInterval(usageRefreshTimer);
        usageRefreshTimer = null;
      }
      usageRefreshTimer = setInterval(function () {
        if (usagePanelOpen) renderUsagePanel();
      }, 10000);
    }
    function hideUsageSub() {
      if (usageRefreshTimer) {
        clearInterval(usageRefreshTimer);
        usageRefreshTimer = null;
      }
      if (usageHideTimer) {
        clearTimeout(usageHideTimer);
        usageHideTimer = null;
      }
      if (usageShowTimer) {
        clearTimeout(usageShowTimer);
        usageShowTimer = null;
      }
      if (!usagePanelOpen) {
        setUsageNavBtn(false);
        return;
      }
      usagePanelOpen = false;
      if (!usagePanel) {
        setUsageNavBtn(false);
        return;
      }
      setUsageNavBtn(false);
      try {
        if (menuRootView && usageArea) {
          if (menuRootView.parentNode !== usageArea) usageArea.appendChild(menuRootView);
        }
      } catch (err) {}
      usagePanel.style.position = 'absolute';
      usagePanel.style.top = '0';
      usagePanel.style.left = '0';
      usagePanel.style.width = '100%';
      usagePanel.style.height = '100%';
      usagePanel.style.zIndex = '2';
      usagePanel.style.transform = 'translateY(0)';
      usagePanel.style.transition = 'none';
      if (menuRootView) {
        menuRootView.style.display = 'block';
        menuRootView.style.position = 'absolute';
        menuRootView.style.top = '0';
        menuRootView.style.left = '0';
        menuRootView.style.width = '100%';
        menuRootView.style.height = '100%';
        menuRootView.style.zIndex = '1';
        menuRootView.style.transform = 'translateY(-100%)';
        menuRootView.style.transition = 'none';
      }
      try {
        void usageArea.offsetHeight;
      } catch (err) {}
      usagePanel.style.transition = 'transform .22s ease';
      usagePanel.style.transform = 'translateY(100%)';
      if (menuRootView) {
        menuRootView.style.transition = 'transform .22s ease';
        menuRootView.style.transform = 'translateY(0)';
      }
      usageHideTimer = setTimeout(function () {
        usageHideTimer = null;
        try {
          usagePanel.style.display = 'none';
        } catch (err) {}
        try {
          usagePanel.style.transform = '';
          usagePanel.style.transition = '';
          usagePanel.style.width = '';
          usagePanel.style.height = '';
          usagePanel.style.maxHeight = '';
          usagePanel.style.position = '';
          usagePanel.style.top = '';
          usagePanel.style.left = '';
          usagePanel.style.zIndex = '';
          usagePanel.style.overflowY = '';
          usagePanel.style.overscrollBehavior = '';
        } catch (err) {}
        if (menuRootView && usageArea) {
          try {
            if (usageArea.contains(menuRootView)) menuBox.insertBefore(menuRootView, usageArea);
            menuRootView.style.transform = '';
            menuRootView.style.transition = '';
            menuRootView.style.position = '';
            menuRootView.style.top = '';
            menuRootView.style.left = '';
            menuRootView.style.width = '';
            menuRootView.style.height = '';
            menuRootView.style.zIndex = '';
          } catch (err) {}
        }
        try {
          usageArea.style.display = '';
        } catch (err) {}
        if (menuBox) {
          menuBox.classList.remove('dshwv-ledger-open');
          menuBox.style.width = '';
          menuBox.style.maxWidth = '';
          menuBox.style.height = '';
          menuBox.style.overflow = '';
          menuBox.style.display = '';
          menuBox.style.flexDirection = '';
        }
      }, 230);
    }
    function closeUsagePanel() {
      hideUsageSub();
    }
  function startLegacy() {
    usagePanelOpen = true;
    usagePanel.style.cssText = 'display:block;position:static;width:100%;height:auto;max-height:none;overflow:visible;transform:none';
    renderUsagePanel();
    if (!usageRefreshTimer) usageRefreshTimer = setInterval(function () { if (usagePanelOpen) renderUsagePanel(); }, 10000);
  }
  function stopLegacy() { usagePanelOpen = false; clearInterval(usageRefreshTimer); usageRefreshTimer = null; }
  function dispose() { stopLegacy(); clearTimeout(usageHideTimer); clearTimeout(usageShowTimer); }
  window.addEventListener('beforeunload', dispose, { once: true });
  return { toggle: toggleUsagePanel, show: showUsageSub, hide: hideUsageSub,
    close: closeUsagePanel, isOpen: function () { return usagePanelOpen; },
    startLegacy, stopLegacy, dispose };
}
