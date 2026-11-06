import { sound as defaultSound } from '../../services/sound.js';

export function createTaskEndSound(deps) {
  const {
    document, taskEndSelect, getTaskEndDrop, sound = defaultSound,
    getUsageSettings, setUsageSettings, getAudioGroups, getAudioFragments,
    audioGroupName, getSoundState,
  } = deps;

  function option(value, label) {
    const element = document.createElement('option');
    element.value = value;
    element.textContent = label;
    return element;
  }

  function fillOptions(preference) {
    if (!taskEndSelect) return;
    let settings = getUsageSettings();
    const preferred = settings?.taskEnd?.sel || preference?.sel || '';
    const current = taskEndSelect.value || preferred || '';
    taskEndSelect.innerHTML = '';
    const values = new Set();
    const labels = new Set();
    function add(value, label) {
      if (values.has(value) || labels.has(label)) return;
      values.add(value);
      labels.add(label);
      taskEndSelect.appendChild(option(value, label));
    }
    const groups = Array.isArray(getAudioGroups()) ? getAudioGroups() : [];
    for (const group of groups) {
      if (!group?.id) continue;
      const value = 'grp:' + group.id;
      if (values.has(value)) continue;
      values.add(value);
      taskEndSelect.appendChild(option(value, String(group.name || audioGroupName(group.id)) + '（点按）'));
    }
    for (const preset of [['preset:duck:press', '小黄鸭·按下'], ['preset:duck:release', '小黄鸭·松开'],
      ['preset:fx1:press', '音效1·按下'], ['preset:fx1:release', '音效1·松开']]) add(preset[0], preset[1]);
    const fragments = Array.isArray(getAudioFragments()) ? getAudioFragments() : [];
    for (const fragment of fragments) {
      if (!fragment?.id || fragment.preset) continue;
      add('frag:' + fragment.id, String(fragment.name || fragment.id));
    }
    const fragmentCount = [...taskEndSelect.options].filter(item => String(item.value).startsWith('frag:')).length;
    let found = [...taskEndSelect.options].some(item => item.value === current);
    if (found) taskEndSelect.value = current;
    if (!found) {
      if (current.startsWith('frag:') && fragmentCount === 0 || current.startsWith('grp:') && groups.length === 0) {
        taskEndSelect.value = '';
        getTaskEndDrop()?.refresh();
        return;
      }
      let chosen = 'preset:duck:press';
      for (const item of taskEndSelect.options) {
        if (!item.value.startsWith('frag:')) continue;
        chosen = item.value;
        if (String(item.textContent || '') === 'entity') break;
      }
      taskEndSelect.value = chosen;
      settings ||= {};
      settings.taskEnd ||= { on: false, sel: '' };
      settings.taskEnd.sel = chosen;
      setUsageSettings(settings);
    }
    if (preference?.sel && [...taskEndSelect.options].some(item => item.value === preference.sel)) {
      taskEndSelect.value = preference.sel;
    }
    const seen = new Set();
    for (let index = taskEndSelect.options.length - 1; index >= 0; index--) {
      const value = taskEndSelect.options[index].value;
      if (seen.has(value)) taskEndSelect.remove(index);
      else seen.add(value);
    }
    getTaskEndDrop()?.refresh();
  }

  function refreshAfterAudio() {
    sound.reload({ catalog: { groups: getAudioGroups(), fragments: getAudioFragments() } });
    fillOptions(getUsageSettings()?.taskEnd || null);
  }

  function play() {
    const settings = getUsageSettings();
    const state = getSoundState();
    if (!settings?.taskEnd?.on || state.on === false) return;
    const selected = settings.taskEnd.sel || taskEndSelect?.value || '';
    const volume = settings.taskEnd.volSet === true && Number.isFinite(Number(settings.taskEnd.vol))
      ? Math.max(0, Math.min(1, Number(settings.taskEnd.vol))) : state.volume;
    sound.reload({ catalog: { groups: getAudioGroups(), fragments: getAudioFragments() } });
    return sound.play('success', { ref: selected, volume });
  }

  return Object.freeze({ fillOptions, refreshAfterAudio, play });
}
