import { startSoundSettings } from './features/sound-settings/controller.js';

let controller = null;
const startup = new AbortController();

async function start() {
  if (controller) return;
  try { controller = await startSoundSettings({ signal: startup.signal }); }
  catch (error) {
    if (error?.name !== 'AbortError') console.error('音效设置启动失败', error);
  }
}

function dispose() {
  startup.abort();
  controller?.dispose();
  controller = null;
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
else start();
window.addEventListener('beforeunload', dispose, { once: true });
