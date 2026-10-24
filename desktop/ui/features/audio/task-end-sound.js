// playFeedback returns true when the shared channel accepted playback; false
// selects locally owned Audio instances, which are stopped by dispose().
export function createTaskEndSound(deps) {
  const {
    document, Audio, taskEndSelect, getTaskEndDrop,
    getUsageSettings, setUsageSettings, getAudioGroups, getAudioFragments,
    audioGroupName, getSoundState, playFeedback = () => false, rememberSuccessSource = () => {},
  } = deps;
  const players = new Set();
  let disposed = false;

  function release(audio) {
    if (!players.delete(audio)) return;
    audio.onended = audio.onerror = null;
    audio.pause();
  }

  function makeAudio(url, volume) {
    const audio = new Audio(url);
    audio.volume = volume;
    players.add(audio);
    audio.onended = audio.onerror = () => release(audio);
    return audio;
  }

  function startAudio(audio) {
    if (disposed) { release(audio); return; }
    try { Promise.resolve(audio.play()).catch(() => release(audio)); }
    catch { release(audio); }
  }

  function dispose() {
    if (disposed) return;
    disposed = true;
    for (const audio of players) release(audio);
  }

  function option(value, label) {
    const element = document.createElement('option');
    element.value = value;
    element.textContent = label;
    return element;
  }

  function fillOptions(preference) {
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
    try { fillOptions(getUsageSettings()?.taskEnd || null); } catch (error) {}
  }

  function play() {
    if (disposed) return;
    try {
      const settings = getUsageSettings();
      const sound = getSoundState();
      if (!settings?.taskEnd?.on || sound.on === false) return;
      const selected = settings.taskEnd.sel || taskEndSelect.value || '';
      const volume = settings.taskEnd.volSet === true && Number.isFinite(Number(settings.taskEnd.vol))
        ? Math.max(0, Math.min(1, Number(settings.taskEnd.vol))) : sound.volume;
      let url = '';
      if (selected.startsWith('grp:')) {
        const groupId = selected.slice(4);
        if (!playFeedback('success', '/dsh-whale/sound/press.mp3?set=' + encodeURIComponent(groupId), volume)) playGroup(groupId, volume);
        return;
      }
      if (selected.startsWith('frag:')) url = '/dsh-whale/audio-fragment.wav?id=' + encodeURIComponent(selected.slice(5));
      else if (selected.startsWith('preset:')) {
        const parts = selected.split(':');
        url = '/dsh-whale/sound/' + (parts[2] === 'release' ? 'release' : 'press') + '.mp3?set=' + parts[1];
      }
      if (!url) return;
      rememberSuccessSource(url);
      if (playFeedback('success', url, volume)) return;
      startAudio(makeAudio(url, volume));
    } catch (error) {}
  }

  function playGroup(groupId, volume) {
    try {
      if (!groupId) return;
      const group = getAudioGroups().find(item => item?.id === groupId) || null;
      const pressEmpty = group?.press === '';
      const releaseEmpty = group?.release === '';
      if (pressEmpty && releaseEmpty) return;
      const level = Number.isFinite(Number(volume)) ? Number(volume) : getSoundState().volume;
      const make = kind => {
        return makeAudio('/dsh-whale/sound/' + kind + '.mp3?set=' + encodeURIComponent(groupId), level);
      };
      if (pressEmpty) {
        if (!releaseEmpty) startAudio(make('release'));
        return;
      }
      const press = make('press');
      if (releaseEmpty) {
        startAudio(press);
        return;
      }
      let played = false;
      press.onended = () => {
        release(press);
        if (disposed || played) return;
        played = true;
        startAudio(make('release'));
      };
      press.currentTime = 0;
      startAudio(press);
    } catch (error) {}
  }

  return Object.freeze({ fillOptions, refreshAfterAudio, play, dispose });
}
