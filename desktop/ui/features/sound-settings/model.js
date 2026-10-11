import { normalizeVolume, soundOptions } from '../../services/sound-reference.js';

export const clone = value => JSON.parse(JSON.stringify(value));

export function waitDefaultLines(kind) {
  return [
    { type: 'text', text: kind === 'approval' ? 'Codex 正在等你授权' : 'Codex 正在等你回答', size: 6, bold: true },
    { type: 'text', text: '{session}', size: 3, color: '#63719a' },
  ];
}

function available(value, options) {
  return options.some(option => option.value === value);
}

export function normalizeCatalog(catalog = {}) {
  return {
    groups: Array.isArray(catalog.groups) ? clone(catalog.groups) : [],
    fragments: Array.isArray(catalog.fragments) ? clone(catalog.fragments) : [],
  };
}

export function createSoundDraft(bundle, catalogInput) {
  if (!bundle || bundle.schemaVersion !== 2 || !bundle.size || !bundle.usage) {
    throw new Error('音效设置版本不受支持');
  }
  const size = bundle.size && typeof bundle.size === 'object' ? bundle.size : {};
  const usage = bundle.usage && typeof bundle.usage === 'object' ? bundle.usage : {};
  const catalog = normalizeCatalog(catalogInput);
  const options = soundOptions(catalog);
  const fallback = value => available(value, options) ? value : options[0]?.value || 'preset:duck:press';
  const defaultTask = fallback(available('frag:end_a', options) ? 'frag:end_a' : 'preset:duck:press');
  const defaultWait = fallback(available('frag:exp_orb', options) ? 'frag:exp_orb' : defaultTask);
  const events = usage.events || {};
  const task = usage.taskEnd || {};
  const closeSec = Math.max(0, Math.round(Number(size.turnCostCloseMs) / 1000 || 0));
  const waitEvent = (saved, kind) => ({
    on: saved?.on !== false,
    soundOn: saved?.soundOn === true,
    sel: fallback(saved?.sel || defaultWait),
    vol: normalizeVolume(saved?.vol, 1),
    bubbleOn: saved?.bubbleOn !== false,
    lines: clone(Array.isArray(saved?.lines) && saved.lines.length ? saved.lines : waitDefaultLines(kind)),
  });
  return {
    sound: size.sound !== false,
    vol: normalizeVolume(size.vol, .9),
    soundSet: size.soundSet || catalog.groups[0]?.id || 'duck',
    turnCostOn: size.turnCostOn !== false,
    closeOn: closeSec > 0,
    closeSec: closeSec || 5,
    taskEnd: { ...clone(task), on: task.on === true, sel: fallback(task.sel || defaultTask) },
    events: {
      press: { vol: normalizeVolume(events.press?.vol, 1) },
      turnCost: {
        vol: normalizeVolume(events.turnCost?.volSet === true ? events.turnCost.vol : size.vol, 1),
        volSet: events.turnCost?.volSet === true,
        bubbleOn: events.turnCost?.bubbleOn !== false,
        lines: clone(Array.isArray(usage.turnCost?.lines) ? usage.turnCost.lines : []),
      },
      question: waitEvent(events.question, 'question'),
      approval: waitEvent(events.approval, 'approval'),
    },
    wait: { charClose: usage.wait?.charClose === true },
    defaults: { task: defaultTask, wait: defaultWait },
  };
}

export function restoreSoundDefaults(draft) {
  draft.sound = true;
  draft.vol = 1;
  draft.turnCostOn = true;
  draft.closeOn = true;
  draft.closeSec = 180;
  draft.taskEnd.on = true;
  draft.taskEnd.sel = draft.defaults.task;
  Object.assign(draft.events.turnCost, { vol: 1, volSet: false, bubbleOn: true });
  for (const kind of ['question', 'approval']) {
    Object.assign(draft.events[kind], {
      on: true, soundOn: false, sel: draft.defaults.wait, vol: 1, bubbleOn: true,
    });
  }
  draft.wait.charClose = false;
  return draft;
}

function eventOutput(saved, value) {
  return {
    ...(saved || {}), on: value.on, soundOn: value.soundOn, sel: value.sel,
    vol: normalizeVolume(value.vol, 1), bubbleOn: value.bubbleOn, lines: clone(value.lines),
  };
}

export function buildSoundSave(bundle, draft) {
  const seconds = Number(draft.closeSec);
  if (!Number.isInteger(seconds) || seconds < 0 || seconds > 3600) {
    throw new Error('请输入 0 到 3600 之间的整数秒数');
  }
  const originalSize = bundle.size || {};
  const originalUsage = bundle.usage || {};
  const originalEvents = originalUsage.events || {};
  const size = {
    sound: draft.sound, vol: normalizeVolume(draft.vol, .9),
    soundSet: draft.soundSet, turnCostOn: draft.turnCostOn,
    turnCostCloseMs: draft.closeOn ? seconds * 1000 : 0,
  };
  const taskEnd = {
    ...(originalUsage.taskEnd || {}), ...clone(draft.taskEnd),
    vol: normalizeVolume(draft.events.turnCost.vol, 1), volSet: draft.events.turnCost.volSet,
  };
  const events = {
    ...clone(originalEvents),
    press: { ...(originalEvents.press || {}), vol: normalizeVolume(draft.vol, .9) },
    turnCost: {
      ...(originalEvents.turnCost || {}), vol: normalizeVolume(draft.events.turnCost.vol, 1),
      volSet: draft.events.turnCost.volSet, bubbleOn: draft.events.turnCost.bubbleOn,
    },
    question: eventOutput(originalEvents.question, draft.events.question),
    approval: eventOutput(originalEvents.approval, draft.events.approval),
  };
  const usage = {
    taskEnd, events,
    wait: { ...(originalUsage.wait || {}), charClose: draft.wait.charClose },
    turnCost: { ...(originalUsage.turnCost || {}), lines: clone(draft.events.turnCost.lines) },
  };
  // Only the fields above are written, and the values they were read from travel
  // with them. The server compares the two, so a setting changed elsewhere while
  // this panel was open no longer blocks a save that never touched it — and a
  // change to one of these fields is still caught.
  const base = { size: {}, usage: {} };
  for (const key of Object.keys(size)) base.size[key] = originalSize[key];
  for (const key of Object.keys(usage)) base.usage[key] = originalUsage[key];
  return { schemaVersion: 2, base, patch: { size, usage } };
}
