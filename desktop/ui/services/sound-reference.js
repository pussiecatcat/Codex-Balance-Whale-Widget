const PRESETS = Object.freeze([
  ['preset:duck:press', '小黄鸭·按下'],
  ['preset:duck:release', '小黄鸭·松开'],
  ['preset:fx1:press', '音效1·按下'],
  ['preset:fx1:release', '音效1·松开'],
]);

export function parseSoundReference(value) {
  const source = String(value || '');
  if (source.startsWith('grp:') && source.length > 4) return { kind: 'group', id: source.slice(4) };
  if (source.startsWith('frag:') && source.length > 5) return { kind: 'fragment', id: source.slice(5) };
  if (source.startsWith('preset:')) {
    const parts = source.split(':');
    if (parts.length === 3 && parts[1] && (parts[2] === 'press' || parts[2] === 'release')) {
      return { kind: 'preset', groupId: parts[1], event: parts[2] };
    }
  }
  return null;
}

export function soundReferenceUrl(value, { groupSlot = 'press' } = {}) {
  const reference = typeof value === 'string' ? parseSoundReference(value) : value;
  if (!reference) return '';
  if (reference.kind === 'fragment') {
    return '/dsh-whale/audio-fragment.wav?id=' + encodeURIComponent(reference.id);
  }
  if (reference.kind === 'group') {
    const slot = groupSlot === 'release' ? 'release' : 'press';
    return '/dsh-whale/sound/' + slot + '.mp3?set=' + encodeURIComponent(reference.id);
  }
  if (reference.kind === 'preset') {
    return '/dsh-whale/sound/' + reference.event + '.mp3?set=' + encodeURIComponent(reference.groupId);
  }
  return '';
}

export function soundOptions(catalog = {}) {
  const groups = Array.isArray(catalog.groups) ? catalog.groups : [];
  const fragments = Array.isArray(catalog.fragments) ? catalog.fragments : [];
  return [
    ...groups.filter(group => group?.id).map(group => ({
      value: 'grp:' + group.id,
      label: String(group.name || group.id) + '（点按）',
    })),
    ...PRESETS.map(([value, label]) => ({ value, label })),
    ...fragments.filter(fragment => fragment?.id && !fragment.preset).map(fragment => ({
      value: 'frag:' + fragment.id,
      label: String(fragment.name || fragment.id),
    })),
  ];
}

export function normalizeVolume(value, fallback = 1) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(0, Math.min(1, number)) : fallback;
}
