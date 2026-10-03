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
    const label = document.createElement('span');label.textContent = '音效与提示';opener.append(label);
    const button = document.createElement('button');button.type = 'button';button.className = 'dshwv-roleimport';
    button.textContent = '全局设置';button.addEventListener('click', open);opener.append(button);
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
        button.disabled = false;return;
      }
      button.disabled = false;button.textContent = '全局设置';button.title = '';
      const task = usage.settings.taskEnd || {};
      let draft = {
        sound: size.sound !== false, vol: Number.isFinite(size.vol) ? size.vol : .9,
        soundSet: size.soundSet || 'duck', turnCostOn: size.turnCostOn !== false,
        closeSeconds: Math.max(0, Math.round((size.turnCostCloseMs ?? 5000) / 1000)),
        taskOn: task.on === true, taskSel: task.sel || 'preset:duck:press',
        taskVol: task.volSet === true && Number.isFinite(task.vol) ? task.vol : Number.isFinite(size.vol) ? size.vol : .9,
        taskVolSet: task.volSet === true,
      };
      let feedbackDraft = window.WhaleFeedback?.snapshot?.() || window.WhaleFeedback?.defaults?.();
      const mask = document.createElement('div');mask.className = 'dshwv-bubmask whale-sound-mask';
      const card = document.createElement('div');card.className = 'dshwv-bubcard whale-sound-card';mask.append(card);
      const make = (parent, tag, text, cls) => { const el = document.createElement(tag);if (text) el.textContent = text;
        if (cls) el.className = cls;parent.append(el);return el; };
      make(card, 'div', '提示与音效设置', 'dshwv-bubtitle');
      const notice = make(card, 'p', '', 'whale-sound-error');notice.hidden = true;
      const rowOf = (parent, title) => make(parent, 'label', title, 'whale-sound-row');
      const check = (parent, checked, onChange) => {
        const input = document.createElement('input');input.type = 'checkbox';input.className = 'dshwv-check';
        input.checked = checked;input.addEventListener('change', () => onChange(input.checked));parent.prepend(input);return input;
      };
      const select = (parent, values, selected, onChange) => {
        const input = make(parent, 'select', '', 'dshwv-sound');
        for (const [value, label] of values) {const option = new Option(label, value);input.append(option);}
        input.value = selected;if (!input.value && values.length) input.value = values[0][0];
        input.addEventListener('change', () => onChange(input.value));return input;
      };
      const range = (parent, value, onChange) => {
        const input = make(parent, 'input', '', 'dshwv-range');input.type = 'range';input.min = '0';input.max = '1';input.step = '.01';
        input.value = String(value);const output = make(parent, 'span', Math.round(value * 100) + '%', 'dshwv-volpct');
        input.addEventListener('input', () => {output.textContent = Math.round(Number(input.value) * 100) + '%';onChange(Number(input.value));});
        return input;
      };
      const section = title => {const area = make(card, 'section', '', 'whale-sound-section');
        make(area, 'h3', title);return area;};
      const press = section('按压音效');
      const feelValues = [['balanced', '均衡'], ['crisp', '清脆'], ['soft', '柔和']];
      const feelSelect = select(rowOf(press, '按压手感'), feelValues, feedbackDraft.feel, value => {feedbackDraft.feel = value;});
      check(rowOf(press, '启用按压与松开音效'), draft.sound, value => {draft.sound = value;});
      const groups = audio.groups.map(group => [group.id, group.name || group.id]);
      const soundSetSelect = select(rowOf(press, '音效组'), groups, draft.soundSet, value => {draft.soundSet = value;});
      const masterVolume = range(rowOf(press, '按压音量'), draft.vol, value => {draft.vol = value;if (!draft.taskVolSet) draft.taskVol = value;});
      const pressPreview = make(press, 'button', '试听按压音效', 'dshwv-roleimport');pressPreview.type = 'button';
      pressPreview.onclick = () => preview('/dsh-whale/sound/press.mp3?set=' + encodeURIComponent(draft.soundSet), draft.vol);

      const advanced = document.createElement('details');advanced.className = 'whale-sound-advanced';
      const advancedTitle = document.createElement('summary');advancedTitle.textContent = '事件音色与独立音量';advanced.append(advancedTitle);card.append(advanced);
      const eventControls = {};
      const eventNames = {press:'按下',release:'松开',success:'完成',cancelled:'取消',failed:'拥挤失败'};
      const eventUrl = event => event === 'press' || event === 'release'
        ? '/dsh-whale/sound/' + event + '.mp3?set=' + encodeURIComponent(draft.soundSet)
        : event === 'success' ? soundUrl(draft.taskSel) : '';
      for (const event of Object.keys(eventNames)) {
        const area = section(eventNames[event]);advanced.append(area);
        const toneValues = [
          ...(['press','release','success'].includes(event) ? [['original','现有音效']] : []),
          ['pearl','珍珠'],['bubble','水泡'],['glass','风铃'],['silent','静音'],
        ];
        const toneRow = rowOf(area, '音色');
        const tone = select(toneRow, toneValues, feedbackDraft.events[event].preset, value => {feedbackDraft.events[event].preset = value;});
        const audition = make(toneRow, 'button', '试听', 'dshwv-roleimport');audition.type = 'button';
        audition.onclick = eventObject => {eventObject.preventDefault();window.WhaleFeedback.play(event, eventUrl(event), 1, feedbackDraft);};
        const volumeRow = rowOf(area, '独立音量');
        const volume = range(volumeRow, feedbackDraft.events[event].volume, value => {feedbackDraft.events[event].volume = value;});
        eventControls[event] = {tone, volume, output: volumeRow.querySelector('span')};
      }

      const complete = section('每轮消耗提示');
      check(rowOf(complete, window.WhaleAccountView?.mode === 'subscription' ? '显示本轮 token 泡泡' : '显示本轮消耗泡泡'), draft.turnCostOn, value => {draft.turnCostOn = value;});
      const closeRow = rowOf(complete, '自动关闭（秒，0 为手动关闭）');
      const closeInput = make(closeRow, 'input', '', 'dshwv-number');closeInput.type = 'number';closeInput.min = '0';
      closeInput.max = '3600';closeInput.step = '1';closeInput.value = String(draft.closeSeconds);
      closeInput.addEventListener('input', () => {draft.closeSeconds = Number(closeInput.value);});
      check(rowOf(complete, '完成时播放提示音'), draft.taskOn, value => {draft.taskOn = value;});
      const sounds = [
        ...audio.groups.map(group => ['grp:' + group.id, (group.name || group.id) + '（点按）']),
        ['preset:duck:press', '小黄鸭·按下'],['preset:duck:release', '小黄鸭·松开'],
        ['preset:fx1:press', '音效1·按下'],['preset:fx1:release', '音效1·松开'],
        ...(audio.fragments || []).filter(fragment => !fragment.preset).map(fragment => ['frag:' + fragment.id, fragment.name || fragment.id]),
      ];
      const taskSoundSelect = select(rowOf(complete, '提示音'), sounds, draft.taskSel, value => {draft.taskSel = value;});
      const taskVolume = range(rowOf(complete, '提示音量'), draft.taskVol, value => {draft.taskVol = value;draft.taskVolSet = true;});
      const taskPreview = make(complete, 'button', '试听完成提示', 'dshwv-roleimport');taskPreview.type = 'button';
      taskPreview.onclick = () => preview(soundUrl(draft.taskSel), draft.taskVol);
      const contentEdit = make(complete, 'button', '自定义每轮提示内容', 'dshwv-roleimport');contentEdit.type = 'button';
      contentEdit.onclick = () => { close(); window.dispatchEvent(new Event('whale-edit-turn-cost')); };
      const actions = make(card, 'div', '', 'dshwv-bubbtns');
      const action = (text, cls, fn) => {const el = make(actions, 'button', text, 'dshwv-bubbtn ' + cls);el.type = 'button';el.onclick = fn;return el;};
      const close = () => {mask.remove();previewAudio?.pause();previewAudio = null;document.removeEventListener('keydown', escape, true);};
      action('取消', 'dshwv-bubbtn-no', close);
      action('恢复默认', 'dshwv-bubbtn-no', openDefault);
      const save = action('保存', 'dshwv-bubbtn-ok', async () => {
        const seconds = Number(closeInput.value);
        if (!Number.isInteger(seconds) || seconds < 0 || seconds > 3600) {closeInput.reportValidity();return;}
        save.disabled = true;notice.hidden = true;
        const sizeNext = {...size, sound: draft.sound, vol: draft.vol, soundSet: draft.soundSet,
          turnCostOn: draft.turnCostOn, turnCostCloseMs: seconds * 1000};
        const taskNext = {...task, on: draft.taskOn, sel: draft.taskSel,
          vol: draft.taskVol, volSet: draft.taskVolSet};
        try {
          await json(sizeUrl, sizeNext);
          try {await json(usageUrl, {taskEnd: taskNext});}
          catch (error) {await json(sizeUrl, size);throw error;}
          try {window.WhaleFeedback.save(feedbackDraft);}
          catch (error) {await Promise.allSettled([json(sizeUrl, size), json(usageUrl, {taskEnd: task})]);throw error;}
          window.dispatchEvent(new CustomEvent('whale-sound-settings-applied', {detail:{...sizeNext, taskEnd:taskNext}}));
          close();
        } catch (error) {notice.textContent = error.message;notice.hidden = false;save.disabled = false;}
      });
      const escape = event => {if (event.key === 'Escape') {event.preventDefault();close();}};
      document.addEventListener('keydown', escape, true);
      mask.addEventListener('click', event => {if (event.target === mask) close();});
      document.body.append(mask);
      window.WhaleRendering?.presentFor(350);

      function openDefault() {
        draft={sound:true,vol:.9,soundSet:'duck',turnCostOn:true,closeSeconds:5,
          taskOn:false,taskSel:'preset:duck:press',taskVol:.9,taskVolSet:false};
        feedbackDraft=window.WhaleFeedback.defaults();
        openWithDraft(draft);
      }
      function openWithDraft(next) {
        // A reset changes the draft only. Reopen the same panel with its current controls.
        closeInput.value=String(next.closeSeconds);
        const inputs=[...card.querySelectorAll('input[type=checkbox]')];
        [next.sound,next.turnCostOn,next.taskOn].forEach((value,index)=>{inputs[index].checked=value;});
        soundSetSelect.value=next.soundSet;
        taskSoundSelect.value=next.taskSel;
        masterVolume.value=String(next.vol);masterVolume.dispatchEvent(new Event('input'));
        taskVolume.value=String(next.taskVol);taskVolume.dispatchEvent(new Event('input'));
        feelSelect.value=feedbackDraft.feel;
        for(const [event, controls] of Object.entries(eventControls)) {
          controls.tone.value=feedbackDraft.events[event].preset;
          controls.volume.value=String(feedbackDraft.events[event].volume);
          controls.output.textContent=Math.round(feedbackDraft.events[event].volume*100)+'%';
        }
        next.taskVolSet=false;
      }
    }
    let previewAudio = null;
    function soundUrl(value) {
      if (value.startsWith('grp:')) return '/dsh-whale/sound/press.mp3?set=' + encodeURIComponent(value.slice(4));
      if (value.startsWith('frag:')) return '/dsh-whale/audio-fragment.wav?id=' + encodeURIComponent(value.slice(5));
      if (value.startsWith('preset:')) {const [,group,event] = value.split(':');
        return '/dsh-whale/sound/' + (event === 'release' ? 'release' : 'press') + '.mp3?set=' + encodeURIComponent(group);}
      return '';
    }
    function preview(url, volume) {
      previewAudio?.pause();if (!url)return;
      previewAudio = new Audio(url);previewAudio.volume = Math.max(0, Math.min(1, volume));
      previewAudio.play().catch(() => {});
    }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, {once:true});else init();
})();
