import test from 'node:test';
import assert from 'node:assert/strict';
import { RequestError, requestJson } from '../desktop/ui/services/request.js';
import { parseSoundReference, soundReferenceUrl } from '../desktop/ui/services/sound-reference.js';
import { buildSoundSave, createSoundDraft } from '../desktop/ui/features/sound-settings/model.js';
import { SoundSettingsController } from '../desktop/ui/features/sound-settings/controller.js';
import { WaitNoticeController } from '../desktop/ui/wait-notice.js';

const usage = () => ({
  taskEnd: { on: false, sel: 'preset:duck:press', vol: 1, volSet: false },
  events: {
    press: { vol: 1 },
    turnCost: { vol: 1, volSet: false, bubbleOn: true },
    question: { on: true, soundOn: false, sel: 'preset:duck:press', vol: 1, bubbleOn: true, lines: [] },
    approval: { on: true, soundOn: false, sel: 'preset:duck:press', vol: 1, bubbleOn: true, lines: [] },
  },
  wait: { charClose: false },
  turnCost: { lines: [] },
  futureUsage: { keep: true },
});

const bundle = () => ({
  ok: true, schemaVersion: 2,
  size: { scale: 1, sound: true, vol: .9, soundSet: 'duck', turnCostOn: true, turnCostCloseMs: 5000, futureSize: 'keep' },
  usage: usage(),
});

const catalog = () => ({ ok: true, groups: [{ id: 'duck', name: '小黄鸭' }], fragments: [] });

test('request client classifies HTTP, business, parse, timeout and cancellation failures', async () => {
  assert.deepEqual(await requestJson('/ok', { fetchImpl: async () => new Response('{"ok":true,"value":3}') }), { ok: true, value: 3 });
  await assert.rejects(requestJson('/http', { fetchImpl: async () => new Response('{"error":"冲突"}', { status: 409 }) }), error => error instanceof RequestError && error.kind === 'http' && error.status === 409);
  await assert.rejects(requestJson('/business', { fetchImpl: async () => new Response('{"ok":false,"error":"失败"}') }), error => error.kind === 'business');
  await assert.rejects(requestJson('/parse', { fetchImpl: async () => new Response('not-json') }), error => error.kind === 'parse');
  await assert.rejects(requestJson('/timeout', { timeoutMs: 5, fetchImpl: (_url, options) => new Promise((_resolve, reject) => options.signal.addEventListener('abort', () => reject(new Error('aborted')))) }), error => error.kind === 'timeout');
  const abort = new AbortController(); abort.abort();
  await assert.rejects(requestJson('/abort', { signal: abort.signal, fetchImpl: async (_url, options) => { if (options.signal.aborted) throw new Error('aborted'); } }), error => error.kind === 'aborted');
});

test('sound references have one parser and preserve group, fragment and preset URL semantics', () => {
  assert.deepEqual(parseSoundReference('grp:my group'), { kind: 'group', id: 'my group' });
  assert.deepEqual(parseSoundReference('frag:finish'), { kind: 'fragment', id: 'finish' });
  assert.deepEqual(parseSoundReference('preset:duck:release'), { kind: 'preset', groupId: 'duck', event: 'release' });
  assert.equal(parseSoundReference('preset:duck:other'), null);
  assert.equal(soundReferenceUrl('grp:my group'), '/dsh-whale/sound/press.mp3?set=my%20group');
  assert.equal(soundReferenceUrl('grp:my group', { groupSlot: 'release' }), '/dsh-whale/sound/release.mp3?set=my%20group');
  assert.equal(soundReferenceUrl('frag:finish'), '/dsh-whale/audio-fragment.wav?id=finish');
});

test('sound draft cancel is isolated and one save command preserves unknown fields', () => {
  const original = bundle(), draft = createSoundDraft(original, catalog());
  draft.vol = .2; draft.events.question.soundOn = true;
  assert.equal(original.size.vol, .9);
  const output = buildSoundSave(original, draft);
  assert.equal(output.schemaVersion, 2);
  assert.equal(output.patch.size.vol, .2);
  assert.equal(output.patch.usage.events.question.soundOn, true);
  // Unknown fields are no longer carried by the client: it writes only the fields
  // the panel owns, and the server leaves everything else in the current document
  // alone. That is what keeps a concurrently changed setting from being written
  // back, and what the server-side test below pins.
  assert.equal('futureSize' in output.patch.size, false);
  assert.equal('futureUsage' in output.patch.usage, false);
  // The values those fields were read from travel with them, so the server can
  // tell a field that changed underneath from one that did not.
  assert.equal(output.base.size.vol, .9);
  assert.equal(output.base.usage.events, original.usage.events);
});

