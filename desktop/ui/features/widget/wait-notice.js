import { requestJson } from '../../services/request.js';
import { sound as defaultSound } from '../../services/sound.js';

const POLL_MS = 900;
const HIDDEN_POLL_MS = 2500;

// The wait bubble follows Codex's pending question/approval state. The widget
// entry constructs it with the bubble surface and the sound service; saved sound
// settings arrive through applySettings instead of a second read every tick.
export class WaitNoticeController {
  constructor(options = {}) {
    this.window = options.windowRef || globalThis.window;
    this.request = options.request || requestJson;
    this.sound = options.sound || defaultSound;
    this.bubble = options.bubble || { showWait() {}, hideWait() {} };
    this.schedule = options.schedule || ((fn, delay) => this.window.setTimeout(fn, delay));
    this.cancelSchedule = options.cancelSchedule || (id => this.window.clearTimeout(id));
    this.settings = options.settings || null;
    this.settingsGeneration = 0;
    this.activeId = '';
    this.dismissedId = '';
    this.timer = 0;
    this.started = false;
    this.disposed = false;
    this.abortController = new AbortController();
    this.onDismissed = event => { this.dismissedId = String(event.detail?.id || this.activeId || ''); };
  }

  start() {
    if (this.started || this.disposed) return this;
    this.started = true;
    this.window.addEventListener('whale-wait-dismissed', this.onDismissed);
    if (!this.settings) this.loadSettings();
    this.tick();
    return this;
  }

  async loadSettings() {
    const generation = this.settingsGeneration;
    try {
      const snapshot = await this.request('/api/sound-settings', { signal: this.abortController.signal });
      if (this.disposed || generation !== this.settingsGeneration) return;
      this.settings = snapshot.usage || {};
      this.sound.reload(snapshot);
    } catch (error) {
      if (this.disposed || error?.kind === 'aborted') return;
    }
  }

  applySettings(snapshot) {
    this.settingsGeneration++;
    this.settings = snapshot?.usage || null;
    if (this.activeId && this.dismissedId !== this.activeId) this.bubble.hideWait(this.activeId);
    this.activeId = '';
  }

  play(config) {
    this.sound.preview(config.sel, config.vol, { channel: 'notice' });
  }

  async tick() {
    if (this.disposed) return;
    try {
      const state = await this.request('/dsh-whale/wait.json', { signal: this.abortController.signal });
      if (this.disposed) return;
      const pending = state.pending;
      if (!pending) {
        if (this.activeId) this.bubble.hideWait(this.activeId);
        this.activeId = '';
        this.dismissedId = '';
      } else {
        const config = this.settings?.events?.[pending.kind] || {};
        if (pending.id !== this.activeId) {
          if (this.activeId) this.bubble.hideWait(this.activeId);
          this.activeId = pending.id;
          if (this.dismissedId !== this.activeId && config.on !== false) {
            if (config.soundOn === true) this.play(config);
            if (config.bubbleOn !== false) this.bubble.showWait({
              id: this.activeId,
              kind: pending.kind,
              sessionLabel: pending.sessionLabel || '当前对话',
              lines: config.lines,
              closeOnRole: this.settings?.wait?.charClose === true,
            });
          }
        } else if (config.on === false || config.bubbleOn === false) {
          this.bubble.hideWait(this.activeId);
        }
      }
    } catch (error) {
      if (this.disposed || error?.kind === 'aborted') return;
    }
    this.timer = this.schedule(() => this.tick(), this.window.document.hidden ? HIDDEN_POLL_MS : POLL_MS);
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.abortController.abort();
    if (this.timer) this.cancelSchedule(this.timer);
    this.window.removeEventListener('whale-wait-dismissed', this.onDismissed);
  }
}

export function createWaitNotice(options = {}) {
  return new WaitNoticeController(options);
}
