import { requestJson } from '../../services/request.js';
import { buildSoundSave, createSoundDraft, restoreSoundDefaults } from './model.js';
import { createSoundMenuEntry, createSoundSettingsView } from './view.js';

const SETTINGS_URL = '/api/sound-settings';
const AUDIO_URL = '/dsh-whale/audio.json';

function previewPlayer(windowRef) {
  let audio = null;
  const stop = () => {
    if (audio) { audio.pause(); audio.currentTime = 0; audio = null; }
    windowRef.WhaleAudio?.stop?.('notice');
  };
  return {
    play(url, volume) {
      stop();
      if (!url) return;
      if (windowRef.WhaleAudio) {
        windowRef.WhaleAudio.play({ channel: 'notice', url, volume });
        return;
      }
      audio = new windowRef.Audio(url);
      audio.volume = Math.max(0, Math.min(1, Number(volume) || 0));
      audio.play().catch(() => {});
    },
    stop,
  };
}

export function waitForLegacySoundUi(windowRef = window, { signal } = {}) {
  if (windowRef.WhaleLegacySoundUi) return Promise.resolve(windowRef.WhaleLegacySoundUi);
  return new Promise((resolve, reject) => {
    const ready = event => {
      cleanup();
      const adapter = event.detail || windowRef.WhaleLegacySoundUi;
      if (adapter) resolve(adapter); else reject(new Error('旧挂件适配器未提供接口'));
    };
    const aborted = () => { cleanup(); reject(signal?.reason || new DOMException('Aborted', 'AbortError')); };
    const cleanup = () => {
      windowRef.removeEventListener('whale-legacy-sound-ready', ready);
      signal?.removeEventListener('abort', aborted);
    };
    windowRef.addEventListener('whale-legacy-sound-ready', ready, { once: true });
    if (signal?.aborted) aborted(); else signal?.addEventListener('abort', aborted, { once: true });
  });
}

export class SoundSettingsController {
  constructor(options = {}) {
    this.window = options.windowRef || window;
    this.document = options.documentRef || this.window.document;
    this.legacy = options.legacy;
    this.request = options.request || requestJson;
    this.createMenuEntry = options.createMenuEntry || createSoundMenuEntry;
    this.createView = options.createView || createSoundSettingsView;
    this.player = options.player || previewPlayer(this.window);
    this.abortController = new AbortController();
    this.entry = null;
    this.unmount = null;
    this.view = null;
    this.bundle = null;
    this.draft = null;
    this.catalog = null;
    this.disposed = false;
    this.openController = null;
    this.onModeChanging = () => { this.cancelOpen(); this.closeView(); };
  }

  start() {
    if (this.disposed) throw new Error('音效设置控制器已销毁');
    if (this.entry) return this;
    this.entry = this.createMenuEntry({ documentRef: this.document, onOpen: () => this.open() });
    this.unmount = this.legacy.mountMenuEntry(this.entry.element);
    this.window.addEventListener?.('whale-mode-changing', this.onModeChanging);
    return this;
  }

  async open() {
    if (this.disposed || this.view || this.openController) return;
    const operation = new AbortController();
    this.openController = operation;
    this.entry?.setLoading(true);
    try {
      const [bundle, catalog] = await Promise.all([
        this.request(SETTINGS_URL, { signal: operation.signal }),
        this.request(AUDIO_URL, { signal: operation.signal }),
      ]);
      if (this.disposed || operation.signal.aborted) return;
      this.bundle = bundle;
      this.catalog = catalog;
      this.draft = createSoundDraft(bundle, catalog);
      this.view = this.createView({
        documentRef: this.document,
        draft: this.draft,
        initialCatalog: this.catalog,
        selectEnhancer: this.window.WhaleSelect,
        onSave: () => this.save(),
        onClose: () => { this.view = null; this.player.stop(); },
        onRestore: () => restoreSoundDefaults(this.draft),
        onEditAudio: () => this.legacy.audioEditor.open({ groupId: null }),
        onEditPrompt: (kind, config) => this.legacy.promptEditor.open({ kind, config }),
        onPreview: (url, volume) => this.player.play(url, volume),
        onStopPreview: () => this.player.stop(),
      });
      this.window.WhaleRendering?.presentFor?.(350);
      this.entry?.setLoading(false);
    } catch (error) {
      if (this.disposed || operation.signal.aborted || error?.name === 'AbortError' || error?.kind === 'aborted') return;
      this.entry?.setLoading(false, error?.message || '音效设置读取失败');
    } finally {
      if (this.openController === operation) this.openController = null;
    }
  }

  async save() {
    const command = buildSoundSave(this.bundle, this.draft);
    const saved = await this.request(SETTINGS_URL, {
      method: 'PUT', body: command, signal: this.abortController.signal,
    });
    this.bundle = saved;
    this.legacy.applySettings(saved);
    this.window.dispatchEvent(new this.window.CustomEvent('whale-sound-settings-applied', { detail: saved }));
    const current = this.view;
    this.view = null;
    current?.destroy();
    this.player.stop();
    return saved;
  }

  closeView() {
    const current = this.view;
    this.view = null;
    current?.destroy();
    this.player.stop();
  }

  cancelOpen() {
    const current = this.openController;
    if (!current) return;
    this.openController = null;
    current.abort();
    this.entry?.setLoading(false);
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.abortController.abort();
    this.cancelOpen();
    this.window.removeEventListener?.('whale-mode-changing', this.onModeChanging);
    this.closeView();
    this.unmount?.(); this.unmount = null;
    this.entry?.destroy(); this.entry = null;
  }
}

export async function startSoundSettings(options = {}) {
  const windowRef = options.windowRef || window;
  const legacy = options.legacy || await waitForLegacySoundUi(windowRef, { signal: options.signal });
  const controller = new SoundSettingsController({ ...options, windowRef, legacy });
  controller.start();
  return controller;
}
