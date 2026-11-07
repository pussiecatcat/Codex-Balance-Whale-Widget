import test from 'node:test';
import assert from 'node:assert/strict';
import { RequestError, requestJson } from '../desktop/ui/services/request.js';
import { parseSoundReference, soundReferenceUrl } from '../desktop/ui/services/sound-reference.js';
import { buildSoundSave, createSoundDraft } from '../desktop/ui/features/sound-settings/model.js';
import { SoundSettingsController } from '../desktop/ui/features/sound-settings/controller.js';
import { createSoundService } from '../desktop/ui/services/sound.js';

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
  ok: true, schemaVersion: 1, revision: 'rev-1',
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
  assert.equal(output.size.vol, .2);
  assert.equal(output.size.futureSize, 'keep');
  assert.deepEqual(output.usage.futureUsage, { keep: true });
  assert.equal(output.usage.events.question.soundOn, true);
  assert.equal(output.revision, 'rev-1');
});

test('sound controller mounts explicitly, cancel writes nothing and save performs one combined PUT', async () => {
  const calls = [], applied = [], loading = [];
  let viewOptions, unmounted = 0, destroyed = 0;
  const windowRef = { document: {} };
  const menu = { mountMenuEntry: () => () => { unmounted++; } };
  const audioEditor = { open: async () => ({ status: 'cancelled' }) };
  const promptEditor = { open: async () => ({ status: 'cancelled' }) };
  const request = async (url, options = {}) => {
    calls.push({ url, method: options.method || 'GET', body: options.body });
    if (url === '/dsh-whale/audio.json') return catalog();
    if (options.method === 'PUT') return { ...options.body, ok: true, revision: 'rev-2' };
    return bundle();
  };
  const controller = new SoundSettingsController({
    windowRef, documentRef: windowRef.document, menu, audioEditor, promptEditor, request,
    renderer: undefined, rendering: { presentFor() {} }, select: {},
    applySettings: value => applied.push(value), onApplied: value => applied.push(value),
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
  assert.equal(writes[0].body.size.vol, .25);
  assert.equal(applied.length, 2);
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
  const menu = { mountMenuEntry: () => () => {} };
  const audioEditor = { open: async () => ({ status: 'cancelled' }) };
  const promptEditor = { open: async () => ({ status: 'cancelled' }) };
  const controller = new SoundSettingsController({
    windowRef, documentRef: windowRef.document, menu, audioEditor, promptEditor, request,
    rendering: { presentFor() {} }, select: {},
    applySettings() {}, onApplied() {},
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

test('a completed save cannot close or overwrite a panel opened after a mode change', async () => {
  const windowRef = eventWindow(), views = [];
  let completeSave, reads = 0, stops = 0;
  windowRef.CustomEvent = class { constructor(type, init) { this.type = type; this.detail = init.detail; } };
  windowRef.dispatchEvent = event => windowRef.dispatch(event.type, event.detail);
  const controller = new SoundSettingsController({
    windowRef, documentRef: windowRef.document, sound: createSoundService(),
    menu: { mountMenuEntry: () => () => {} }, audioEditor: {}, promptEditor: {}, applySettings() {},
    request: async (url, options = {}) => {
      if (url.endsWith('audio.json')) return catalog();
      if (options.method === 'PUT') return new Promise(resolve => { completeSave = () => resolve({ ...options.body, revision: 'saved' }); });
      return { ...bundle(), revision: 'read-' + ++reads };
    },
    player: { play() {}, stop() { stops++; } },
    createMenuEntry: () => ({ element: {}, setLoading() {}, destroy() {} }),
    createView: () => { const view = { destroyed: false, destroy() { this.destroyed = true; } }; views.push(view); return view; },
  }).start();
  await controller.open();
  const saving = controller.save();
  windowRef.dispatch('whale-mode-changing');
  await controller.open();
  const newView = controller.view, stopsBeforeCompletion = stops;
  completeSave(); await saving;
  assert.equal(views[0].destroyed, true);
  assert.equal(controller.view, newView);
  assert.equal(newView.destroyed, false);
  assert.equal(controller.bundle.revision, 'read-2');
  assert.equal(stops, stopsBeforeCompletion, 'an old save must not stop the new view preview');
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
