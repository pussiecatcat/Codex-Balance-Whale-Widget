import { requestJson } from '../../services/request.js';
import { buildSoundSave, createSoundDraft, restoreSoundDefaults } from './model.js';
import { createSoundMenuEntry, createSoundSettingsView } from './view.js';
import { sound } from '../../services/sound.js';

const SETTINGS_URL = '/api/sound-settings';
const AUDIO_URL = '/dsh-whale/audio.json';

function previewPlayer(service) {
  return {
    play: (ref, volume) => service.preview(ref, volume, { channel: 'sound-settings-preview' }),
    stop: () => service.stop('sound-settings-preview'),
  };
}

function waitForLegacySoundUi(windowRef = window, { signal } = {}) {
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
    this.settings = options.settings || null;
    this.createMenuEntry = options.createMenuEntry || createSoundMenuEntry;
    this.createView = options.createView || createSoundSettingsView;
    this.sound = options.sound || sound;
    this.player = options.player || previewPlayer(this.sound);
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
      this.sound.reload({ ...bundle, catalog });
      this.draft = createSoundDraft(bundle, catalog);
      this.view = this.createView({
        documentRef: this.document,
        draft: this.draft,
        initialCatalog: this.catalog,
        selectEnhancer: this.window.WhaleSelect,
        onSave: () => this.save(),
        onClose: () => { this.view = null; this.player.stop(); },
        onRestore: () => restoreSoundDefaults(this.draft),
        onEditAudio: async () => {
          const result = await this.legacy.audioEditor.open({ groupId: null });
          if (result?.catalog) this.sound.reload({ catalog: result.catalog });
          return result;
        },
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
    const savingView = this.view;
    const command = buildSoundSave(this.bundle, this.draft);
    let saved;
    if (this.settings) {
      // The settings window writes these two domains through SettingsStore;
      // the panel uses the same path so it cannot bypass the change bus.
      const size = await this.settings.write({ domain: 'size', changes: command.size, force: true });
      if (!size?.ok) throw new Error(size?.error || '音效设置保存失败');
      const usage = await this.settings.write({ domain: 'usage', changes: command.usage, force: true });
      if (!usage?.ok) throw new Error(usage?.error || '音效设置保存失败');
      saved = { ok: true, size: size.values || command.size, usage: usage.values || command.usage };
    } else {
      saved = await this.request(SETTINGS_URL, {
        method: 'PUT', body: command, signal: this.abortController.signal,
      });
    }
    if (this.disposed) return saved;
    const ownsView = this.view === savingView;
    if (ownsView) this.bundle = saved;
    this.sound.reload(saved);
    this.legacy.applySettings(saved);
    this.window.dispatchEvent(new this.window.CustomEvent('whale-sound-settings-applied', { detail: saved }));
    if (ownsView) {
      this.view = null;
      savingView?.destroy();
      this.player.stop();
    }
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
