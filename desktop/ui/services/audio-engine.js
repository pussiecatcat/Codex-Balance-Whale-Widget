import { requestBytes as defaultRequestBytes } from './request.js';
import { sound as defaultSound } from './sound.js';

export function createAudioEngine({
  window: windowRef = globalThis,
  document: documentRef = globalThis.document,
  AudioContext: AudioContextCtor = globalThis.AudioContext,
  requestBytes = defaultRequestBytes,
  setTimeout: setTimer = globalThis.setTimeout,
  clearTimeout: clearTimer = globalThis.clearTimeout,
  sound = defaultSound,
  idleMs = 60000,
} = {}) {
  let ctx, idle;
  const buffers = new Map(), pending = new Map(), active = new Map(), epochs = new Map();
  function context() { if (!ctx || ctx.state === 'closed') ctx = new AudioContextCtor(); return ctx; }
  function touch() {
    clearTimer(idle);
    idle = setTimer(() => {
      stop(); buffers.clear(); pending.clear();
      const old = ctx; ctx = null; old?.close().catch(() => {});
    }, idleMs);
  }
  async function warm(url) {
    if (!url) return null;
    touch();
    if (buffers.has(url)) return buffers.get(url);
    if (pending.has(url)) return pending.get(url);
    const c = context();
    const job = requestBytes(url).then(b => c.decodeAudioData(b)).then(b => { buffers.set(url, b); return b; }).finally(() => pending.delete(url));
    pending.set(url, job); return job;
  }
  function stop(channel) {
    for (const key of channel ? [channel] : [...new Set([...active.keys(), ...epochs.keys()])]) {
      epochs.set(key, (epochs.get(key) || 0) + 1);
      for (const node of active.get(key) || []) { try { node.stop(); } catch { /* already stopped */ } }
      active.delete(key);
    }
  }
  async function play({ channel = 'preview', url, preset = 'original', volume = .9, onended } = {}) {
    stop(channel); const epoch = epochs.get(channel);
    if (!(Number(volume) > 0)) return;
    try {
      const c = context(); touch(); await c.resume();
      const buffer = preset === 'original' ? await warm(url) : null;
      if (epochs.get(channel) !== epoch || c !== ctx) return;
      const gain = c.createGain(); gain.connect(c.destination);
      const now = c.currentTime, nodes = [];
      if (preset === 'original') {
        if (!buffer) { gain.disconnect(); return; }
        const source = c.createBufferSource(); source.buffer = buffer; source.connect(gain);
        gain.gain.value = Math.min(1, volume); nodes.push(source); source.start();
      } else {
        const tones = { pearl: [660, 880], bubble: [260, 520], glass: [1046, 1318] }[preset] || [440, 660];
        gain.gain.setValueAtTime(0, now); gain.gain.linearRampToValueAtTime(Math.min(1, volume) * .15, now + .012);
        gain.gain.exponentialRampToValueAtTime(.0001, now + .18);
        for (let i = 0; i < tones.length; i++) {
          const o = c.createOscillator(); o.type = 'sine'; o.frequency.setValueAtTime(tones[i], now); o.connect(gain); nodes.push(o); o.start(now + i * .035); o.stop(now + .19);
        }
      }
      active.set(channel, nodes);
      nodes[nodes.length - 1].onended = () => {
        gain.disconnect();
        if (active.get(channel) === nodes) active.delete(channel);
        if (epochs.get(channel) === epoch) onended?.();
      };
    } catch { onended?.(); /* missing or unsupported audio must never block interaction */ }
  }
  function forget(prefix = '') {
    for (const map of [buffers, pending]) for (const key of [...map.keys()]) if (key.startsWith(prefix)) map.delete(key);
  }
  const api = Object.freeze({ warm, play, stop, forget });
  sound.attachEngine(api);
  if (documentRef?.addEventListener) documentRef.addEventListener('visibilitychange', () => { if (documentRef.hidden) { stop(); ctx?.suspend().catch(() => {}); } });
  windowRef?.addEventListener?.('beforeunload', () => { stop(); clearTimer(idle); ctx?.close().catch(() => {}); });
  return api;
}
