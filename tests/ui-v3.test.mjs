import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const read = name => fs.readFileSync(new URL('../desktop/ui/' + name, import.meta.url), 'utf8');
function audioFixture() {
  const sources = []; let contexts = 0, idle;
  class AudioContext {
    state = 'running'; currentTime = 0;
    constructor() { contexts++; }
    resume() { return Promise.resolve(); } close() { this.state = 'closed'; return Promise.resolve(); }
    decodeAudioData() { return Promise.resolve({ duration: 20 }); }
    createGain() { return { gain: { value: 0, setValueAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {} }, connect() {}, disconnect() {} }; }
    createBufferSource() { const source = { connect() {}, start() { this.started = true; }, stop() { this.stopped = true; } }; sources.push(source); return source; }
  }
  const context = { sound: { attachEngine() {} }, window: { addEventListener() {} }, AudioContext, requestBytes: async () => new ArrayBuffer(1), setTimeout: callback => { idle = callback; return 1; }, clearTimeout() {} };
  vm.runInNewContext(read('audio-engine.js').replace(/^import .*$/gm, ''), context);
  return { api: context.window.WhaleAudio, sources, contexts: () => contexts, idle: () => idle() };
}
test('forgetting group sounds decodes an edited clip again under the same URL', async () => {
  let fetches = 0;
  class AudioContext { resume() { return Promise.resolve(); } close() { return Promise.resolve(); } decodeAudioData() { return Promise.resolve({ duration: 1 }); } }
  const context = { sound: { attachEngine() {} }, window: { addEventListener() {} }, AudioContext, requestBytes: async () => { fetches++; return new ArrayBuffer(1); },
    setTimeout: () => 1, clearTimeout() {} };
  vm.runInNewContext(read('audio-engine.js').replace(/^import .*$/gm, ''), context);
  const api = context.window.WhaleAudio, url = '/dsh-whale/sound/press.mp3?set=g1';
  await api.warm(url); await api.warm(url);
  assert.equal(fetches, 1, 'a second play reuses the decode');
  api.forget('/dsh-whale/sound/');
  await api.warm(url);
  assert.equal(fetches, 2, 'after forget the edited clip is fetched again');
});
test('zero volume never opens audio hardware or fetches, release interrupts a 20-second press immediately', async () => {
  const f = audioFixture(); await f.api.play({ url: '/press', volume: 0 }); assert.equal(f.contexts(), 0);
  await f.api.play({ channel: 'gesture', url: '/press', volume: .5 }); assert.equal(f.sources[0].started, true);
  await f.api.play({ channel: 'gesture', url: '/release', volume: .5 }); assert.equal(f.sources[0].stopped, true); assert.equal(f.sources[1].started, true);
  f.idle(); assert.equal(f.sources[1].stopped, true);
});
test('gesture presets separate press from rebound without changing root flip', () => {
  const window = {}; vm.runInNewContext(read('gesture.js'), { window }); const body = { style: {} };
  window.WhaleGesture.apply(body, true, 'crisp'); assert.match(body.style.transition, /65ms/); assert.match(body.style.transform, /0.9/);
  window.WhaleGesture.apply(body, false, 'crisp'); assert.match(body.style.transition, /125ms/); assert.equal(body.style.transform, 'scaleY(1) scaleX(1)');
});
test('a press squashes and springs back without any sideways motion', () => {
  const window = {}; vm.runInNewContext(read('gesture.js'), { window, performance: { now: () => 0 } });
  const body = { style: {}, offsetWidth: 0 };
  for (let i = 0; i < 3; i++) {
    window.WhaleGesture.apply(body, true);
    assert.equal(body.style.transform, 'scaleY(0.88) scaleX(1.05)');
    window.WhaleGesture.apply(body, false);
    assert.equal(body.style.transform, 'scaleY(1) scaleX(1)');
    assert.match(body.style.transition, /220ms cubic-bezier\(\.34,1\.56,\.64,1\)/);
  }
});
test('late decoding cannot resurrect a cancelled gesture', async () => {
  const f = audioFixture(); const playing = f.api.play({ channel: 'gesture', url: '/press' }); f.api.stop('gesture'); await playing; assert.equal(f.sources.length, 0);
});
