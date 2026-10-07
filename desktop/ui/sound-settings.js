(() => {
  'use strict';
  const sizeUrl = '/dsh-whale/size.json', usageUrl = '/dsh-whale/usage-settings.json', audioUrl = '/dsh-whale/audio.json';
  const clone = value => JSON.parse(JSON.stringify(value));
  const clamp = value => Math.max(0, Math.min(1, Number(value) || 0));
  const json = async (url, body) => {
    const response = await fetch(url, body === undefined ? { cache: 'no-store' } : {
      method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    });
    const data = await response.json();
    if (!response.ok || data.ok === false) throw Error(data.error || '设置保存失败');
    return data;
  };
  const waitLines = kind => [
    { type: 'text', text: kind === 'approval' ? 'Codex 正在等你授权' : 'Codex 正在等你回答', size: 6, bold: true },
    { type: 'text', text: '{session}', size: 3, color: '#63719a' },
  ];
  function soundOptions(groups, fragments) {
    return [
      ...groups.map(group => ['grp:' + group.id, (group.name || group.id) + '（点按）']),
      ['preset:duck:press', '小黄鸭·按下'], ['preset:duck:release', '小黄鸭·松开'],
      ['preset:fx1:press', '音效1·按下'], ['preset:fx1:release', '音效1·松开'],
      ...fragments.map(fragment => ['frag:' + fragment.id, fragment.name || fragment.id]),
    ];
  }
  function fillSelect(select, options, value) {
    select.innerHTML = '';
    options.forEach(([id, label]) => select.append(new Option(label, id)));
    if (value && !options.some(item => item[0] === value)) select.append(new Option('已保存音效', value));
    select.value = value || options[0]?.[0] || '';
    window.WhaleSelect?.refresh(select);
  }
  function soundUrl(value) {
    value = String(value || '');
    if (value.startsWith('grp:')) return '/dsh-whale/sound/press.mp3?set=' + encodeURIComponent(value.slice(4));
    if (value.startsWith('frag:')) return '/dsh-whale/audio-fragment.wav?id=' + encodeURIComponent(value.slice(5));
    if (value.startsWith('preset:')) {
      const [, group, event] = value.split(':');
      return '/dsh-whale/sound/' + (event === 'release' ? 'release' : 'press') + '.mp3?set=' + encodeURIComponent(group);
    }
    return '';
  }
  function init() {
    const settings = document.querySelector('.dshwv-menuview');
    if (!settings) return;
    const rows = [...settings.querySelectorAll(':scope > .dshwv-menu-row')];
    const source = label => rows.find(element => element.textContent.trim().startsWith(label));
    const sourceRows = ['音效', '音量', '每轮消耗提示', '任务结束音效'].map(source).filter(Boolean);
    if (sourceRows.length !== 4) return;
    sourceRows.forEach(element => { element.hidden = true; });
    const originalAudioEditor = sourceRows[0].querySelector('[title*="新建/编辑音效组"]');
    const opener = document.createElement('div'); opener.className = 'dshwv-menu-row whale-sound-entry';
    const label = document.createElement('span'); label.textContent = '音效与提示';
    const button = document.createElement('button'); button.type = 'button'; button.className = 'dshwv-roleimport'; button.textContent = '全局设置';
    opener.append(label, button); sourceRows[0].before(opener); button.addEventListener('click', open);

    async function open() {
      button.disabled = true;
      let size, usageReply, audio;
      try {
        [size, usageReply, audio] = await Promise.all([json(sizeUrl), json(usageUrl), json(audioUrl)]);
        if (!usageReply.settings || !Array.isArray(audio.groups)) throw Error('音效设置尚未准备好');
      } catch (error) {
        button.disabled = false; button.textContent = '读取失败，重试'; button.title = error.message; return;
      }
      button.disabled = false; button.textContent = '全局设置'; button.title = '';
      const usage = usageReply.settings, events = usage.events || {}, task = usage.taskEnd || {};
      let groups = audio.groups || [], fragments = (audio.fragments || []).filter(item => !item.preset);
      let sounds = soundOptions(groups, fragments);
      const fallback = value => sounds.some(item => item[0] === value) ? value : sounds[0]?.[0] || 'preset:duck:press';
      const defaultTask = fallback(sounds.some(item => item[0] === 'frag:end_a') ? 'frag:end_a' : 'preset:duck:press');
      const defaultWait = fallback(sounds.some(item => item[0] === 'frag:exp_orb') ? 'frag:exp_orb' : defaultTask);
      const closeSec = Math.max(0, Math.round(Number(size.turnCostCloseMs) / 1000 || 0));
      const eventDraft = (saved, kind, defaultSound) => {
        saved = saved || {};
        return {
          on: saved.on !== false, soundOn: saved.soundOn === true, sel: fallback(saved.sel || defaultSound),
          vol: Number.isFinite(Number(saved.vol)) ? clamp(saved.vol) : 1, bubbleOn: saved.bubbleOn !== false,
          lines: clone(Array.isArray(saved.lines) && saved.lines.length ? saved.lines : waitLines(kind)),
        };
      };
      let draft = {
        sound: size.sound !== false, vol: Number.isFinite(Number(size.vol)) ? clamp(size.vol) : .9,
        soundSet: size.soundSet || groups[0]?.id || 'duck', turnCostOn: size.turnCostOn !== false,
        closeOn: closeSec > 0, closeSec: closeSec || 5,
        taskEnd: { ...task, on: task.on === true, sel: fallback(task.sel || defaultTask) },
        events: {
          press: { vol: Number.isFinite(Number(events.press?.vol)) ? clamp(events.press.vol) : 1 },
          turnCost: {
            vol: clamp(events.turnCost?.volSet === true ? events.turnCost.vol : size.vol ?? 1),
            volSet: events.turnCost?.volSet === true, bubbleOn: events.turnCost?.bubbleOn !== false,
            lines: clone(usage.turnCost?.lines || []),
          },
          question: eventDraft(events.question, 'question', defaultWait),
          approval: eventDraft(events.approval, 'approval', defaultWait),
        },
        wait: { charClose: usage.wait?.charClose === true },
      };

      const mask = document.createElement('div'); mask.className = 'dshwv-bubmask whale-sound-mask';
      const card = document.createElement('div'); card.className = 'dshwv-bubcard whale-sound-card'; mask.append(card);
      const make = (parent, tag, text = '', cls = '') => {
        const element = document.createElement(tag); if (text) element.textContent = text; if (cls) element.className = cls; parent.append(element); return element;
      };
      make(card, 'div', '提示与音效设置', 'dshwv-bubtitle whale-sound-title');
      const notice = make(card, 'p', '', 'whale-sound-error'); notice.hidden = true;
      const entries = {}, controls = {};
      const entry = (kind, title, checked, change) => {
        const details = make(card, 'details', '', 'whale-sound-block');
        const summary = make(details, 'summary', '', 'whale-sound-block-head');
        const on = make(summary, 'input', '', 'dshwv-check'); on.type = 'checkbox'; on.checked = checked;
        on.addEventListener('click', event => event.stopPropagation());
        on.addEventListener('change', () => { change(on.checked); refresh(); });
        make(summary, 'span', title, 'whale-sound-block-title');
        const status = make(summary, 'span', '', 'whale-sound-block-summary');
        const body = make(details, 'div', '', 'whale-sound-block-body');
        return entries[kind] = { details, on, status, body };
      };
      const row = (parent, title, cls = '') => {
        const element = make(parent, 'div', '', 'whale-sound-row ' + cls); make(element, 'span', title, 'whale-sound-label'); return element;
      };
      const check = (parent, checked, fn) => {
        const element = make(parent, 'input', '', 'dshwv-check'); element.type = 'checkbox'; element.checked = checked;
        parent.prepend(element);
        element.addEventListener('change', () => { fn(element.checked); refresh(); }); return element;
      };
      const select = (parent, options, value, fn) => {
        const element = make(parent, 'select', '', 'dshwv-sound'); fillSelect(element, options, value);
        element.addEventListener('change', () => { fn(element.value); refresh(); }); return element;
      };
      const volume = (parent, value, fn) => {
        const input = make(parent, 'input', '', 'dshwv-range'); input.type = 'range'; input.min = '0'; input.max = '1'; input.step = '.05'; input.value = String(clamp(value));
        const output = make(parent, 'span', Math.round(clamp(value) * 100) + '%', 'dshwv-volpct');
        input.addEventListener('input', () => { output.textContent = Math.round(Number(input.value) * 100) + '%'; fn(Number(input.value)); refresh(); });
        return { input, output };
      };
      const play = (parent, title, fn) => {
        const element = make(parent, 'button', '▶', 'whale-sound-play'); element.type = 'button'; element.title = title; element.setAttribute('aria-label', title);
        element.addEventListener('click', event => { event.preventDefault(); event.stopPropagation(); fn(); }); return element;
      };
      const edit = (parent, kind, title, config, save) => {
        const element = make(parent, 'button', '编辑提示内容', 'dshwv-roleimport whale-sound-wide-action'); element.type = 'button'; element.title = title;
        element.addEventListener('click', event => {
          event.stopPropagation();
          window.dispatchEvent(new CustomEvent(kind === 'turnCost' ? 'whale-edit-sound-turn-cost' : 'whale-edit-sound-prompt', {
            detail: { key: kind, config: clone(config()), save },
          }));
        });
        return element;
      };

      const press = entry('press', '按压音效', draft.sound, value => { draft.sound = value; });
      const groupRow = row(press.body, '按压音效组', 'whale-sound-group-row');
      controls.group = select(groupRow, groups.map(item => [item.id, item.name || item.id]), draft.soundSet, value => { draft.soundSet = value; });
      controls.newGroup = make(groupRow, 'button', '新建音效组', 'dshwv-roleimport whale-sound-inline-button'); controls.newGroup.type = 'button';
      controls.newGroup.addEventListener('click', event => { event.stopPropagation(); openAudioEditor(); });
      const pressVolumeRow = row(press.body, '按压音量', 'whale-sound-volume-row');
      controls.pressVolume = volume(pressVolumeRow, draft.vol, value => { draft.vol = value; if (!draft.events.turnCost.volSet) syncTurnVolume(); });
      play(pressVolumeRow, '试听按压音效', () => preview('/dsh-whale/sound/press.mp3?set=' + encodeURIComponent(draft.soundSet), draft.vol));

      const turn = entry('turnCost', '每轮消耗提示', draft.turnCostOn, value => { draft.turnCostOn = value; });
      const turnBubbleRow = row(turn.body, '冒泡提示');
      controls.turnBubble = check(turnBubbleRow, draft.events.turnCost.bubbleOn, value => { draft.events.turnCost.bubbleOn = value; });
      edit(turnBubbleRow, 'turnCost', '编辑每轮消耗提示的泡泡内容', () => ({ lines: draft.events.turnCost.lines }), result => { draft.events.turnCost.lines = clone(result.lines || []); });
      const closeRow = row(turn.body, '自动关闭', 'whale-sound-close-row');
      controls.closeOn = check(closeRow, draft.closeOn, value => { draft.closeOn = value; });
      controls.closeSec = make(closeRow, 'input', '', 'dshwv-number'); controls.closeSec.type = 'number'; controls.closeSec.min = '0'; controls.closeSec.max = '3600'; controls.closeSec.step = '1'; controls.closeSec.value = String(draft.closeSec);
      controls.closeSec.addEventListener('input', () => { draft.closeSec = Math.max(0, Math.round(Number(controls.closeSec.value) || 0)); refresh(); });
      make(closeRow, 'span', '秒', 'whale-sound-unit');
      const taskRow = row(turn.body, '任务结束音', 'whale-sound-task-row');
      controls.taskOn = check(taskRow, draft.taskEnd.on, value => { draft.taskEnd.on = value; });
      controls.taskSelect = select(taskRow, sounds, draft.taskEnd.sel, value => { draft.taskEnd.sel = value; });
      play(taskRow, '试听任务结束音', () => preview(soundUrl(draft.taskEnd.sel), effectiveTurnVolume()));
      const taskVolumeRow = row(turn.body, '提示音量', 'whale-sound-volume-row');
      controls.taskVolume = volume(taskVolumeRow, effectiveTurnVolume(), value => { draft.events.turnCost.vol = value; draft.events.turnCost.volSet = true; });

      function waitSection(kind, title, soundTitle) {
        const cfg = draft.events[kind], block = entry(kind, title, cfg.on, value => { cfg.on = value; });
        const bubbleRow = row(block.body, '冒泡提示');
        controls[kind + 'Bubble'] = check(bubbleRow, cfg.bubbleOn, value => { cfg.bubbleOn = value; });
        edit(bubbleRow, kind, '编辑' + title + '的泡泡内容（{session} 表示当前对话）', () => cfg, result => { cfg.lines = clone(result.lines || []); });
        const soundRow = row(block.body, soundTitle, 'whale-sound-task-row');
        controls[kind + 'SoundOn'] = check(soundRow, cfg.soundOn, value => { cfg.soundOn = value; });
        controls[kind + 'Select'] = select(soundRow, sounds, cfg.sel, value => { cfg.sel = value; });
        play(soundRow, '试听' + soundTitle, () => preview(soundUrl(cfg.sel), cfg.vol));
        const volumeRow = row(block.body, '提示音量', 'whale-sound-volume-row');
        controls[kind + 'Volume'] = volume(volumeRow, cfg.vol, value => { cfg.vol = value; });
      }
      waitSection('question', '提问提示', '提问提示音效');
      waitSection('approval', '授权提示', '授权提示音');

      const charRow = make(card, 'div', '', 'whale-sound-charclose');
      controls.charClose = check(charRow, draft.wait.charClose, value => { draft.wait.charClose = value; });
      const charLabel = make(charRow, 'label', '点按角色关闭提示气泡');
      charLabel.addEventListener('click', () => { controls.charClose.checked = !controls.charClose.checked; controls.charClose.dispatchEvent(new Event('change')); });
      const help = make(charRow, 'button', '?', 'whale-sound-help'); help.type = 'button'; help.setAttribute('aria-label', '查看说明');
      const tip = make(charRow, 'div', '等待提问或授权时，默认点气泡即可收起，同一条挂起提示不会再次弹回。打开后，点角色也能收起提示气泡。', 'whale-sound-help-pop');
      help.addEventListener('click', event => { event.stopPropagation(); tip.classList.toggle('is-open'); });

      const actions = make(card, 'div', '', 'dshwv-bubbtns whale-sound-actions');
      const action = (text, cls, fn) => {
        const element = make(actions, 'button', text, 'dshwv-bubbtn ' + cls); element.type = 'button'; element.addEventListener('click', fn); return element;
      };
      const close = () => { stopPreview(); mask.remove(); document.removeEventListener('keydown', escape, true); };
      action('取消', 'dshwv-bubbtn-no', close);
      action('恢复默认', 'dshwv-bubbtn-no', restoreDefaults);
      const save = action('保存', 'dshwv-bubbtn-ok', async () => {
        const seconds = Number(controls.closeSec.value);
        if (!Number.isInteger(seconds) || seconds < 0 || seconds > 3600) {
          controls.closeSec.setCustomValidity('请输入 0 到 3600 之间的整数秒数'); controls.closeSec.reportValidity(); return;
        }
        controls.closeSec.setCustomValidity(''); save.disabled = true; notice.hidden = true;
        const sizeNext = { ...size, sound: draft.sound, vol: draft.vol, soundSet: draft.soundSet, turnCostOn: draft.turnCostOn, turnCostCloseMs: draft.closeOn ? seconds * 1000 : 0 };
        const taskNext = { ...task, on: draft.taskEnd.on, sel: draft.taskEnd.sel, vol: draft.events.turnCost.vol, volSet: draft.events.turnCost.volSet };
        const eventOut = (saved, value) => ({ ...(saved || {}), on: value.on, soundOn: value.soundOn, sel: value.sel, vol: value.vol, bubbleOn: value.bubbleOn, lines: clone(value.lines) });
        const eventsNext = {
          press: { ...(events.press || {}), vol: draft.vol },
          turnCost: { ...(events.turnCost || {}), vol: draft.events.turnCost.vol, volSet: draft.events.turnCost.volSet, bubbleOn: draft.events.turnCost.bubbleOn },
          question: eventOut(events.question, draft.events.question), approval: eventOut(events.approval, draft.events.approval),
        };
        const usagePatch = {
          taskEnd: taskNext, events: eventsNext, wait: { ...(usage.wait || {}), charClose: draft.wait.charClose },
          turnCost: { ...(usage.turnCost || {}), lines: clone(draft.events.turnCost.lines) },
        };
        try {
          await json(sizeUrl, sizeNext);
          try { await json(usageUrl, usagePatch); } catch (error) { await json(sizeUrl, size); throw error; }
          window.dispatchEvent(new CustomEvent('whale-sound-settings-applied', { detail: { ...sizeNext, taskEnd: taskNext, events: eventsNext, wait: usagePatch.wait } }));
          close();
        } catch (error) { notice.textContent = error.message; notice.hidden = false; save.disabled = false; }
      });
      const escape = event => {
        if (event.key === 'Escape' && !document.querySelector('.dshwv-audiomask[style*="flex"]')) { event.preventDefault(); close(); }
      };
      document.addEventListener('keydown', escape, true);
      mask.addEventListener('click', event => { if (event.target === mask) close(); });
      document.body.append(mask); window.WhaleRendering?.presentFor(350); refresh();

      function groupName(id) { return groups.find(item => item.id === id)?.name || id || '默认音效组'; }
      function selectedName(selectElement) { return selectElement?.selectedOptions?.[0]?.textContent || '—'; }
      function effectiveTurnVolume() { return draft.events.turnCost.volSet ? draft.events.turnCost.vol : draft.vol; }
      function syncTurnVolume() {
        if (!draft.events.turnCost.volSet && controls.taskVolume) {
          controls.taskVolume.input.value = String(draft.vol); controls.taskVolume.output.textContent = Math.round(draft.vol * 100) + '%';
        }
      }
      function setDisabled(control, disabled) {
        if (!control) return; const input = control.input || control; input.disabled = disabled;
        window.WhaleSelect?.sync(input);
        input.closest('.whale-sound-row')?.classList.toggle('is-dim', disabled);
      }
      function refresh() {
        entries.press.on.checked = draft.sound; entries.turnCost.on.checked = draft.turnCostOn;
        entries.question.on.checked = draft.events.question.on; entries.approval.on.checked = draft.events.approval.on;
        entries.press.status.textContent = draft.sound ? groupName(draft.soundSet) + ' · ' + Math.round(draft.vol * 100) + '%' : '已关闭';
        const auto = draft.closeOn && draft.closeSec > 0 ? '自动关 ' + draft.closeSec + 's' : '不自动关';
        entries.turnCost.status.textContent = !draft.turnCostOn ? '已关闭' : auto + ' · ' + (draft.taskEnd.on
          ? selectedName(controls.taskSelect) + (draft.events.turnCost.volSet ? (effectiveTurnVolume() !== 1 ? ' · ' + Math.round(effectiveTurnVolume() * 100) + '%' : '') : ' · 跟随按压音量 ' + Math.round(draft.vol * 100) + '%')
          : '当前为静音，在下拉设置中修改');
        for (const kind of ['question', 'approval']) {
          const cfg = draft.events[kind];
          entries[kind].status.textContent = !cfg.on ? '已关闭' : !cfg.soundOn ? '当前为静音，在下拉设置中修改'
            : selectedName(controls[kind + 'Select']) + (cfg.vol !== 1 ? ' · ' + Math.round(cfg.vol * 100) + '%' : '');
        }
        setDisabled(controls.group, !draft.sound); setDisabled(controls.newGroup, !draft.sound); setDisabled(controls.pressVolume, !draft.sound);
        setDisabled(controls.taskSelect, !draft.turnCostOn || !draft.taskEnd.on); setDisabled(controls.taskVolume, !draft.turnCostOn || !draft.taskEnd.on);
        for (const kind of ['question', 'approval']) {
          const off = !draft.events[kind].on || !draft.events[kind].soundOn;
          setDisabled(controls[kind + 'Select'], off); setDisabled(controls[kind + 'Volume'], off);
        }
        controls.closeSec.disabled = !draft.closeOn; syncTurnVolume();
      }
      function restoreDefaults() {
        draft.sound = true; draft.vol = 1; draft.turnCostOn = true; draft.closeOn = true; draft.closeSec = 180;
        draft.taskEnd.on = true; draft.taskEnd.sel = defaultTask;
        draft.events.turnCost = { ...draft.events.turnCost, vol: 1, volSet: false, bubbleOn: true };
        for (const kind of ['question', 'approval']) Object.assign(draft.events[kind], { on: true, soundOn: false, sel: defaultWait, vol: 1, bubbleOn: true });
        draft.wait.charClose = false;
        controls.group.value = draft.soundSet; controls.pressVolume.input.value = '1'; controls.pressVolume.output.textContent = '100%';
        controls.closeOn.checked = true; controls.closeSec.value = '180'; controls.taskOn.checked = true; controls.taskSelect.value = defaultTask;
        controls.turnBubble.checked = true; controls.charClose.checked = false;
        for (const kind of ['question', 'approval']) {
          controls[kind + 'Bubble'].checked = true; controls[kind + 'SoundOn'].checked = false; controls[kind + 'Select'].value = defaultWait;
          controls[kind + 'Volume'].input.value = '1'; controls[kind + 'Volume'].output.textContent = '100%';
        }
        refresh();
      }
      function openAudioEditor() {
        originalAudioEditor?.click();
        setTimeout(() => {
          const editor = document.querySelector('.dshwv-audiomask'); if (!editor) return; editor.style.zIndex = '27000';
          const observer = new MutationObserver(async () => {
            if (editor.style.display !== 'none') return;
            observer.disconnect(); editor.style.zIndex = '';
            try {
              const next = await json(audioUrl); groups = next.groups || groups; fragments = (next.fragments || []).filter(item => !item.preset);
              sounds = soundOptions(groups, fragments); fillSelect(controls.group, groups.map(item => [item.id, item.name || item.id]), draft.soundSet); refresh();
            } catch (_) {}
          });
          observer.observe(editor, { attributes: true, attributeFilter: ['style'] });
        }, 0);
      }
    }
    let previewAudio = null;
    function stopPreview() {
      if (previewAudio) { previewAudio.pause(); previewAudio.currentTime = 0; previewAudio = null; }
      window.WhaleAudio?.stop?.('notice');
    }
    function preview(url, volume) {
      stopPreview(); if (!url) return; previewAudio = new Audio(url); previewAudio.volume = clamp(volume); previewAudio.play().catch(() => {});
    }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true }); else init();
})();
