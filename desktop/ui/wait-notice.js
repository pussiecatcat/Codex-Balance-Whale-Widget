(() => {
  'use strict';
  const waitUrl = '/dsh-whale/wait.json';
  const usageUrl = '/dsh-whale/usage-settings.json';
  let activeId = '', dismissedId = '', settings = null, settingsAt = 0, timer = 0;
  const read = async url => {
    const response = await fetch(url, { cache: 'no-store' });
    const data = await response.json();
    if (!response.ok || data.ok === false) throw Error(data.error || '读取失败');
    return data;
  };
  const soundUrl = value => {
    value = String(value || '');
    if (value.startsWith('grp:')) return '/dsh-whale/sound/press.mp3?set=' + encodeURIComponent(value.slice(4));
    if (value.startsWith('frag:')) return '/dsh-whale/audio-fragment.wav?id=' + encodeURIComponent(value.slice(5));
    if (value.startsWith('preset:')) {
      const [, group, event] = value.split(':');
      return '/dsh-whale/sound/' + (event === 'release' ? 'release' : 'press') + '.mp3?set=' + encodeURIComponent(group);
    }
    return '';
  };
  function play(cfg) {
    const url = soundUrl(cfg.sel); if (!url) return;
    if (window.WhaleAudio) window.WhaleAudio.play({ channel: 'notice', url, volume: Math.max(0, Math.min(1, Number(cfg.vol) || 0)) });
    else { const audio = new Audio(url); audio.volume = Math.max(0, Math.min(1, Number(cfg.vol) || 0)); audio.play().catch(() => {}); }
  }
  async function tick() {
    try {
      const now = Date.now();
      if (!settings || now - settingsAt > 3000) {
        const usage = await read(usageUrl); settings = usage.settings || {}; settingsAt = now;
      }
      const state = await read(waitUrl), pending = state.pending;
      if (!pending) {
        if (activeId) window.WhaleLegacyUsage?.hideWait?.(activeId);
        activeId = ''; dismissedId = '';
      } else {
        const cfg = settings.events?.[pending.kind] || {};
        if (pending.id !== activeId) {
          if (activeId) window.WhaleLegacyUsage?.hideWait?.(activeId);
          activeId = pending.id;
          if (dismissedId !== activeId && cfg.on !== false) {
            if (cfg.soundOn === true) play(cfg);
            if (cfg.bubbleOn !== false) window.WhaleLegacyUsage?.showWait?.({
              id: activeId, kind: pending.kind, sessionLabel: pending.sessionLabel || '当前对话',
              lines: cfg.lines, closeOnRole: settings.wait?.charClose === true,
            });
          }
        } else if (cfg.on === false || cfg.bubbleOn === false) {
          window.WhaleLegacyUsage?.hideWait?.(activeId);
        }
      }
    } catch (_) {}
    timer = window.setTimeout(tick, document.hidden ? 2500 : 900);
  }
  window.addEventListener('whale-wait-dismissed', event => { dismissedId = String(event.detail?.id || activeId || ''); });
  window.addEventListener('whale-sound-settings-applied', () => {
    settingsAt = 0;
    if (activeId && dismissedId !== activeId) window.WhaleLegacyUsage?.hideWait?.(activeId);
    activeId = '';
  });
  window.addEventListener('beforeunload', () => clearTimeout(timer), { once: true });
  tick();
})();
