// Size slider, audio-group button and the ledger entry button. Menu row labels
// and ordering stay in the caller so it can keep the existing compact layout.
export function createMenuControls({
  document, positioner, minScale, maxScale, setScale, refreshFlip,
  toggleAudioGroupPanel, openAudioGroupEditor, toggleUsagePanel,
}) {
  const scaleInput = document.createElement('input');
  scaleInput.type = 'range';
  scaleInput.min = String(minScale);
  scaleInput.max = String(maxScale);
  scaleInput.step = '0.1';
  scaleInput.className = 'dshwv-range';
  scaleInput.value = '1';
  // 和完整设置窗口一致：数字框直接是倍数，不再是 1–20 档。
  const scaleNumber = document.createElement('input');
  scaleNumber.type = 'number';
  scaleNumber.min = String(minScale);
  scaleNumber.max = String(maxScale);
  scaleNumber.step = '0.1';
  scaleNumber.className = 'dshwv-number';
  scaleNumber.value = '1';
  scaleInput.addEventListener('pointerdown', () => { positioner.style.transition = 'none'; });
  scaleInput.addEventListener('input', () => { setScale(scaleInput.value); });
  scaleInput.addEventListener('change', () => {
    positioner.style.transition = '';
    try { refreshFlip(); } catch {}
  });
  scaleNumber.addEventListener('focus', () => { positioner.style.transition = 'none'; });
  scaleNumber.addEventListener('blur', () => { positioner.style.transition = ''; });
  scaleNumber.addEventListener('input', () => { setScale(scaleNumber.value); });
  scaleNumber.addEventListener('change', () => {
    setScale(scaleNumber.value);
    positioner.style.transition = '';
    try { refreshFlip(); } catch {}
  });

  const audioGroupBtn = document.createElement('button');
  audioGroupBtn.type = 'button';
  audioGroupBtn.className = 'dshwv-audiobtn';
  audioGroupBtn.title = '选择音效组';
  const audioGroupBtnLabel = document.createElement('span');
  audioGroupBtnLabel.className = 'dshwv-btnlabel';
  audioGroupBtnLabel.textContent = '小黄鸭';
  audioGroupBtn.appendChild(audioGroupBtnLabel);
  const audioGroupPanel = document.createElement('div');
  audioGroupPanel.className = 'dshwv-audiolist';
  const audioImportBtn = document.createElement('button');
  audioImportBtn.type = 'button';
  audioImportBtn.className = 'dshwv-audioimport';
  audioImportBtn.textContent = '导入';
  audioImportBtn.title = '新建/编辑音效组';
  audioGroupBtn.addEventListener('click', event => { event.stopPropagation(); toggleAudioGroupPanel(); });
  audioImportBtn.addEventListener('click', event => { event.stopPropagation(); openAudioGroupEditor(null); });
  document.body.appendChild(audioGroupPanel);

  const usageRecBtn = document.createElement('button');
  usageRecBtn.type = 'button';
  usageRecBtn.className = 'dshwv-roleimport';
  usageRecBtn.dataset.action = 'toggle-usage-records';
  usageRecBtn.textContent = '- = 小龙娘记账 = -';
  usageRecBtn.title = '打开小龙娘记账';
  usageRecBtn.addEventListener('click', event => { event.stopPropagation(); toggleUsagePanel(); });

  return { scaleInput, scaleNumber, audioGroupBtn, audioGroupBtnLabel, audioGroupPanel, audioImportBtn, usageRecBtn };
}
