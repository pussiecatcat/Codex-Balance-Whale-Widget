// Composition for the remaining classic-script adapters; feature code receives explicit ports.
import { SoundSettingsController } from '../features/sound-settings/controller.js';

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

export async function startSoundSettings(options = {}) {
  const windowRef = options.windowRef || window;
  const legacy = options.legacy || await waitForLegacySoundUi(windowRef, { signal: options.signal });
  if (options.signal?.aborted) throw options.signal.reason || new DOMException('Aborted', 'AbortError');
  const controller = new SoundSettingsController({
    ...options, windowRef, legacy,
    player: options.player || previewPlayer(windowRef),
    getSelectEnhancer: options.getSelectEnhancer || (() => windowRef.WhaleSelect),
    presentFor: options.presentFor || (ms => windowRef.WhaleRendering?.presentFor?.(ms)),
  });
  controller.start();
  return controller;
}