test('sound controller mounts explicitly, cancel writes nothing and save performs one combined PUT', async () => {
  const calls = [], applied = [], dispatched = [], loading = [];
  let viewOptions, unmounted = 0, destroyed = 0;
  const windowRef = {
    document: {}, WhaleSelect: {}, WhaleRendering: { presentFor() {} },
    CustomEvent: class { constructor(type, options) { this.type = type; this.detail = options.detail; } },
    dispatchEvent: event => dispatched.push(event),
  };
  const legacy = {
    mountMenuEntry: () => () => { unmounted++; },
    audioEditor: { open: async () => ({ status: 'cancelled' }) },
    promptEditor: { open: async () => ({ status: 'cancelled' }) },
    applySettings: value => applied.push(value),
  };
  const request = async (url, options = {}) => {
    calls.push({ url, method: options.method || 'GET', body: options.body });
    if (url === '/dsh-whale/audio.json') return catalog();
    if (options.method === 'PUT') {
      const current = bundle();
      return { ok: true, schemaVersion: 2,
        size: { ...current.size, ...options.body.patch.size },
        usage: { ...current.usage, ...options.body.patch.usage } };
    }
    return bundle();
  };
  const controller = new SoundSettingsController({
    windowRef, documentRef: windowRef.document, legacy, request,
    player: { play() {}, stop() {} },
    createMenuEntry: ({ onOpen }) => ({ element: {}, onOpen, setLoading: (...args) => loading.push(args), destroy() {} }),
    createView: options => { viewOptions = options; return { destroy() { destroyed++; } }; },
  });
  controller.start();
  await controller.open();
  viewOptions.onClose('cancelled');
  assert.equal(calls.filter(call => call.method === 'PUT').length, 0);
  await controller.open();
  controller.draft.vol = .25;
  await viewOptions.onSave();
  const writes = calls.filter(call => call.method === 'PUT');
  assert.equal(writes.length, 1);
  assert.equal(writes[0].url, '/api/sound-settings');
  assert.equal(writes[0].body.patch.size.vol, .25);
  assert.equal(applied.length, 1);
  assert.equal(dispatched.filter(event => event.type === 'whale-sound-settings-applied').length, 1);
  controller.dispose();
  assert.equal(unmounted, 1);
  assert.ok(destroyed >= 1);
  assert.ok(loading.length >= 2);
});

test('mode changes cancel an in-flight sound settings open before it can mount a late view', async () => {
  const windowRef = eventWindow(), loading = [];
  let resolveSettings, resolveCatalog, views = 0;
  const request = url => new Promise(resolve => {
    if (url === '/api/sound-settings') resolveSettings = resolve;
    else resolveCatalog = resolve;
  });
  const legacy = {
    mountMenuEntry: () => () => {},
    audioEditor: { open: async () => ({ status: 'cancelled' }) },
    promptEditor: { open: async () => ({ status: 'cancelled' }) },
    applySettings() {},
  };
  const controller = new SoundSettingsController({
    windowRef, documentRef: windowRef.document, legacy, request,
    player: { play() {}, stop() {} },
    createMenuEntry: () => ({ element: {}, setLoading: (...args) => loading.push(args), destroy() {} }),
    createView: () => { views++; return { destroy() {} }; },
  });
  controller.start();
  const opening = controller.open();
  windowRef.dispatch('whale-mode-changing');
  resolveSettings(bundle()); resolveCatalog(catalog());
  await opening;
  assert.equal(views, 0);
  assert.equal(controller.view, null);
  assert.deepEqual(loading.at(-1), [false]);
  controller.dispose();
});

function eventWindow() {
  const listeners = new Map(), audioCalls = [];
  return {
    document: { hidden: false },
    WhaleAudio: { play: value => audioCalls.push(value) },
    Audio: class {},
    addEventListener(type, listener) { (listeners.get(type) || listeners.set(type, new Set()).get(type)).add(listener); },
    removeEventListener(type, listener) { listeners.get(type)?.delete(listener); },
    dispatch(type, detail) { for (const listener of listeners.get(type) || []) listener({ detail }); },
    listenerCount(type) { return listeners.get(type)?.size || 0; },
    audioCalls,
  };
}

test('wait notice controller deduplicates pending prompts, applies settings and disposes its lifecycle', async () => {
  const windowRef = eventWindow(), shown = [], hidden = [], scheduled = [];
  let settingsReads = 0, waitReads = 0;
  const currentUsage = usage();
  currentUsage.events.question.soundOn = true;
  const request = async url => {
    if (url === '/api/sound-settings') { settingsReads++; return { usage: currentUsage }; }
    waitReads++;
    return { pending: { id: 'pending-1', kind: 'question', sessionLabel: '合成会话' } };
  };
  const controller = new WaitNoticeController({
    windowRef,
    request,
    legacyUsage: () => ({ showWait: value => shown.push(value), hideWait: id => hidden.push(id) }),
    schedule: fn => { scheduled.push(fn); return scheduled.length; },
    cancelSchedule() {},
  });
  await controller.tick();
  await controller.tick();
  assert.equal(settingsReads, 1);
  assert.equal(waitReads, 2);
  assert.equal(shown.length, 1);
  assert.equal(windowRef.audioCalls.length, 1);
  controller.start();
  assert.equal(windowRef.listenerCount('whale-sound-settings-applied'), 1);
  windowRef.dispatch('whale-sound-settings-applied', { usage: currentUsage });
  assert.deepEqual(hidden, ['pending-1']);
  controller.dispose();
  assert.equal(windowRef.listenerCount('whale-sound-settings-applied'), 0);
  const before = scheduled.length;
  await controller.tick();
  assert.equal(scheduled.length, before);
});
