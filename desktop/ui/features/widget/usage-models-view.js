// Model summaries and their asynchronous list rendering share one request sequence.
export function createUsageModelsView(deps) {
  const { document, window, WhaleMoney, getPanel, now = Date.now } = deps;
  let usageModelListEl = null, usageModelRefreshBtn = null, usageModelRenderSeq = 0;
    function usageApiModelSummary(model, value) {
      if (!value) return '加载中…';
      if (value.error) return '暂不可用';
      var windows = Array.isArray(value.windows) ? value.windows : [];
      var quota = windows.length ? windows[0] : null;
      if (quota && typeof quota.usedPercent === 'number' && isFinite(quota.usedPercent) && !(quota.resetsAt && Number(quota.resetsAt) <= now())) {
        return '剩余 ' + Math.max(0, 100 - quota.usedPercent).toFixed(1) + '%';
      }
      if (model.kind === 'quota') return '额度（未观测）';
      if (typeof value.balance === 'number' && isFinite(value.balance)) {
        return '余额 ' + WhaleMoney.formatMoney(value.balance, value.currency || model.currency || 'USD');
      }
      if (typeof value.todayEstimate === 'number' && isFinite(value.todayEstimate)) {
        return '今日 ' + WhaleMoney.formatMoney(value.todayEstimate, value.currency || model.currency || 'USD');
      }
      if (value.noBalanceApi || value.available === false || model.noBalanceApi) return '余额（无接口）';
      if (model.kind === 'codex') return '本机统计';
      return '余额（待同步）';
    }
    function renderUsageModels(force) {
      if (!usageModelListEl) return;
      var list = usageModelListEl;
      var button = usageModelRefreshBtn;
      var seq = ++usageModelRenderSeq;
      if (button) button.disabled = true;
      list.innerHTML = '';
      var loading = document.createElement('div');
      loading.className = 'dshwv-book-model-empty';
      loading.textContent = '正在读取模型…';
      list.appendChild(loading);
      if (!window.WhaleApiModels || typeof window.WhaleApiModels.load !== 'function') {
        loading.textContent = 'API 模型模块未加载';
        if (button) button.disabled = false;
        return;
      }
      window.WhaleApiModels.load(!!force).then(function (data) {
        var models = data && Array.isArray(data.models) ? data.models : [];
        return Promise.all(models.map(function (model) {
          return window.WhaleApiModels.refresh(model.id, !!force).then(function (value) {
            return { model: model, value: value };
          }).catch(function (error) {
            return { model: model, value: { error: error && error.message || '读取失败' } };
          });
        }));
      }).then(function (items) {
        if (seq !== usageModelRenderSeq || list !== usageModelListEl) return;
        list.innerHTML = '';
        if (!items.length) {
          var empty = document.createElement('div');
          empty.className = 'dshwv-book-model-empty';
          empty.textContent = '还没有 API 模型';
          list.appendChild(empty);
          return;
        }
        items.forEach(function (entry) {
          var row = document.createElement('div');
          row.className = 'dshwv-book-model-row';
          var name = document.createElement('span');
          name.className = 'dshwv-book-model-name';
          name.textContent = entry.model.name || 'API 模型';
          name.title = name.textContent;
          row.appendChild(name);
          var value = document.createElement('span');
          value.className = 'dshwv-book-model-value';
          value.textContent = usageApiModelSummary(entry.model, entry.value);
          value.title = value.textContent;
          row.appendChild(value);
          var settings = document.createElement('button');
          settings.type = 'button';
          settings.className = 'dshwv-roleimport dshwv-book-model-setting';
          settings.textContent = '设置';
          settings.title = '设置 ' + name.textContent + ' 的接口、预算、提醒与额度';
          settings.addEventListener('click', function (event) {
            event.stopPropagation();
            window.dispatchEvent(new CustomEvent('whale-api-model-edit', { detail: { id: entry.model.id } }));
          });
          row.appendChild(settings);
          list.appendChild(row);
        });
      }).catch(function (error) {
        if (seq !== usageModelRenderSeq || list !== usageModelListEl) return;
        list.innerHTML = '';
        var failed = document.createElement('div');
        failed.className = 'dshwv-book-model-empty';
        failed.textContent = error && error.message || '模型读取失败';
        list.appendChild(failed);
      }).finally(function () {
        if (seq === usageModelRenderSeq && button === usageModelRefreshBtn && button) button.disabled = false;
      });
    }
    function buildUsageModelArea() {
      var area = document.createElement('section');
      area.className = 'dshwv-book-models';
      var head = document.createElement('div');
      head.className = 'dshwv-book-model-head';
      var title = document.createElement('strong');
      title.className = 'dshwv-book-model-title';
      title.textContent = '模型（提醒 / 预算 / 额度）';
      head.appendChild(title);
      usageModelRefreshBtn = document.createElement('button');
      usageModelRefreshBtn.type = 'button';
      usageModelRefreshBtn.className = 'dshwv-palchip dshwv-book-model-refresh';
      usageModelRefreshBtn.textContent = '刷新';
      usageModelRefreshBtn.addEventListener('click', function (event) {
        event.stopPropagation();
        renderUsageModels(true);
      });
      head.appendChild(usageModelRefreshBtn);
      area.appendChild(head);
      usageModelListEl = document.createElement('div');
      usageModelListEl.className = 'dshwv-book-model-list';
      area.appendChild(usageModelListEl);
      var add = document.createElement('button');
      add.type = 'button';
      add.className = 'dshwv-usage-more dshwv-book-add';
      add.dataset.action = 'add-api-model';
      add.textContent = '＋ 添加模型（自定义 API）';
      add.addEventListener('click', function (event) {
        event.stopPropagation();
        window.dispatchEvent(new CustomEvent('whale-api-model-edit', { detail: { id: null } }));
      });
      area.appendChild(add);
      var divider = document.createElement('div');
      divider.className = 'dshwv-book-divider';
      area.appendChild(divider);
      getPanel().appendChild(area);
      renderUsageModels(false);
    }
  return { render: renderUsageModels, build: buildUsageModelArea,
    summary: usageApiModelSummary, hasList: function () { return !!usageModelListEl; } };
}
