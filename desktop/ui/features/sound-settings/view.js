import { normalizeVolume, soundOptions, soundReferenceUrl } from '../../services/sound-reference.js';

function element(documentRef, parent, tag, text = '', className = '') {
  const node = documentRef.createElement(tag);
  if (text) node.textContent = text;
  if (className) node.className = className;
  parent?.append(node);
  return node;
}

export function createSoundMenuEntry({ documentRef = document, onOpen }) {
  const root = element(documentRef, null, 'div', '', 'dshwv-menu-row whale-sound-entry');
  root.dataset.feature = 'sound-settings';
  element(documentRef, root, 'span', '音效与提示');
  const button = element(documentRef, root, 'button', '全局设置', 'dshwv-roleimport');
  button.type = 'button';
  button.dataset.action = 'open-sound-settings';
  button.addEventListener('click', onOpen);
  return {
    element: root,
    setLoading(loading, error = '') {
      button.disabled = loading;
      button.textContent = error ? '读取失败，重试' : loading ? '读取中…' : '全局设置';
      button.title = error;
    },
    destroy() { button.removeEventListener('click', onOpen); root.remove(); },
  };
}

export function createSoundSettingsView(options) {
  const {
    documentRef = document, draft, initialCatalog, selectEnhancer,
    onSave, onClose, onRestore, onEditAudio, onEditPrompt, onPreview, onStopPreview,
  } = options;
  let catalog = initialCatalog;
  let nested = false;
  let destroyed = false;
  const entries = {};
  const controls = {};
  const mask = element(documentRef, null, 'div', '', 'dshwv-bubmask whale-sound-mask');
  mask.dataset.feature = 'sound-settings-dialog';
  const card = element(documentRef, mask, 'div', '', 'dshwv-bubcard whale-sound-card');
  element(documentRef, card, 'div', '提示与音效设置', 'dshwv-bubtitle whale-sound-title');
  const notice = element(documentRef, card, 'p', '', 'whale-sound-error');
  notice.hidden = true;

  const entry = (kind, title, checked, change) => {
    const details = element(documentRef, card, 'details', '', 'whale-sound-block');
    details.dataset.soundSection = kind;
    const summary = element(documentRef, details, 'summary', '', 'whale-sound-block-head');
    const on = element(documentRef, summary, 'input', '', 'dshwv-check');
    on.type = 'checkbox'; on.checked = checked;
    on.addEventListener('click', event => event.stopPropagation());
    on.addEventListener('change', () => { change(on.checked); refresh(); });
    element(documentRef, summary, 'span', title, 'whale-sound-block-title');
    const status = element(documentRef, summary, 'span', '', 'whale-sound-block-summary');
    const body = element(documentRef, details, 'div', '', 'whale-sound-block-body');
    return entries[kind] = { details, on, status, body };
  };
  const row = (parent, title, className = '') => {
    const root = element(documentRef, parent, 'div', '', 'whale-sound-row ' + className);
    element(documentRef, root, 'span', title, 'whale-sound-label');
    return root;
  };
  const check = (parent, checked, change) => {
    const input = element(documentRef, null, 'input', '', 'dshwv-check');
    input.type = 'checkbox'; input.checked = checked; parent.prepend(input);
    input.addEventListener('change', () => { change(input.checked); refresh(); });
    return input;
  };
  const fillSelect = (select, items, value) => {
    select.replaceChildren();
    for (const item of items) {
      const option = documentRef.createElement('option');
      option.value = item.value; option.textContent = item.label; select.append(option);
    }
    if (value && !items.some(item => item.value === value)) {
      const option = documentRef.createElement('option');
      option.value = value; option.textContent = '已保存音效'; select.append(option);
    }
    select.value = value || items[0]?.value || '';
    selectEnhancer?.refresh?.(select);
  };
  const select = (parent, items, value, change) => {
    const input = element(documentRef, parent, 'select', '', 'dshwv-sound');
    fillSelect(input, items, value);
    input.addEventListener('change', () => { change(input.value); refresh(); });
    return input;
  };
  const volume = (parent, value, change) => {
    const input = element(documentRef, parent, 'input', '', 'dshwv-range');
    input.type = 'range'; input.min = '0'; input.max = '1'; input.step = '.05';
    input.value = String(normalizeVolume(value));
    const output = element(documentRef, parent, 'span', Math.round(normalizeVolume(value) * 100) + '%', 'dshwv-volpct');
    input.addEventListener('input', () => {
      output.textContent = Math.round(Number(input.value) * 100) + '%';
      change(Number(input.value)); refresh();
    });
    return { input, output };
  };
  const play = (parent, title, action) => {
    const button = element(documentRef, parent, 'button', '▶', 'whale-sound-play');
    button.type = 'button'; button.title = title; button.setAttribute('aria-label', title);
    button.addEventListener('click', event => {
      event.preventDefault(); event.stopPropagation(); action();
    });
    return button;
  };
  const edit = (parent, kind, title, config, apply) => {
    const button = element(documentRef, parent, 'button', '编辑提示内容', 'dshwv-roleimport whale-sound-wide-action');
    button.type = 'button'; button.title = title;
    button.addEventListener('click', async event => {
      event.stopPropagation();
      if (nested) return;
      nested = true;
      try {
        const result = await onEditPrompt(kind, config());
        if (result?.status === 'saved' && result.config) { apply(result.config); refresh(); }
      } finally { nested = false; }
    });
    return button;
  };

  const press = entry('press', '按压音效', draft.sound, value => { draft.sound = value; });
  const groupRow = row(press.body, '按压音效组', 'whale-sound-group-row');
  const groupOptions = () => (catalog.groups || []).filter(item => item?.id).map(item => ({ value: item.id, label: item.name || item.id }));
  controls.group = select(groupRow, groupOptions(), draft.soundSet, value => { draft.soundSet = value; });
  controls.newGroup = element(documentRef, groupRow, 'button', '新建音效组', 'dshwv-roleimport whale-sound-inline-button');
  controls.newGroup.type = 'button'; controls.newGroup.dataset.action = 'new-audio-group';
  controls.newGroup.addEventListener('click', async event => {
    event.stopPropagation();
    if (nested) return;
    nested = true;
    try {
      const result = await onEditAudio();
      if (result?.status === 'saved' && result.catalog) updateCatalog(result.catalog, result.selectedGroupId);
    } finally { nested = false; }
  });
  const pressVolumeRow = row(press.body, '按压音量', 'whale-sound-volume-row');
  controls.pressVolume = volume(pressVolumeRow, draft.vol, value => {
    draft.vol = value; if (!draft.events.turnCost.volSet) syncTurnVolume();
  });
  play(pressVolumeRow, '试听按压音效', () => onPreview(
    soundReferenceUrl({ kind: 'group', id: draft.soundSet }), draft.vol,
  ));

  const turn = entry('turnCost', '每轮消耗提示', draft.turnCostOn, value => { draft.turnCostOn = value; });
  const turnBubbleRow = row(turn.body, '冒泡提示');
  controls.turnBubble = check(turnBubbleRow, draft.events.turnCost.bubbleOn, value => { draft.events.turnCost.bubbleOn = value; });
  edit(turnBubbleRow, 'turnCost', '编辑每轮消耗提示的泡泡内容',
    () => ({ lines: draft.events.turnCost.lines }), result => { draft.events.turnCost.lines = structuredClone(result.lines || []); });
  const closeRow = row(turn.body, '自动关闭', 'whale-sound-close-row');
  controls.closeOn = check(closeRow, draft.closeOn, value => { draft.closeOn = value; });
  controls.closeSec = element(documentRef, closeRow, 'input', '', 'dshwv-number');
  controls.closeSec.type = 'number'; controls.closeSec.min = '0'; controls.closeSec.max = '3600'; controls.closeSec.step = '1';
  controls.closeSec.value = String(draft.closeSec);
  controls.closeSec.addEventListener('input', () => { draft.closeSec = Number(controls.closeSec.value); refresh(); });
  element(documentRef, closeRow, 'span', '秒', 'whale-sound-unit');
  const taskRow = row(turn.body, '任务结束音', 'whale-sound-task-row');
  controls.taskOn = check(taskRow, draft.taskEnd.on, value => { draft.taskEnd.on = value; });
  controls.taskSelect = select(taskRow, soundOptions(catalog), draft.taskEnd.sel, value => { draft.taskEnd.sel = value; });
  play(taskRow, '试听任务结束音', () => onPreview(soundReferenceUrl(draft.taskEnd.sel), effectiveTurnVolume()));
  const taskVolumeRow = row(turn.body, '提示音量', 'whale-sound-volume-row');
  controls.taskVolume = volume(taskVolumeRow, effectiveTurnVolume(), value => {
    draft.events.turnCost.vol = value; draft.events.turnCost.volSet = true;
  });

  const waitSection = (kind, title, soundTitle) => {
    const config = draft.events[kind];
    const block = entry(kind, title, config.on, value => { config.on = value; });
    const bubbleRow = row(block.body, '冒泡提示');
    controls[kind + 'Bubble'] = check(bubbleRow, config.bubbleOn, value => { config.bubbleOn = value; });
    edit(bubbleRow, kind, '编辑' + title + '的泡泡内容（{session} 表示当前对话）',
      () => config, result => { config.lines = structuredClone(result.lines || []); });
    const soundRow = row(block.body, soundTitle, 'whale-sound-task-row');
    controls[kind + 'SoundOn'] = check(soundRow, config.soundOn, value => { config.soundOn = value; });
    controls[kind + 'Select'] = select(soundRow, soundOptions(catalog), config.sel, value => { config.sel = value; });
    play(soundRow, '试听' + soundTitle, () => onPreview(soundReferenceUrl(config.sel), config.vol));
    const volumeRow = row(block.body, '提示音量', 'whale-sound-volume-row');
    controls[kind + 'Volume'] = volume(volumeRow, config.vol, value => { config.vol = value; });
  };
  waitSection('question', '提问提示', '提问提示音效');
  waitSection('approval', '授权提示', '授权提示音');

  const charRow = element(documentRef, card, 'div', '', 'whale-sound-charclose');
  controls.charClose = check(charRow, draft.wait.charClose, value => { draft.wait.charClose = value; });
  controls.charClose.id = 'whale-sound-char-close';
  const charLabel = element(documentRef, charRow, 'label', '点按角色关闭提示气泡');
  charLabel.htmlFor = controls.charClose.id;
  const help = element(documentRef, charRow, 'button', '?', 'whale-sound-help');
  help.type = 'button'; help.setAttribute('aria-label', '查看说明');
  const tip = element(documentRef, charRow, 'div', '等待提问或授权时，默认点气泡即可收起，同一条挂起提示不会再次弹回。打开后，点角色也能收起提示气泡。', 'whale-sound-help-pop');
  help.addEventListener('click', event => { event.stopPropagation(); tip.classList.toggle('is-open'); });

  const actions = element(documentRef, card, 'div', '', 'dshwv-bubbtns whale-sound-actions');
  const action = (text, className, listener) => {
    const button = element(documentRef, actions, 'button', text, 'dshwv-bubbtn ' + className);
    button.type = 'button'; button.addEventListener('click', listener); return button;
  };
  action('取消', 'dshwv-bubbtn-no', () => close('cancelled'));
  action('恢复默认', 'dshwv-bubbtn-no', () => { onRestore(); syncControls(); });
  const save = action('保存', 'dshwv-bubbtn-ok', async () => {
    try {
      setBusy(true); setError('');
      await onSave();
    } catch (error) {
      setError(error?.message || '设置保存失败'); setBusy(false);
    }
  });
  save.dataset.action = 'save-sound-settings';

  function groupName(id) { return catalog.groups?.find(item => item.id === id)?.name || id || '默认音效组'; }
  function selectedName(selectElement) { return selectElement?.selectedOptions?.[0]?.textContent || '—'; }
  function effectiveTurnVolume() { return draft.events.turnCost.volSet ? draft.events.turnCost.vol : draft.vol; }
  function syncTurnVolume() {
    if (!draft.events.turnCost.volSet && controls.taskVolume) {
      controls.taskVolume.input.value = String(draft.vol);
      controls.taskVolume.output.textContent = Math.round(draft.vol * 100) + '%';
    }
  }
  function setDisabled(control, disabled) {
    if (!control) return;
    const input = control.input || control; input.disabled = disabled;
    selectEnhancer?.sync?.(input);
    input.closest?.('.whale-sound-row')?.classList.toggle('is-dim', disabled);
  }
  function refresh() {
    entries.press.on.checked = draft.sound; entries.turnCost.on.checked = draft.turnCostOn;
    entries.question.on.checked = draft.events.question.on; entries.approval.on.checked = draft.events.approval.on;
    entries.press.status.textContent = draft.sound ? groupName(draft.soundSet) + ' · ' + Math.round(draft.vol * 100) + '%' : '已关闭';
    const automatic = draft.closeOn && Number(draft.closeSec) > 0 ? '自动关 ' + draft.closeSec + 's' : '不自动关';
    entries.turnCost.status.textContent = !draft.turnCostOn ? '已关闭' : automatic + ' · ' + (draft.taskEnd.on
      ? selectedName(controls.taskSelect) + (draft.events.turnCost.volSet
        ? (effectiveTurnVolume() !== 1 ? ' · ' + Math.round(effectiveTurnVolume() * 100) + '%' : '')
        : ' · 跟随按压音量 ' + Math.round(draft.vol * 100) + '%')
      : '当前为静音，在下拉设置中修改');
    for (const kind of ['question', 'approval']) {
      const config = draft.events[kind];
      entries[kind].status.textContent = !config.on ? '已关闭' : !config.soundOn ? '当前为静音，在下拉设置中修改'
        : selectedName(controls[kind + 'Select']) + (config.vol !== 1 ? ' · ' + Math.round(config.vol * 100) + '%' : '');
    }
    setDisabled(controls.group, !draft.sound); setDisabled(controls.newGroup, !draft.sound); setDisabled(controls.pressVolume, !draft.sound);
    setDisabled(controls.taskSelect, !draft.turnCostOn || !draft.taskEnd.on); setDisabled(controls.taskVolume, !draft.turnCostOn || !draft.taskEnd.on);
    for (const kind of ['question', 'approval']) {
      const disabled = !draft.events[kind].on || !draft.events[kind].soundOn;
      setDisabled(controls[kind + 'Select'], disabled); setDisabled(controls[kind + 'Volume'], disabled);
    }
    controls.closeSec.disabled = !draft.closeOn; syncTurnVolume();
  }
  function syncControls() {
    controls.group.value = draft.soundSet;
    controls.pressVolume.input.value = String(draft.vol);
    controls.pressVolume.output.textContent = Math.round(draft.vol * 100) + '%';
    controls.closeOn.checked = draft.closeOn; controls.closeSec.value = String(draft.closeSec);
    controls.taskOn.checked = draft.taskEnd.on; controls.taskSelect.value = draft.taskEnd.sel;
    controls.turnBubble.checked = draft.events.turnCost.bubbleOn; controls.charClose.checked = draft.wait.charClose;
    for (const kind of ['question', 'approval']) {
      const config = draft.events[kind];
      controls[kind + 'Bubble'].checked = config.bubbleOn; controls[kind + 'SoundOn'].checked = config.soundOn;
      controls[kind + 'Select'].value = config.sel;
      controls[kind + 'Volume'].input.value = String(config.vol);
      controls[kind + 'Volume'].output.textContent = Math.round(config.vol * 100) + '%';
    }
    refresh();
  }
  function updateCatalog(next, selectedGroupId) {
    catalog = next;
    if (selectedGroupId) draft.soundSet = selectedGroupId;
    if (!catalog.groups?.some(group => group.id === draft.soundSet)) draft.soundSet = catalog.groups?.[0]?.id || 'duck';
    fillSelect(controls.group, groupOptions(), draft.soundSet);
    const options = soundOptions(catalog);
    fillSelect(controls.taskSelect, options, draft.taskEnd.sel);
    for (const kind of ['question', 'approval']) fillSelect(controls[kind + 'Select'], options, draft.events[kind].sel);
    refresh();
  }
  function setBusy(busy) {
    save.disabled = busy;
  }
  function setError(message) {
    notice.hidden = !message; notice.textContent = message || '';
  }
  function close(reason) {
    if (destroyed || nested) return;
    onStopPreview?.(); destroy(); onClose?.(reason);
  }
  function destroy() {
    if (destroyed) return;
    destroyed = true; documentRef.removeEventListener('keydown', onKeyDown, true); mask.remove();
  }
  function onKeyDown(event) {
    if (event.key === 'Escape' && !nested) { event.preventDefault(); event.stopPropagation(); close('cancelled'); }
  }
  documentRef.addEventListener('keydown', onKeyDown, true);
  mask.addEventListener('click', event => { if (event.target === mask) close('cancelled'); });
  documentRef.body.append(mask); refresh();
  return { element: mask, close, destroy, setBusy, setError, updateCatalog, setNested(value) { nested = !!value; } };
}
