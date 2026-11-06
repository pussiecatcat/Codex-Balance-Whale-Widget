import { sound } from './sound.js';
export { parseSoundReference, normalizeVolume } from './sound.js';

const PRESETS = Object.freeze([
  ['preset:duck:press', '小黄鸭·按下'],
  ['preset:duck:release', '小黄鸭·松开'],
  ['preset:fx1:press', '音效1·按下'],
  ['preset:fx1:release', '音效1·松开'],
]);

export const soundReferenceUrl = (value, options) => sound.referenceUrl(value, options);

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
