(() => {
  'use strict';
  const sizeUrl = '/dsh-whale/size.json';
  const usageUrl = '/dsh-whale/usage-settings.json';
  const audioUrl = '/dsh-whale/audio.json';
  const json = async (url, body) => {
    const response = await fetch(url, body === undefined ? { cache: 'no-store' } : {
      method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    });
    const data = await response.json();
    if (!response.ok || data.ok === false) throw Error(data.error || '设置保存失败');
    return data;
  };
  function init() {
    const settings = document.querySelector('.dshwv-menuview');
    if (!settings) return;
    const rows = [...settings.querySelectorAll(':scope > .dshwv-menu-row')];
    const row = name => rows.find(element => element.textContent.trim().startsWith(name));
    const sourceRows = ['音效', '音量', '每轮消耗提示', '任务结束音效'].map(row).filter(Boolean);
    if (sourceRows.length !== 4) return;
    for (const element of sourceRows) element.hidden = true;
    const opener = document.createElement('div');
    opener.className = 'dshwv-menu-row whale-sound-entry';
    const label = document.createElement('span'); label.textContent = '音效与提示'; opener.append(label);
    const button = document.createElement('button'); button.type = 'button'; button.className = 'dshwv-roleimport';
    button.textContent = '全局设置'; button.addEventListener('click', open); opener.append(button);
    sourceRows[0].before(opener);

    async function open() {
      button.disabled = true;
      let size, usage, audio;
      try {
        [size, usage, audio] = await Promise.all([json(sizeUrl), json(usageUrl), json(audioUrl)]);
        if (!usage.settings || !Array.isArray(audio.groups)) throw Error('音效设置尚未准备好');
      } catch (error) {
        button.title = error.message;
        button.textContent = '读取失败，重试';
        button.disabled = false; return;
      }
      button.disabled = false; button.textContent = '全局设置'; button.title = '';
      const task = usage.settings.taskEnd || {};
      const loadedCloseSeconds = Math.max(0, Math.round((size.turnCostCloseMs ?? 5000) / 1000));
      let draft = {
        sound: size.sound !== false, vol: Number.isFinite(size.vol) ? size.vol : .9,
        soundSet: size.soundSet || 'duck', turnCostOn: size.turnCostOn !== false,
        closeEnabled: loadedCloseSeconds > 0, closeSeconds: loadedCloseSeconds || 5,
        taskOn: task.on === true, taskSel: task.sel || 'preset:duck:press',
        taskVol: task.volSet === true && Number.isFinite(task.vol) ? task.vol : Number.isFinite(size.vol) ? size.vol : .9,
        taskVolSet: task.volSet === true,
      };
      let feedbackDraft = window.WhaleFeedback?.snapshot?.() || window.WhaleFeedback?.defaults?.();
      const mask = document.createElement('div'); mask.className = 'dshwv-bubmask whale-sound-mask';
      const card = document.createElement('div'); card.className = 'dshwv-bubcard whale-sound-card'; mask.append(card);
      const make = (parent, tag, text, cls) => {
        const element = document.createElement(tag); if (text) element.textContent = text;
        if (cls) element.className = cls; parent.append(element); return element;
      };
      make(card, 'div', '提示与音效设置', 'dshwv-bubtitle whale-sound-title');
      const notice = make(card, 'p', '', 'whale-sound-error'); notice.hidden = true;
      const rowOf = (parent, title, className = '') => make(parent, 'label', title, 'whale-sound-row ' + className);
      const checkbox = (parent, checked, onChange, prepend = true) => {
        const input = document.createElement('input'); input.type = 'checkbox'; input.className = 'dshwv-check';
        input.checked = checked; input.addEventListener('change', () => onChange(input.checked));
        if (prepend) parent.prepend(input); else parent.append(input); return input;
      };
      const select = (parent, values, selected, onChange) => {
        const input = make(parent, 'select', '', 'dshwv-sound');
        for (const [value, optionLabel] of values) input.append(new Option(optionLabel, value));
        input.value = selected; if (!input.value && values.length) input.value = values[0][0];
        input.addEventListener('change', () => onChange(input.value)); return input;
      };
      const range = (parent, value, onChange) => {
        const input = make(parent, 'input', '', 'dshwv-range'); input.type = 'range'; input.min = '0'; input.max = '1'; input.step = '.01';
        input.value = String(value); const output = make(parent, 'span', Math.round(value * 100) + '%', 'dshwv-volpct');
        input.whaleOutput = output;
        input.addEventListener('input', () => { output.textContent = Math.round(Number(input.value) * 100) + '%'; onChange(Number(input.value)); });
        return input;
      };
      const block = (title, summaryText, checked, onToggle, expanded = true, cls = '') => {
        const details = make(card, 'details', '', 'whale-sound-block ' + cls); details.open = expanded;
        const summary = make(details, 'summary', '', 'whale-sound-block-head');
        let toggle = null;
        if (checked !== null) {
          toggle = checkbox(summary, checked, onToggle, false);
          toggle.addEventListener('click', event => event.stopPropagation());
        }
        make(summary, 'span', title, 'whale-sound-block-title');
        const status = make(summary, 'span', summaryText, 'whale-sound-block-summary');
        const body = make(details, 'div', '', 'whale-sound-block-body');
        return { details, body, summary, status, toggle };
      };
      const playButton = (parent, label, fn) => {
        const play = make(parent, 'button', '▶', 'whale-sound-play'); play.type = 'button'; play.title = label;
        play.setAttribute('aria-label', label); play.onclick = event => { event.preventDefault(); fn(); }; return play;
      };
      const groups = audio.groups.map(group => [group.id, group.name || group.id]);
      const groupName = value => groups.find(entry => entry[0] === value)?.[1] || value || '未选择';
      let pressEnable, bubbleEnable, closeEnable, taskEnable;
      let pressBlock, turnBlock;
      let soundSetSelect, masterVolume, pressPreview, contentEdit, closeInput, taskSoundSelect, taskVolume, taskPreview;
      const updatePressSummary = () => {
        if (pressBlock) pressBlock.status.textContent = draft.sound ? groupName(draft.soundSet) + ' · ' + Math.round(draft.vol * 100) + '%' : '已关闭';
      };
      const updateTurnSummary = () => {
        if (!turnBlock) return;
        const parts = [];
        if (draft.turnCostOn) parts.push(draft.closeEnabled ? '气泡 ' + draft.closeSeconds + 's' : '气泡手动关闭');
        if (draft.taskOn) parts.push('结束音');
        turnBlock.status.textContent = parts.length ? parts.join(' · ') : '已关闭';
      };
      const syncPress = value => {
        draft.sound = value;
        if (pressEnable && pressEnable.checked !== value) pressEnable.checked = value;
        for (const element of [soundSetSelect, masterVolume]) if (element) element.disabled = !value;
        if (pressPreview) pressPreview.disabled = !value; updatePressSummary();
      };
      const syncBubble = value => {
        draft.turnCostOn = value;
        for (const input of [turnBlock?.toggle, bubbleEnable]) if (input && input.checked !== value) input.checked = value;
        if (contentEdit) contentEdit.disabled = !value;
        if (closeEnable) closeEnable.disabled = !value;
        if (closeInput) closeInput.disabled = !value || !draft.closeEnabled;
        updateTurnSummary();
      };
      const syncClose = value => {
        draft.closeEnabled = value;
        if (closeEnable && closeEnable.checked !== value) closeEnable.checked = value;
        if (closeInput) closeInput.disabled = !draft.turnCostOn || !value; updateTurnSummary();
      };
      const syncTask = value => {
        draft.taskOn = value;
        if (taskEnable && taskEnable.checked !== value) taskEnable.checked = value;
        if (taskSoundSelect) taskSoundSelect.disabled = !value;
        if (taskVolume) taskVolume.disabled = !value;
        if (taskPreview) taskPreview.disabled = !value;
        updateTurnSummary();
      };

      pressBlock = block('按压音效', '', draft.sound, syncPress, true, 'whale-sound-press-block');
      pressEnable = pressBlock.toggle;
      const feelValues = [['balanced', '均衡'], ['crisp', '清脆'], ['soft', '柔和']];
      const feelSelect = select(rowOf(pressBlock.body, '按压手感'), feelValues, feedbackDraft.feel, value => { feedbackDraft.feel = value; });
      const groupRow = rowOf(pressBlock.body, '按压音效组', 'whale-sound-group-row');
      soundSetSelect = select(groupRow, groups, draft.soundSet, value => { draft.soundSet = value; updatePressSummary(); });
      const newGroup = make(groupRow, 'button', '新建音效组', 'dshwv-roleimport whale-sound-inline-button'); newGroup.type = 'button';
      const originalAudioEditor = sourceRows[0].querySelector('[title*="新建/编辑音效组"]');
      newGroup.onclick = event => { event.preventDefault(); close(); originalAudioEditor?.click(); };
      const pressVolumeRow = rowOf(pressBlock.body, '按压音量', 'whale-sound-volume-row');
      masterVolume = range(pressVolumeRow, draft.vol, value => { draft.vol = value; if (!draft.taskVolSet) draft.taskVol = value; updatePressSummary(); });
      pressPreview = playButton(pressVolumeRow, '试听按压音效', () => preview('/dsh-whale/sound/press.mp3?set=' + encodeURIComponent(draft.soundSet), draft.vol));
      updatePressSummary();

      turnBlock = block('每轮消耗提示', '', draft.turnCostOn, syncBubble, true, 'whale-sound-turn-block');
      const bubbleRow = rowOf(turnBlock.body, '气泡提示', 'whale-sound-action-row');
      bubbleEnable = checkbox(bubbleRow, draft.turnCostOn, syncBubble, false);
      contentEdit = make(bubbleRow, 'button', '编辑提示内容', 'dshwv-roleimport whale-sound-wide-action'); contentEdit.type = 'button';
      contentEdit.onclick = () => { close(); window.dispatchEvent(new Event('whale-edit-turn-cost')); };
      const closeRow = rowOf(turnBlock.body, '自动关闭', 'whale-sound-close-row');
      closeEnable = checkbox(closeRow, draft.closeEnabled, syncClose, false);
      closeInput = make(closeRow, 'input', '', 'dshwv-number'); closeInput.type = 'number'; closeInput.min = '1'; closeInput.max = '3600'; closeInput.step = '1'; closeInput.value = String(draft.closeSeconds);
      closeInput.addEventListener('input', () => { draft.closeSeconds = Number(closeInput.value); updateTurnSummary(); });
      make(closeRow, 'span', '秒', 'whale-sound-unit');
      const taskRow = rowOf(turnBlock.body, '任务结束音', 'whale-sound-task-row');
      taskEnable = checkbox(taskRow, draft.taskOn, syncTask, false);
      const sounds = [
        ...audio.groups.map(group => ['grp:' + group.id, (group.name || group.id) + '（点按）']),
        ['preset:duck:press', '小黄鸭·按下'], ['preset:duck:release', '小黄鸭·松开'],
        ['preset:fx1:press', '音效1·按下'], ['preset:fx1:release', '音效1·松开'],
        ...(audio.fragments || []).filter(fragment => !fragment.preset).map(fragment => ['frag:' + fragment.id, fragment.name || fragment.id]),
      ];
      taskSoundSelect = select(taskRow, sounds, draft.taskSel, value => { draft.taskSel = value; });
      taskPreview = playButton(taskRow, '试听任务结束音', () => preview(soundUrl(draft.taskSel), draft.taskVol));
      const taskVolumeRow = rowOf(turnBlock.body, '提示音量', 'whale-sound-volume-row');
      taskVolume = range(taskVolumeRow, draft.taskVol, value => { draft.taskVol = value; draft.taskVolSet = true; });
      updateTurnSummary();

      const advanced = block('事件音色与独立音量', '可选·按事件微调', null, null, false, 'whale-sound-advanced');
      const eventControls = {};
      const eventNames = { press: '按下', release: '松开', success: '完成', cancelled: '取消', failed: '拥挤失败' };
      const eventUrl = event => event === 'press' || event === 'release'
        ? '/dsh-whale/sound/' + event + '.mp3?set=' + encodeURIComponent(draft.soundSet)
        : event === 'success' ? soundUrl(draft.taskSel) : '';
      for (const event of Object.keys(eventNames)) {
        const area = make(advanced.body, 'section', '', 'whale-sound-event');
        make(area, 'h3', eventNames[event]);
        const toneValues = [
          ...(['press', 'release', 'success'].includes(event) ? [['original', '现有音效']] : []),
          ['pearl', '珍珠'], ['bubble', '水泡'], ['glass', '风铃'], ['silent', '静音'],
        ];
        const toneRow = rowOf(area, '音色');
        const tone = select(toneRow, toneValues, feedbackDraft.events[event].preset, value => { feedbackDraft.events[event].preset = value; });
        const audition = playButton(toneRow, '试听' + eventNames[event] + '音色', () => window.WhaleFeedback.play(event, eventUrl(event), 1, feedbackDraft));
        const volumeRow = rowOf(area, '独立音量', 'whale-sound-volume-row');
        const volume = range(volumeRow, feedbackDraft.events[event].volume, value => { feedbackDraft.events[event].volume = value; });
        eventControls[event] = { tone, audition, volume, output: volume.whaleOutput };
      }

      const actions = make(card, 'div', '', 'dshwv-bubbtns whale-sound-actions');
      const action = (text, cls, fn) => { const element = make(actions, 'button', text, 'dshwv-bubbtn ' + cls); element.type = 'button'; element.onclick = fn; return element; };
      const close = () => { mask.remove(); previewAudio?.pause(); previewAudio = null; document.removeEventListener('keydown', escape, true); };
      action('取消', 'dshwv-bubbtn-no', close);
      action('恢复默认', 'dshwv-bubbtn-no', openDefault);
      const save = action('保存', 'dshwv-bubbtn-ok', async () => {
        const seconds = Number(closeInput.value);
        if (draft.closeEnabled && (!Number.isInteger(seconds) || seconds < 1 || seconds > 3600)) { closeInput.reportValidity(); return; }
        save.disabled = true; notice.hidden = true;
        const savedSeconds = draft.closeEnabled ? seconds : 0;
        const sizeNext = { ...size, sound: draft.sound, vol: draft.vol, soundSet: draft.soundSet,
          turnCostOn: draft.turnCostOn, turnCostCloseMs: savedSeconds * 1000 };
        const taskNext = { ...task, on: draft.taskOn, sel: draft.taskSel,
          vol: draft.taskVol, volSet: draft.taskVolSet };
        try {
          await json(sizeUrl, sizeNext);
          try { await json(usageUrl, { taskEnd: taskNext }); }
          catch (error) { await json(sizeUrl, size); throw error; }
          try { window.WhaleFeedback.save(feedbackDraft); }
          catch (error) { await Promise.allSettled([json(sizeUrl, size), json(usageUrl, { taskEnd: task })]); throw error; }
          window.dispatchEvent(new CustomEvent('whale-sound-settings-applied', { detail: { ...sizeNext, taskEnd: taskNext } }));
          close();
        } catch (error) { notice.textContent = error.message; notice.hidden = false; save.disabled = false; }
      });
      const escape = event => { if (event.key === 'Escape') { event.preventDefault(); close(); } };
      document.addEventListener('keydown', escape, true);
      mask.addEventListener('click', event => { if (event.target === mask) close(); });
      document.body.append(mask);
      window.WhaleRendering?.presentFor(350);
      syncPress(draft.sound); syncBubble(draft.turnCostOn); syncClose(draft.closeEnabled); syncTask(draft.taskOn);

      function openDefault() {
        draft = { sound: true, vol: .9, soundSet: 'duck', turnCostOn: true, closeEnabled: true, closeSeconds: 5,
          taskOn: false, taskSel: 'preset:duck:press', taskVol: .9, taskVolSet: false };
        feedbackDraft = window.WhaleFeedback.defaults();
        openWithDraft(draft);
      }
      function openWithDraft(next) {
        closeInput.value = String(next.closeSeconds);
        soundSetSelect.value = next.soundSet;
        taskSoundSelect.value = next.taskSel;
        masterVolume.value = String(next.vol); masterVolume.whaleOutput.textContent = Math.round(next.vol * 100) + '%';
        taskVolume.value = String(next.taskVol); taskVolume.whaleOutput.textContent = Math.round(next.taskVol * 100) + '%';
        feelSelect.value = feedbackDraft.feel;
        for (const [event, controls] of Object.entries(eventControls)) {
          controls.tone.value = feedbackDraft.events[event].preset;
          controls.volume.value = String(feedbackDraft.events[event].volume);
          controls.output.textContent = Math.round(feedbackDraft.events[event].volume * 100) + '%';
        }
        next.taskVolSet = false;
        syncPress(next.sound); syncBubble(next.turnCostOn); syncClose(next.closeEnabled); syncTask(next.taskOn);
      }
    }
    let previewAudio = null;
    function soundUrl(value) {
      if (value.startsWith('grp:')) return '/dsh-whale/sound/press.mp3?set=' + encodeURIComponent(value.slice(4));
      if (value.startsWith('frag:')) return '/dsh-whale/audio-fragment.wav?id=' + encodeURIComponent(value.slice(5));
      if (value.startsWith('preset:')) { const [, group, event] = value.split(':');
        return '/dsh-whale/sound/' + (event === 'release' ? 'release' : 'press') + '.mp3?set=' + encodeURIComponent(group); }
      return '';
    }
    function preview(url, volume) {
      previewAudio?.pause(); if (!url) return;
      previewAudio = new Audio(url); previewAudio.volume = Math.max(0, Math.min(1, volume));
      previewAudio.play().catch(() => {});
    }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true }); else init();
})();
