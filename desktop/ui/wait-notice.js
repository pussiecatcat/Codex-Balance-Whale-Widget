import { requestJson } from './services/request.js';
import { normalizeVolume, soundReferenceUrl } from './services/sound-reference.js';

export class WaitNoticeController {
  constructor(options = {}) {
    this.window = options.windowRef || window;
    this.request = options.request || requestJson;
    this.usage = options.legacyUsage || (() => this.window.WhaleLegacyUsage);
    this.schedule = options.schedule || ((fn, delay) => this.window.setTimeout(fn, delay));
    this.cancelSchedule = options.cancelSchedule || (id => this.window.clearTimeout(id));
    this.settings = null;
    this.settingsAt = 0;
    this.activeId = '';
    this.dismissedId = '';
    this.timer = 0;
    this.started = false;
    this.disposed = false;
    this.abortController = new AbortController();
    this.onDismissed = event => { this.dismissedId = String(event.detail?.id || this.activeId || ''); };
    this.onSettings = event => {
      this.settings = event.detail?.usage || null;
      this.settingsAt = this.settings ? Date.now() : 0;
      if (this.activeId && this.dismissedId !== this.activeId) this.usage()?.hideWait?.(this.activeId);
      this.activeId = '';
    };
  }

  start() {
    if (this.started || this.disposed) return this;
    this.started = true;
    this.window.addEventListener('whale-wait-dismissed', this.onDismissed);
    this.window.addEventListener('whale-sound-settings-applied', this.onSettings);
    this.tick();
    return this;
  }

  play(config) {
    const url = soundReferenceUrl(config.sel);
    if (!url) return;
    const volume = normalizeVolume(config.vol, 1);
    if (this.window.WhaleAudio) this.window.WhaleAudio.play({ channel: 'notice', url, volume });
    else {
      const audio = new this.window.Audio(url);
      audio.volume = volume;
      audio.play().catch(() => {});
    }
  }

  async tick() {
    if (this.disposed) return;
    try {
      const now = Date.now();
      if (!this.settings || now - this.settingsAt > 3000) {
        const snapshot = await this.request('/api/sound-settings', { signal: this.abortController.signal });
        this.settings = snapshot.usage || {};
        this.settingsAt = now;
      }
      const state = await this.request('/dsh-whale/wait.json', { signal: this.abortController.signal });
      if (this.disposed) return;
      const pending = state.pending;
      if (!pending) {
        if (this.activeId) this.usage()?.hideWait?.(this.activeId);
        this.activeId = '';
        this.dismissedId = '';
      } else {
        const config = this.settings.events?.[pending.kind] || {};
        if (pending.id !== this.activeId) {
          if (this.activeId) this.usage()?.hideWait?.(this.activeId);
          this.activeId = pending.id;
          if (this.dismissedId !== this.activeId && config.on !== false) {
            if (config.soundOn === true) this.play(config);
            if (config.bubbleOn !== false) this.usage()?.showWait?.({
              id: this.activeId,
              kind: pending.kind,
              sessionLabel: pending.sessionLabel || '当前对话',
              lines: config.lines,
              closeOnRole: this.settings.wait?.charClose === true,
            });
          }
        } else if (config.on === false || config.bubbleOn === false) {
          this.usage()?.hideWait?.(this.activeId);
        }
      }
    } catch (error) {
      if (this.disposed || error?.kind === 'aborted') return;
    }
    this.timer = this.schedule(() => this.tick(), this.window.document.hidden ? 2500 : 900);
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.abortController.abort();
    if (this.timer) this.cancelSchedule(this.timer);
    this.window.removeEventListener('whale-wait-dismissed', this.onDismissed);
    this.window.removeEventListener('whale-sound-settings-applied', this.onSettings);
  }
}

export function startWaitNotice(options) {
  return new WaitNoticeController(options).start();
}

let controller = null;
function start() { controller ||= startWaitNotice(); }
function dispose() { controller?.dispose(); controller = null; }

if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
  window.addEventListener('beforeunload', dispose, { once: true });
}
