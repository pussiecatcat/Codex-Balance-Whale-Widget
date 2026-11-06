// The only renderer owner of sound URLs, playback channels and catalog updates.
export function parseSoundReference(value) {
  const source = String(value || '');
  if (source.startsWith('grp:') && source.length > 4) return { kind: 'group', id: source.slice(4) };
  if (source.startsWith('frag:') && source.length > 5) return { kind: 'fragment', id: source.slice(5) };
  const parts = source.split(':');
  if (parts.length === 3 && parts[0] === 'preset' && parts[1] && ['press', 'release'].includes(parts[2])) {
    return { kind: 'preset', groupId: parts[1], event: parts[2] };
  }
  return null;
}

export function normalizeVolume(value, fallback = 1) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(0, Math.min(1, number)) : fallback;
}

const copy = value => JSON.parse(JSON.stringify(value));

export function createSoundService({ engine = null } = {}) {
  let state = { size: {}, usage: {}, feedback: {}, catalog: { groups: [], fragments: [] } };
  const listeners = new Set();

  function reload(snapshot = {}) {
    for (const key of ['size', 'usage', 'feedback']) {
      if (snapshot[key]) state[key] = copy(snapshot[key]);
    }
    const catalog = snapshot.catalog || (Array.isArray(snapshot.groups) ? snapshot : null);
    if (catalog) state.catalog = copy({ groups: catalog.groups || [], fragments: catalog.fragments || [] });
    const current = copy(state);
    for (const listener of listeners) listener(current);
    return current;
  }

  function urlFor({ groupId, slot = 'press', catalog = state.catalog } = {}) {
    if (!groupId) return '';
    slot = slot === 'release' ? 'release' : 'press';
    const group = catalog.groups?.find(item => item?.id === groupId);
    const fragmentId = group?.[slot];
    if (fragmentId === '') return '';
    const identity = typeof fragmentId === 'string' ? '&frag=' + encodeURIComponent(fragmentId) : '';
    return '/dsh-whale/sound/' + slot + '.mp3?set=' + encodeURIComponent(groupId) + identity;
  }

  function referenceUrl(value, { groupSlot = 'press', catalog } = {}) {
    if (typeof value === 'string' && value.startsWith('/')) return value;
    const ref = typeof value === 'string' ? parseSoundReference(value) : value;
    if (!ref) return '';
    if (ref.kind === 'fragment') return ref.id ? '/dsh-whale/audio-fragment.wav?id=' + encodeURIComponent(ref.id) : '';
    if (ref.kind === 'group') return urlFor({ groupId: ref.id, slot: groupSlot, catalog });
    if (ref.kind === 'preset') return urlFor({ groupId: ref.groupId, slot: ref.event, catalog });
    return '';
  }

  function preview(ref, volume = 1, options = {}) {
    const url = referenceUrl(ref, options);
    const { channel = 'preview', preset = 'original', onended } = options;
    if (preset === 'original' && !url) {
      engine?.stop(channel);
      onended?.();
      return Promise.resolve(false);
    }
    return Promise.resolve(engine?.play({ channel, url, preset, volume: normalizeVolume(volume), onended }));
  }

  function play(event, options = {}) {
    const gesture = event === 'press' || event === 'release';
    const config = (options.feedback || state.feedback).events?.[event];
    const preset = options.preset || config?.preset || 'original';
    const master = options.volume ?? (state.size.sound === false ? 0 : normalizeVolume(state.size.vol, .9));
    const volume = preset === 'silent' ? 0 : normalizeVolume(master) * normalizeVolume(config?.volume, 1);
    const ref = options.ref || (gesture ? { kind: 'group', id: state.size.soundSet || 'duck' } : null);
    return preview(options.url ?? ref, volume, {
      groupSlot: gesture ? event : 'press', channel: gesture ? 'gesture' : 'notice', preset, ...options,
    });
  }

  return Object.freeze({
    reload, urlFor, referenceUrl, play, preview,
    attachEngine(value) { engine = value; },
    stop(channel) { engine?.stop(channel); },
    warm(ref, options) { const url = referenceUrl(ref, options); return url ? Promise.resolve(engine?.warm?.(url)) : Promise.resolve(null); },
    subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener); },
    snapshot() { return copy(state); },
  });
}

export const sound = createSoundService();
