// Settings transactions, balance refresh and saved anchors share one owner.
export function savedAnchor({ state, viewport, width, height, rightGap = 0 }) {
  const left = state.left, right = viewport.w - left - width;
  const top = state.top, bottom = viewport.h - top - height;
  const hAnchor = left <= right ? 'left' : 'right';
  return { v: 2, hAnchor, hDist: Math.max(0, Math.round(Math.min(left, right)) - (hAnchor === 'right' ? rightGap : 0)),
    vAnchor: top <= bottom ? 'top' : 'bottom', vDist: Math.max(0, Math.round(Math.min(top, bottom))) };
}

export function createConfigSync({ requestJson, settingsUrl, balanceUrl, root, localStorage, settingsClient,
  getState, getAccountView, setNativeCurrency, onBalance, checkAlerts, requireSaved,
  onError, getSizeSettings, getPosition, timeoutMs = 25000 }) {
  let busy = false;
  async function updateSoundSettings(mutate, onSaved, attempt = 0) {
    try {
      const current = await requestJson(settingsUrl);
      if (!current || current.ok !== true) throw Error(current?.error || '无法读取设置');
      const next = mutate({ size: current.size, usage: current.usage });
      const body = await requestJson(settingsUrl, { method: 'PUT', body: {
        schemaVersion: current.schemaVersion, revision: current.revision, size: next.size, usage: next.usage,
      } });
      requireSaved(body); onSaved?.(body); return body;
    } catch (error) {
      if (error?.status === 409 && attempt < 1) return updateSoundSettings(mutate, onSaved, attempt + 1);
      onError(error); return null;
    }
  }
  function refresh(manual) {
      const state = getState();
      if (getAccountView()?.mode === 'subscription') { getAccountView().refresh(); return; }
      if (busy) return;
      busy = true;
      if (manual || state.balance === null) state.status = 'loading';
      var ctrl = null;
      var timer = null;
      try {
        ctrl = new AbortController();
        timer = setTimeout(function () {
          try {
            ctrl.abort();
          } catch (err) {}
        }, timeoutMs);
      } catch (err) {}
      return requestJson(balanceUrl + (manual ? '?refresh=1' : ''), {
        signal: ctrl ? ctrl.signal : undefined
      }).then(function (data) {
        if (data && data.ok) {
          var nb = data.unlimited ? Infinity : Number(data.totalBalance);
          var nc = String(data.currency || 'USD');
          state.balance = nb;
          state.currency = nc;
          setNativeCurrency(nc);
          state.message = '';
          state.code = '';
          state.updatedAt = Number(data.updatedAt) || Date.now();
          state.todayUsage = data.todayUsage !== undefined ? data.todayUsage : null;
          state.unlimited = !!data.unlimited;
          state.providerName = data.providerName || '';
          state.balanceScope = data.balanceScope || '';
          state.stale = !!data.stale;
          root.title = (data.balanceLabel || 'API 可用余额') + (data.stale ? '（上次成功数据）' : '');
          onBalance?.(data);
          checkAlerts(nb, state.todayUsage);
          state.status = 'ok';
        } else {
          state.status = 'error';
          state.code = data && data.code || 'ERROR';
          state.message = data && data.error ? String(data.error) : '获取失败';
          onBalance?.(data || { ok: false });
        }
      }).catch(function () {
        state.status = 'error';
        state.code = 'NETWORK';
        state.message = '获取失败';
      }).finally(function () {
        busy = false;
        if (timer) clearTimeout(timer);
      });
    }

  function save() {
    const size = getSizeSettings();
    // Widget drags are the user's latest intent, so the size domain is written
    // through the same SettingsStore as the settings window and forced past a
    // concurrent edit. The store publishes the change bus message.
    const operation = settingsClient
      ? settingsClient.write({ domain: 'size', changes: size, force: true })
        .then(result => { requireSaved(result); return result; })
        .catch(error => { onError(error); return null; })
      : updateSoundSettings(current => ({ size: { ...current.size, ...size }, usage: current.usage }));
    try { localStorage.setItem('dshw-pos', JSON.stringify(savedAnchor(getPosition()))); }
    catch (error) { onError(error); }
    return operation;
  }
  return { refresh, save, get busy() { return busy; } };
}
