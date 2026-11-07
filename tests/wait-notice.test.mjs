import test from 'node:test';
import assert from 'node:assert/strict';
import { WaitNoticeController, createWaitNotice } from '../desktop/ui/features/widget/wait-notice.js';
import { createSoundService } from '../desktop/ui/services/sound.js';

const usage = () => ({
  taskEnd: { on: false, sel: 'preset:duck:press', vol: 1, volSet: false },
  events: {
    press: { vol: 1 },
    question: { on: true, soundOn: false, sel: 'preset:duck:press', vol: 1, bubbleOn: true, lines: [] },
    approval: { on: true, soundOn: false, sel: 'preset:duck:press', vol: 1, bubbleOn: true, lines: [] },
  },
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

test('wait notice deduplicates pending prompts and uses applied settings without re-reading them', async () => {
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
    sound: createSoundService({ engine: windowRef.WhaleAudio }),
    request,
    settings: currentUsage,
    bubble: { showWait: value => shown.push(value), hideWait: id => hidden.push(id) },
    schedule: fn => { scheduled.push(fn); return scheduled.length; },
    cancelSchedule() {},
  });
  assert.equal(typeof createWaitNotice, 'function');
  await controller.tick();
  await controller.tick();
  assert.equal(settingsReads, 0, 'started with a saved snapshot, so no settings read happens');
  assert.equal(waitReads, 2);
  assert.equal(shown.length, 1);
  assert.equal(windowRef.audioCalls.length, 1);
  controller.start();
  assert.equal(windowRef.listenerCount('whale-wait-dismissed'), 1);
  controller.applySettings({ usage: currentUsage });
  assert.deepEqual(hidden, ['pending-1']);
  controller.dispose();
  assert.equal(windowRef.listenerCount('whale-wait-dismissed'), 0);
  const before = scheduled.length;
  await controller.tick();
  assert.equal(scheduled.length, before);
});

test('a delayed initial settings read cannot replace a newer saved sound snapshot', async () => {
  const windowRef = eventWindow(), service = createSoundService();
  let resolveRead;
  const old = { size: { soundSet: 'old', vol: .9 }, usage: { taskEnd: { on: false } } };
  const saved = { size: { soundSet: 'new', vol: .2 }, usage: { taskEnd: { on: true } } };
  const controller = new WaitNoticeController({
    windowRef, sound: service, bubble: {}, schedule: () => 0,
    request: url => url === '/api/sound-settings' ? new Promise(resolve => { resolveRead = resolve; }) : Promise.resolve({ pending: null }),
  });
  const reading = controller.loadSettings();
  service.reload(saved); controller.applySettings(saved);
  resolveRead(old); await reading;
  assert.equal(service.snapshot().size.soundSet, 'new');
  assert.equal(service.snapshot().size.vol, .2);
  assert.equal(controller.settings.taskEnd.on, true);
  controller.dispose();
});

test('disposing during a settings read prevents a late reload or another request', async () => {
  const windowRef = eventWindow(), service = createSoundService();
  let resolveRead, requests = 0;
  const controller = new WaitNoticeController({
    windowRef, sound: service, bubble: {}, schedule: () => 0,
    request: () => { requests++; return new Promise(resolve => { resolveRead = resolve; }); },
  });
  const reading = controller.loadSettings(); controller.dispose();
  resolveRead({ size: { soundSet: 'late' }, usage: {} }); await reading;
  assert.equal(service.snapshot().size.soundSet, undefined);
  assert.equal(requests, 1);
});

test('runtime wait pushes drive the bubble and clear it without polling again', async () => {
  const windowRef = eventWindow(), shown = [], hidden = [];
  let requests = 0, subscriber = null;
  const feed = { subscribe(type, fn) { assert.equal(type, 'wait'); subscriber = fn; return () => { subscriber = null; }; } };
  const controller = new WaitNoticeController({
    windowRef, sound: createSoundService(), settings: usage(), runtimeFeed: feed,
    bubble: { showWait: value => shown.push(value), hideWait: id => hidden.push(id) },
    request: () => { requests++; return Promise.resolve({ pending: null }); },
  });
  controller.start();
  await new Promise(resolve => setTimeout(resolve, 0));
  assert.equal(requests, 1, 'one snapshot at startup, not a poll');
  subscriber({ ok: true, pending: { id: 'w1', kind: 'question', sessionLabel: '对话' } });
  assert.equal(shown.length, 1);
  subscriber({ ok: true, pending: null });
  assert.deepEqual(hidden, ['w1']);
  assert.equal(requests, 1);
  controller.dispose();
  assert.equal(subscriber, null, 'dispose unsubscribes from the runtime feed');
});
