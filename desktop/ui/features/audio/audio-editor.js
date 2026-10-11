import { createLifecycle } from '../../services/lifecycle.js';
import { requestJson } from '../../services/request.js';

export function createAudioEditor(ports) {
const lifecycle = createLifecycle();
let groupList = createLifecycle(), slotLists = { press: createLifecycle(), release: createLifecycle() };
lifecycle.add(() => { groupList.dispose(); slotLists.press.dispose(); slotLists.release.dispose(); });
var audioEditMask = ports.document.createElement('div');
audioEditMask.className = 'dshwv-audiomask';
audioEditMask.style.display = 'none';
var audioEditCard = ports.document.createElement('div');
audioEditCard.className = 'dshwv-audiowin';
var audioEditTitle = ports.document.createElement('div');
audioEditTitle.className = 'dshwv-audiotitle';
audioEditTitle.textContent = '音效组';
var audioEditName = ports.document.createElement('input');
audioEditName.type = 'text';
audioEditName.className = 'dshwv-audionameinput';
audioEditName.maxLength = 20;
audioEditName.placeholder = '预设名称';
var audioEditPressRow = ports.document.createElement('div');
audioEditPressRow.className = 'dshwv-audiorow';
var audioEditPressLabel = ports.document.createElement('span');
audioEditPressLabel.className = 'dshwv-audioslotlabel';
audioEditPressLabel.textContent = '按压';
var audioEditPressWrap = ports.document.createElement('div');
audioEditPressWrap.className = 'dshwv-slotwrap';
var audioEditPressBtn = ports.document.createElement('button');
audioEditPressBtn.type = 'button';
audioEditPressBtn.className = 'dshwv-slotbtn';
audioEditPressBtn.textContent = '小黄鸭·按下';
var audioEditPressPanel = ports.document.createElement('div');
audioEditPressPanel.className = 'dshwv-slotlist';
audioEditPressWrap.appendChild(audioEditPressBtn);
audioEditPressWrap.appendChild(audioEditPressPanel);
var audioEditPressImport = ports.document.createElement('button');
audioEditPressImport.type = 'button';
audioEditPressImport.className = 'dshwv-audiosmallimport';
audioEditPressImport.textContent = '导入';
audioEditPressImport.title = '导入并裁剪按压音';
audioEditPressRow.appendChild(audioEditPressLabel);
audioEditPressRow.appendChild(audioEditPressWrap);
audioEditPressRow.appendChild(audioEditPressImport);
var audioEditReleaseRow = ports.document.createElement('div');
audioEditReleaseRow.className = 'dshwv-audiorow';
var audioEditReleaseLabel = ports.document.createElement('span');
audioEditReleaseLabel.className = 'dshwv-audioslotlabel';
audioEditReleaseLabel.textContent = '松开';
var audioEditReleaseWrap = ports.document.createElement('div');
audioEditReleaseWrap.className = 'dshwv-slotwrap';
var audioEditReleaseBtn = ports.document.createElement('button');
audioEditReleaseBtn.type = 'button';
audioEditReleaseBtn.className = 'dshwv-slotbtn';
audioEditReleaseBtn.textContent = '小黄鸭·松开';
var audioEditReleasePanel = ports.document.createElement('div');
audioEditReleasePanel.className = 'dshwv-slotlist';
audioEditReleaseWrap.appendChild(audioEditReleaseBtn);
audioEditReleaseWrap.appendChild(audioEditReleasePanel);
var audioEditReleaseImport = ports.document.createElement('button');
audioEditReleaseImport.type = 'button';
audioEditReleaseImport.className = 'dshwv-audiosmallimport';
audioEditReleaseImport.textContent = '导入';
audioEditReleaseImport.title = '导入并裁剪松开音';
audioEditReleaseRow.appendChild(audioEditReleaseLabel);
audioEditReleaseRow.appendChild(audioEditReleaseWrap);
audioEditReleaseRow.appendChild(audioEditReleaseImport);
var audioEditBtns = ports.document.createElement('div');
audioEditBtns.className = 'dshwv-cropbtns';
var audioEditCancel = ports.document.createElement('button');
audioEditCancel.type = 'button';
audioEditCancel.className = 'dshwv-cropbtn dshwv-cropbtn-no';
audioEditCancel.textContent = '取消';
var audioEditPlay = ports.document.createElement('button');
audioEditPlay.type = 'button';
audioEditPlay.className = 'dshwv-cropbtn dshwv-cropbtn-no';
audioEditPlay.textContent = '试听';
audioEditPlay.title = '按住播放按压音，松开播放松开音（模拟点击挂件）';
var audioEditSave = ports.document.createElement('button');
audioEditSave.type = 'button';
audioEditSave.className = 'dshwv-cropbtn dshwv-cropbtn-ok';
audioEditSave.textContent = '保存';
audioEditBtns.appendChild(audioEditCancel);
audioEditBtns.appendChild(audioEditPlay);
audioEditBtns.appendChild(audioEditSave);
audioEditCard.appendChild(audioEditTitle);
audioEditCard.appendChild(audioEditName);
audioEditCard.appendChild(audioEditPressRow);
audioEditCard.appendChild(audioEditReleaseRow);
audioEditCard.appendChild(audioEditBtns);
audioEditMask.appendChild(audioEditCard);
ports.document.body.appendChild(audioEditMask);
lifecycle.listen(audioEditCancel, 'click', hideAudioEditor);
lifecycle.listen(audioEditPlay, 'pointerdown', function (e) {
      e.stopPropagation();
      audioEditPreviewDown();
    });
lifecycle.listen(audioEditPlay, 'pointerup', function (e) {
      e.stopPropagation();
      audioEditPreviewUp();
    });
lifecycle.listen(audioEditPlay, 'pointercancel', audioEditPreviewUp);
lifecycle.listen(audioEditPlay, 'pointerleave', audioEditPreviewUp);
lifecycle.listen(audioEditSave, 'click', saveAudioGroup);
lifecycle.listen(audioEditMask, 'click', function (e) {
      if (e.target === audioEditMask || e.target === audioEditCard) closeAudioSlotPanels();
    });
var audioCropMask = ports.document.createElement('div');
audioCropMask.className = 'dshwv-audiomask';
audioCropMask.style.display = 'none';
var audioCropCard = ports.document.createElement('div');
audioCropCard.className = 'dshwv-audiowin';
var audioCropTitle = ports.document.createElement('div');
audioCropTitle.className = 'dshwv-audiotitle';
audioCropTitle.textContent = '裁剪音频';
var audioCropCanvas = ports.document.createElement('canvas');
audioCropCanvas.width = 300;
audioCropCanvas.height = 120;
audioCropCanvas.className = 'dshwv-audiocropcanvas';
var audioCropStart = ports.document.createElement('input');
audioCropStart.type = 'range';
audioCropStart.min = '0';
audioCropStart.max = '100';
audioCropStart.step = '0.001';
audioCropStart.value = '0';
audioCropStart.className = 'dshwv-cropzoom';
var audioCropStartNum = ports.document.createElement('input');
audioCropStartNum.type = 'number';
audioCropStartNum.min = '0';
audioCropStartNum.step = '0.001';
audioCropStartNum.value = '0';
audioCropStartNum.className = 'dshwv-cropnum';
audioCropStartNum.title = '起始时间（秒）';
var audioCropStartRow = ports.document.createElement('div');
audioCropStartRow.className = 'dshwv-audiosliderrow';
audioCropStartRow.appendChild(audioCropStart);
audioCropStartRow.appendChild(audioCropStartNum);
var audioCropEnd = ports.document.createElement('input');
audioCropEnd.type = 'range';
audioCropEnd.min = '0';
audioCropEnd.max = '100';
audioCropEnd.step = '0.001';
audioCropEnd.value = '100';
audioCropEnd.className = 'dshwv-cropzoom';
var audioCropEndNum = ports.document.createElement('input');
audioCropEndNum.type = 'number';
audioCropEndNum.min = '0';
audioCropEndNum.step = '0.001';
audioCropEndNum.value = '0';
audioCropEndNum.className = 'dshwv-cropnum';
audioCropEndNum.title = '结束时间（秒）';
var audioCropEndRow = ports.document.createElement('div');
audioCropEndRow.className = 'dshwv-audiosliderrow';
audioCropEndRow.appendChild(audioCropEnd);
audioCropEndRow.appendChild(audioCropEndNum);
audioCropStart.style.display = 'none';
audioCropEnd.style.display = 'none';
var audioCropDual = ports.document.createElement('div');
audioCropDual.className = 'dshwv-dualrange';
var audioCropDualTrack = ports.document.createElement('div');
audioCropDualTrack.className = 'dshwv-dualrange-track';
var audioCropDualFill = ports.document.createElement('div');
audioCropDualFill.className = 'dshwv-dualrange-fill';
var audioCropDualStart = ports.document.createElement('div');
audioCropDualStart.className = 'dshwv-dualrange-thumb';
var audioCropDualEnd = ports.document.createElement('div');
audioCropDualEnd.className = 'dshwv-dualrange-thumb';
audioCropDual.appendChild(audioCropDualTrack);
audioCropDual.appendChild(audioCropDualFill);
audioCropDual.appendChild(audioCropDualStart);
audioCropDual.appendChild(audioCropDualEnd);
var audioCropDualRow = ports.document.createElement('div');
audioCropDualRow.className = 'dshwv-audiosliderrow';
audioCropDualRow.appendChild(audioCropStartNum);
audioCropDualRow.appendChild(audioCropDual);
audioCropDualRow.appendChild(audioCropEndNum);
var audioCropZoomLabel = ports.document.createElement('span');
audioCropZoomLabel.className = 'dshwv-zoomlabel';
audioCropZoomLabel.textContent = '缩放倍数';
var audioCropZoomRange = ports.document.createElement('input');
audioCropZoomRange.type = 'range';
audioCropZoomRange.min = '1';
audioCropZoomRange.max = '50';
audioCropZoomRange.step = '1';
audioCropZoomRange.value = '1';
audioCropZoomRange.className = 'dshwv-cropzoom';
audioCropZoomRange.title = '波形放大倍数';
var audioCropZoomNum = ports.document.createElement('input');
audioCropZoomNum.type = 'number';
audioCropZoomNum.min = '1';
audioCropZoomNum.max = '50';
audioCropZoomNum.step = '1';
audioCropZoomNum.value = '1';
audioCropZoomNum.className = 'dshwv-cropnum';
audioCropZoomNum.title = '放大倍数';
var audioCropZoomRow = ports.document.createElement('div');
audioCropZoomRow.className = 'dshwv-audiosliderrow';
audioCropZoomRow.appendChild(audioCropZoomLabel);
audioCropZoomRow.appendChild(audioCropZoomRange);
audioCropZoomRow.appendChild(audioCropZoomNum);
var audioCropTime = ports.document.createElement('div');
audioCropTime.className = 'dshwv-audiotime';
audioCropTime.textContent = '0.0s – 0.0s';
var audioCropNameRow = ports.document.createElement('div');
audioCropNameRow.className = 'dshwv-audiosliderrow';
audioCropNameRow.style.justifyContent = 'center';
audioCropNameRow.style.margin = '2px 0';
var audioCropName = ports.document.createElement('input');
audioCropName.type = 'text';
audioCropName.maxLength = 30;
audioCropName.placeholder = '音频片段名称';
audioCropName.title = '裁剪后片段的名称（可改名，留空用源文件名）';
audioCropName.style.cssText = 'width:min(60%,240px);flex:0 1 auto;margin:0;text-align:center;border:1px solid rgba(32,49,112,.4);border-radius:6px;padding:2px 6px;font-size:12px;color:#203170;background:#fff;box-sizing:border-box';
audioCropNameRow.appendChild(audioCropName);
audioCropNameRow.style.marginBottom = '12px';
function updateAudioCropOkState() {
      try {
        audioCropOk.disabled = false;
      } catch (err) {}
    }
lifecycle.listen(audioCropName, 'input', updateAudioCropOkState);
var audioCropBtns = ports.document.createElement('div');
audioCropBtns.className = 'dshwv-cropbtns';
var audioCropCancel = ports.document.createElement('button');
audioCropCancel.type = 'button';
audioCropCancel.className = 'dshwv-cropbtn dshwv-cropbtn-no';
audioCropCancel.textContent = '取消';
var audioCropPlay = ports.document.createElement('button');
audioCropPlay.type = 'button';
audioCropPlay.className = 'dshwv-cropbtn dshwv-cropbtn-no';
audioCropPlay.textContent = '试听';
audioCropPlay.title = '试听裁剪后的片段';
var audioCropOk = ports.document.createElement('button');
audioCropOk.type = 'button';
audioCropOk.className = 'dshwv-cropbtn dshwv-cropbtn-ok';
audioCropOk.textContent = '确认';
audioCropOk.disabled = false;
audioCropBtns.appendChild(audioCropCancel);
audioCropBtns.appendChild(audioCropPlay);
audioCropBtns.appendChild(audioCropOk);
audioCropCard.appendChild(audioCropTitle);
audioCropCard.appendChild(audioCropCanvas);
audioCropCard.appendChild(audioCropDualRow);
audioCropCard.appendChild(audioCropZoomRow);
audioCropCard.appendChild(audioCropTime);
audioCropCard.appendChild(audioCropNameRow);
audioCropCard.appendChild(audioCropBtns);
audioCropMask.appendChild(audioCropCard);
ports.document.body.appendChild(audioCropMask);
lifecycle.listen(audioCropCancel, 'click', hideAudioCrop);
lifecycle.listen(audioCropOk, 'click', confirmAudioCrop);
lifecycle.listen(audioCropPlay, 'click', previewAudioCrop);
lifecycle.listen(audioCropStart, 'input', onAudioCropStartInput);
lifecycle.listen(audioCropEnd, 'input', onAudioCropEndInput);
lifecycle.listen(audioCropStartNum, 'input', onAudioCropStartNumInput);
lifecycle.listen(audioCropStartNum, 'change', onAudioCropStartNumChange);
lifecycle.listen(audioCropEndNum, 'input', onAudioCropEndNumInput);
lifecycle.listen(audioCropEndNum, 'change', onAudioCropEndNumChange);
lifecycle.listen(audioCropZoomRange, 'input', onAudioCropZoomInput);
lifecycle.listen(audioCropZoomNum, 'input', onAudioCropZoomNumInput);
lifecycle.listen(audioCropZoomNum, 'change', onAudioCropZoomNumChange);
lifecycle.listen(audioCropCanvas, 'wheel', onAudioCropWheel, {
      passive: false
    });
lifecycle.listen(audioCropCanvas, 'pointerdown', onAudioCropSelDown);
lifecycle.listen(audioCropCanvas, 'pointermove', onAudioCropSelMove);
lifecycle.listen(audioCropCanvas, 'pointerup', onAudioCropSelUp);
lifecycle.listen(audioCropCanvas, 'pointercancel', onAudioCropSelUp);
lifecycle.listen(audioCropDual, 'pointerdown', onAudioCropDualDown);
lifecycle.listen(audioCropDual, 'pointermove', onAudioCropDualMove);
lifecycle.listen(audioCropDual, 'pointerup', onAudioCropDualUp);
lifecycle.listen(audioCropDual, 'pointercancel', onAudioCropDualUp);
var AUDIO_URL = '/dsh-whale/audio.json';
var audioGroups = [];
var audioFragments = [];
var audioGroupPanelOpen = false;
function loadAudio() {
      try {
        ports.assetClient.audio().then(lifecycle.guard(function (d) {
          if (!d) return;
          if (Array.isArray(d.groups)) audioGroups = d.groups;
          if (Array.isArray(d.fragments)) audioFragments = d.fragments;
          ports.assetWarning(d);
          var exists = false;
          for (var i = 0; i < audioGroups.length; i++) if (audioGroups[i].id === ports.soundSet) {
            exists = true;
            break;
          }
          if (!exists) ports.setSoundSet('duck'); else {
            ports.setAudioBtnText(audioGroupName(ports.soundSet));
            try {
              ports.applySoundSet();
            } catch (err) {}
          }
          renderAudioGroupPanel();
          ports.refreshTaskEndAfterAudio();
        })).catch(function () {});
      } catch (err) {}
    }
function audioGroupName(id) {
      for (var i = 0; i < audioGroups.length; i++) if (audioGroups[i].id === id) return audioGroups[i].name;
      return id === 'duck' ? '小黄鸭' : id === 'fx1' ? '音效1' : id;
    }
function audioGroupSlotEmpty(id, slot) {
      try {
        for (var i = 0; i < audioGroups.length; i++) {
          var g = audioGroups[i];
          if (g && g.id === id) return g[slot] === '';
        }
      } catch (err) {}
      return false;
    }
function toggleAudioGroupPanel() {
      if (audioGroupPanelOpen) {
        closeAudioGroupPanel();
        return;
      }
      try {
        renderAudioGroupPanel();
        var b = ports.audioGroupBtn.getBoundingClientRect();
        var vp = ports.viewport();
        var availableWidth = Math.max(80, vp.w - 8);
        var panelW = Math.min(Math.max(160, Math.round(b.width)), availableWidth);
        ports.audioGroupPanel.style.maxHeight = Math.max(80, Math.min(240, vp.h - 16)) + 'px';
        ports.audioGroupPanel.style.maxWidth = availableWidth + 'px';
        ports.audioGroupPanel.style.width = panelW + 'px';
        ports.audioGroupPanel.style.left = Math.max(4, Math.min(b.left, vp.w - panelW - 4)) + 'px';
        ports.audioGroupPanel.style.top = '4px';
        ports.audioGroupPanel.style.display = 'block';
        var panelH = ports.audioGroupPanel.getBoundingClientRect().height;
        var below = vp.h - b.bottom - 10;
        var above = b.top - 10;
        var panelTop = panelH <= below ? b.bottom + 6
          : panelH <= above ? b.top - panelH - 6
          : below >= above ? Math.max(4, b.bottom + 6) : Math.max(4, b.top - panelH - 6);
        ports.audioGroupPanel.style.top = Math.max(4, Math.min(panelTop, vp.h - panelH - 4)) + 'px';
        ports.audioGroupPanel.classList.add('dshwv-audiolist-open');
        audioGroupPanelOpen = true;
      } catch (err) {}
    }
function closeAudioGroupPanel() {
      groupList.dispose(); ports.audioGroupPanel.innerHTML = '';
      ports.audioGroupPanel.classList.remove('dshwv-audiolist-open');
      ports.audioGroupPanel.style.display = 'none';
      audioGroupPanelOpen = false;
    }
function renderAudioGroupPanel() {
      groupList.dispose(); groupList = createLifecycle();
      try {
        ports.audioGroupPanel.innerHTML = '';
        audioGroups.forEach(function (g) {
          var item = ports.document.createElement('div');
          item.className = 'dshwv-audioitem' + (ports.soundSet === g.id ? ' dshwv-audioitem-cur' : '');
          var thumb = ports.document.createElement('span');
          thumb.className = 'dshwv-audiothumb';
          thumb.setAttribute('aria-hidden', 'true');
          item.appendChild(thumb);
          var name = ports.makeNameCell('dshwv-audioname', g.name);
          item.appendChild(name);
          if (g.preset) {
            var tag = ports.document.createElement('span');
            tag.className = 'dshwv-audiopreset';
            tag.textContent = '预设';
            item.appendChild(tag);
          } else {
            var pin = ports.document.createElement('button');
            pin.type = 'button';
            pin.className = 'dshwv-audiopin' + (g.pinned ? ' on' : '');
            pin.textContent = '📌';
            pin.title = g.pinned ? '取消置顶' : '置顶';
            groupList.listen(pin, 'click', function (e) {
              e.stopPropagation();
              audioPinGroup(g.id, !g.pinned);
            });
            item.appendChild(pin);
            var del = ports.document.createElement('button');
            del.type = 'button';
            del.className = 'dshwv-audiodel';
            del.textContent = '✕';
            del.title = '删除音效组';
            groupList.listen(del, 'click', function (e) {
              e.stopPropagation();
              audioDeleteGroup(g.id);
            });
            item.appendChild(del);
          }
          groupList.listen(item, 'click', function () {
            ports.setSoundSet(g.id);
            closeAudioGroupPanel();
          });
          groupList.add(ports.bindNameMarquee(item, name));
          ports.audioGroupPanel.appendChild(item);
        });
      } catch (err) {}
    }
function audioPinGroup(id, pinned) {
      try {
        requestJson(AUDIO_URL, { signal: lifecycle.signal,
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: {
            action: 'pin-group',
            id: id,
            pinned: pinned
          }
        }).then(lifecycle.guard(function (d) {
          ports.requireSaved(d);
          if (d && d.ok && Array.isArray(d.groups)) {
            audioGroups = d.groups;
            renderAudioGroupPanel();
            ports.refreshTaskEndAfterAudio();
          }
        })).catch(lifecycle.guard(ports.assetFailure));
      } catch (err) { ports.assetFailure(err); }
    }
function audioDeleteGroup(id) {
      var g = null;
      for (var i = 0; i < audioGroups.length; i++) if (audioGroups[i].id === id) {
        g = audioGroups[i];
        break;
      }
      ports.showConfirm('确定删除音效组「' + (g ? g.name : id) + '」吗？', function () {
        try {
          requestJson(AUDIO_URL, { signal: lifecycle.signal,
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: {
              action: 'delete-group',
              id: id
            }
          }).then(lifecycle.guard(function (d) {
          ports.requireSaved(d);
            if (d && d.ok && Array.isArray(d.groups)) {
              audioGroups = d.groups;
              renderAudioGroupPanel();
              ports.refreshTaskEndAfterAudio();
              if (ports.soundSet === id) ports.setSoundSet('duck');
            }
          })).catch(lifecycle.guard(ports.assetFailure));
        } catch (err) { ports.assetFailure(err); }
      });
    }
var editingAudioGroupId = null;
var audioEditorSession = null;
var activeSlotPanel = null;
var audioEditPressVal = 'ya1';
var audioEditReleaseVal = 'ya2';
function audioSlotName(id) {
      for (var i = 0; i < audioFragments.length; i++) if (audioFragments[i].id === id) return audioFragments[i].name;
      return id;
    }
function audioSlotBtnText(btn, id) {
      try {
        var txt = audioSlotName(id);
        btn.style.opacity = txt ? '' : '.55';
        btn.textContent = txt || '留空·不发声';
        btn.title = '留空则该事件不发声;点击可选择音频片段';
      } catch (err) {}
      return btn;
    }
function openAudioGroupEditor(group) {
      editingAudioGroupId = group && group.id ? group.id : null;
      audioEditTitle.textContent = editingAudioGroupId ? '编辑音效组' : '新建音效组';
      audioEditName.value = group && group.name ? group.name : '';
      var isNewGroup = !(group && group.id);
      audioEditPressVal = group && typeof group.press === 'string' ? group.press : isNewGroup ? '' : 'ya1';
      audioEditReleaseVal = group && typeof group.release === 'string' ? group.release : isNewGroup ? '' : 'ya2';
      audioEditPressBtn.textContent = audioSlotName(audioEditPressVal);
      audioEditReleaseBtn.textContent = audioSlotName(audioEditReleaseVal);
      audioSlotBtnText(audioEditPressBtn, audioEditPressVal);
      audioSlotBtnText(audioEditReleaseBtn, audioEditReleaseVal);
      audioEditPreviewEnsure();
      audioEditMask.style.display = 'flex';
    }
function toggleAudioSlotPanel(slot) {
      var btn = slot === 'press' ? audioEditPressBtn : audioEditReleaseBtn;
      var panel = slot === 'press' ? audioEditPressPanel : audioEditReleasePanel;
      if (activeSlotPanel === panel) {
        closeAudioSlotPanels();
        return;
      }
      closeAudioSlotPanels();
      activeSlotPanel = panel;
      renderAudioSlotPanel(slot);
      try {
        var b = btn.getBoundingClientRect();
        var vp = ports.viewport();
        var panelW = Math.max(120, Math.round(b.width));
        panel.style.width = panelW + 'px';
        panel.style.left = Math.max(4, Math.min(b.left, vp.w - panelW - 4)) + 'px';
        panel.style.top = b.bottom + 4 + 'px';
        panel.style.display = 'block';
      } catch (err) {}
    }
function closeAudioSlotPanels() {
      slotLists.press.dispose(); slotLists.release.dispose();
      audioEditPressPanel.innerHTML = ''; audioEditReleasePanel.innerHTML = '';
      if (audioEditPressPanel) audioEditPressPanel.style.display = 'none';
      if (audioEditReleasePanel) audioEditReleasePanel.style.display = 'none';
      activeSlotPanel = null;
    }
function renderAudioSlotPanel(slot) {
      slotLists[slot].dispose(); var list = slotLists[slot] = createLifecycle();
      try {
        var panel = slot === 'press' ? audioEditPressPanel : audioEditReleasePanel;
        var current = slot === 'press' ? audioEditPressVal : audioEditReleaseVal;
        panel.innerHTML = '';
        var emptyItem = ports.document.createElement('div');
        emptyItem.className = 'dshwv-audioitem' + (!current ? ' dshwv-audioitem-cur' : '');
        var emptyIcon = ports.document.createElement('span');
        emptyIcon.className = 'dshwv-audiothumb dshwv-audiothumb-empty';
        emptyIcon.setAttribute('aria-hidden', 'true');
        emptyItem.appendChild(emptyIcon);
        var emptyName = ports.makeNameCell('dshwv-audioname', '留空（不发声）');
        emptyItem.appendChild(emptyName);
        list.listen(emptyItem, 'click', function () {
          if (slot === 'press') {
            audioEditPressVal = '';
            audioSlotBtnText(audioEditPressBtn, '');
          } else {
            audioEditReleaseVal = '';
            audioSlotBtnText(audioEditReleaseBtn, '');
          }
          audioEditPreviewEnsure(true);
          closeAudioSlotPanels();
        });
        list.add(ports.bindNameMarquee(emptyItem, emptyName));
        panel.appendChild(emptyItem);
        audioFragments.forEach(function (f) {
          var item = ports.document.createElement('div');
          item.className = 'dshwv-audioitem' + (current === f.id ? ' dshwv-audioitem-cur' : '');
          var thumb = ports.document.createElement('span');
          thumb.className = 'dshwv-audiothumb';
          thumb.setAttribute('aria-hidden', 'true');
          item.appendChild(thumb);
          var name = ports.makeNameCell('dshwv-audioname', f.name);
          item.appendChild(name);
          if (f.preset) {
            var tag = ports.document.createElement('span');
            tag.className = 'dshwv-audiopreset';
            tag.textContent = '预设';
            item.appendChild(tag);
          } else {
            var del = ports.document.createElement('button');
            del.type = 'button';
            del.className = 'dshwv-audiodel';
            del.textContent = '✕';
            del.title = '删除该音频';
            list.listen(del, 'click', function (e) {
              e.stopPropagation();
              audioDeleteFragmentInSlot(slot, f.id);
            });
            item.appendChild(del);
          }
          list.listen(item, 'click', function () {
            if (slot === 'press') {
              audioEditPressVal = f.id;
              audioSlotBtnText(audioEditPressBtn, f.id);
            } else {
              audioEditReleaseVal = f.id;
              audioSlotBtnText(audioEditReleaseBtn, f.id);
            }
            audioEditPreviewEnsure(true);
            closeAudioSlotPanels();
          });
          list.add(ports.bindNameMarquee(item, name));
          panel.appendChild(item);
        });
      } catch (err) {}
    }
function hideAudioEditor(outcome, detail) {
      stopAudioEditPreview();
      audioEditMask.style.display = 'none';
      editingAudioGroupId = null;
      closeAudioSlotPanels();
      if (audioEditorSession) {
        var session = audioEditorSession;
        audioEditorSession = null;
        audioEditMask.style.zIndex = session.zIndex;
        session.resolve(outcome === 'saved' ? Object.assign({ status: 'saved' }, detail || {}) : { status: 'cancelled' });
      }
    }
function openAudioEditorForFeature(options) {
      options = options || {};
      if (audioEditorSession) {
        var previous = audioEditorSession;
        audioEditorSession = null;
        audioEditMask.style.zIndex = previous.zIndex;
        previous.resolve({ status: 'cancelled' });
      }
      var group = null;
      if (options.groupId) {
        for (var i = 0; i < audioGroups.length; i++) if (audioGroups[i].id === options.groupId) group = audioGroups[i];
      }
      return new Promise(function (resolve) {
        audioEditorSession = { resolve: resolve, zIndex: audioEditMask.style.zIndex };
        audioEditMask.style.zIndex = '27000';
        openAudioGroupEditor(group);
      });
    }
var audioEditPreviewEl = null;
var audioEditPreviewRelease = null;
var audioEditPreviewTimer = null;
var audioEditPreviewReady = false;
var audioEditPreviewPressing = false;
var audioEditPreviewPressEnded = false;
var audioEditPreviewReleasePlayed = false;
function audioEditPreviewEnsure(force) {
      try {
        if (!force && audioEditPreviewReady) return true;
        var pressId = audioEditPressVal || '';
        var releaseId = audioEditReleaseVal || '';
        try {
          stopAudioEditPreview();
        } catch (err) {}
        try {
          if (audioEditPreviewEl) {
            audioEditPreviewEl.pause();
            audioEditPreviewEl = null;
          }
          if (audioEditPreviewRelease) {
            audioEditPreviewRelease.pause();
            audioEditPreviewRelease = null;
          }
        } catch (err) {}
        if (pressId) {
          audioEditPreviewEl = new Audio('/dsh-whale/audio-fragment.wav?id=' + encodeURIComponent(pressId));
          audioEditPreviewEl.preload = 'auto';
          audioEditPreviewEl.volume = ports.soundVol;
        }
        if (releaseId) {
          audioEditPreviewRelease = new Audio('/dsh-whale/audio-fragment.wav?id=' + encodeURIComponent(releaseId));
          audioEditPreviewRelease.preload = 'auto';
          audioEditPreviewRelease.volume = ports.soundVol;
        }
        audioEditPreviewReady = true;
        return true;
      } catch (err) {
        return false;
      }
    }
function audioEditPreviewDown() {
      try {
        stopAudioEditPreview();
        if (!audioEditPreviewEnsure()) return;
        audioEditPreviewPressing = true;
        audioEditPreviewPressEnded = false;
        audioEditPreviewReleasePlayed = false;
        if (!audioEditPreviewEl) {
          audioEditPreviewPressEnded = true;
          return;
        }
        audioEditPreviewEl.onended = lifecycle.guard(function () {
          audioEditPreviewPressEnded = true;
          if (!audioEditPreviewPressing && !audioEditPreviewReleasePlayed) audioEditPreviewUp();
        });
        var p = audioEditPreviewEl.play();
        if (p && typeof p.catch === 'function') p.catch(function () {});
      } catch (err) {}
    }
function audioEditPreviewUp() {
      try {
        if (!audioEditPreviewPressing) return;
        audioEditPreviewPressing = false;
        if (!audioEditPreviewEl) {
          audioEditPreviewPlayRelease();
          return;
        }
        if (audioEditPreviewPressEnded) {
          audioEditPreviewPlayRelease();
          return;
        }
        var durKnown = false;
        var remainMs = 0;
        try {
          var dur = audioEditPreviewEl ? audioEditPreviewEl.duration : 0;
          if (isFinite(dur) && dur > 0) {
            durKnown = true;
            remainMs = (dur - audioEditPreviewEl.currentTime) * 1000;
          }
        } catch (err) {}
        if (durKnown) {
          audioEditPreviewTimer = lifecycle.timeout(function () {
            audioEditPreviewTimer = null;
            audioEditPreviewPlayRelease();
          }, Math.max(0, remainMs - 100));
        }
      } catch (err) {}
    }
function audioEditPreviewPlayRelease() {
      try {
        if (audioEditPreviewReleasePlayed || !audioEditPreviewRelease) return;
        audioEditPreviewReleasePlayed = true;
        audioEditPreviewRelease.currentTime = 0;
        var p = audioEditPreviewRelease.play();
        if (p && typeof p.catch === 'function') p.catch(function () {});
      } catch (err) {}
    }
function stopAudioEditPreview() {
      try {
        if (audioEditPreviewTimer) {
          clearTimeout(audioEditPreviewTimer);
          audioEditPreviewTimer = null;
        }
        if (audioEditPreviewEl) {
          audioEditPreviewEl.pause();
          audioEditPreviewEl.currentTime = 0;
        }
        if (audioEditPreviewRelease) {
          audioEditPreviewRelease.pause();
          audioEditPreviewRelease.currentTime = 0;
        }
        audioEditPreviewPressing = false;
        audioEditPreviewPressEnded = false;
        audioEditPreviewReleasePlayed = false;
      } catch (err) {}
    }
function saveAudioGroup() {
      try {
        stopAudioEditPreview();
        var name = (audioEditName.value || '').trim().slice(0, 20);
        if (!name) {
          audioEditName.focus();
          return;
        }
        requestJson(AUDIO_URL, { signal: lifecycle.signal,
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: {
            action: 'save-group',
            id: editingAudioGroupId || '',
            name: name,
            press: audioEditPressVal || '',
            release: audioEditReleaseVal || ''
          }
        }).then(lifecycle.guard(function (d) {
          ports.requireSaved(d);
          if (d && d.ok && Array.isArray(d.groups)) {
            var openedFromFeature = !!audioEditorSession;
            var selectedGroupId = editingAudioGroupId || '';
            audioGroups = d.groups;
            if (Array.isArray(d.fragments)) audioFragments = d.fragments;
            renderAudioGroupPanel();
            ports.refreshTaskEndAfterAudio();
            if (!editingAudioGroupId) {
              var newest = d.groups.filter(function (x) {
                return !x.preset;
              }).sort(function (a, b) {
                return (b.pinnedAt || 0) - (a.pinnedAt || 0);
              })[0];
              if (newest) {
                selectedGroupId = newest.id;
                if (!openedFromFeature) ports.setSoundSet(newest.id);
              }
            } else if (!openedFromFeature && ports.soundSet === editingAudioGroupId) {
              try {
                ports.applySoundSet();
              } catch (err) { ports.assetFailure(err); }
            }
            hideAudioEditor('saved', {
              selectedGroupId: selectedGroupId,
              catalog: { groups: audioGroups.slice(), fragments: audioFragments.slice() }
            });
          }
        })).catch(lifecycle.guard(ports.assetFailure));
      } catch (err) { ports.assetFailure(err); }
    }
var audioCropFileInput = ports.document.createElement('input');
audioCropFileInput.type = 'file';
audioCropFileInput.accept = 'audio/*';
audioCropFileInput.style.display = 'none';
ports.document.body.appendChild(audioCropFileInput);
var audioCropTarget = null;
var audioCropCtx = null;
var audioCropBuffer = null;
var audioCropZoom = 1;
var audioCropOffset = 0;
lifecycle.listen(audioEditPressImport, 'click', function () {
      audioCropTarget = 'press';
      audioCropFileInput.click();
    });
lifecycle.listen(audioEditReleaseImport, 'click', function () {
      audioCropTarget = 'release';
      audioCropFileInput.click();
    });
lifecycle.listen(audioCropFileInput, 'change', async function () {
      var f = audioCropFileInput.files && audioCropFileInput.files[0];
      audioCropFileInput.value = '';
      if (!f) return;
      try {
        await ports.WhaleMediaGuard.validateAudioFile(f);
        var bytes = await f.arrayBuffer();
        if (!lifecycle.disposed) openAudioCrop(bytes, f.name);
      } catch (err) { if (!lifecycle.disposed) ports.assetNotice(err.message); }
    });
function openAudioCrop(arrayBuf, fileName) {
      try {
        audioCropZoom = 1;
        audioCropOffset = 0;
        stopAudioCropPreview();
        if (!audioCropCtx) {
          try {
            audioCropCtx = new (ports.window.AudioContext || ports.window.webkitAudioContext)();
          } catch (err) {
            audioCropCtx = null;
          }
        }
        if (!audioCropCtx) {
          ports.assetNotice('当前环境不支持音频解码');
          return;
        }
        audioCropCtx.decodeAudioData(arrayBuf, lifecycle.guard(function (buf) {
          var policy = ports.WhaleMediaGuard.getPolicy();
          if (!isFinite(buf.duration) || buf.duration <= 0 || buf.duration > policy.maxAudioSeconds ||
              buf.numberOfChannels > policy.maxAudioChannels || buf.sampleRate > policy.maxAudioSampleRate) {
            ports.assetNotice('音频超出时长、声道或采样率限制，请选择较短的音频');
            return;
          }
          audioCropBuffer = buf;
          audioCropStart.value = '0';
          audioCropEnd.value = '100';
          audioCropStartNum.max = buf.duration.toFixed(3);
          audioCropEndNum.max = buf.duration.toFixed(3);
          audioCropZoomRange.value = '1';
          audioCropZoomNum.value = '1';
          drawAudioCrop();
          try {
            audioCropName.value = '';
          } catch (err) {}
          updateAudioCropOkState();
          audioCropMask.style.display = 'flex';
        }), lifecycle.guard(function () {
          ports.assetNotice('音频解码失败');
        }));
      } catch (err) {}
    }
function audioCropRange() {
      var b = audioCropBuffer;
      if (!b) return null;
      var s = Number(audioCropStart.value) / 100;
      var e = Number(audioCropEnd.value) / 100;
      if (e < s) {
        var t = s;
        s = e;
        e = t;
      }
      return {
        start: b.duration * s,
        end: b.duration * e,
        s: s,
        e: e
      };
    }
function onAudioCropWheel(e) {
      if (!audioCropBuffer) return;
      try {
        e.preventDefault();
        e.stopPropagation();
      } catch (err) {}
      var maxOff = Math.max(0, 1 - 1 / audioCropZoom);
      if (maxOff <= 0) return;
      var dx = (e.deltaY || 0) + (e.deltaX || 0);
      if (dx === 0) return;
      var move = dx / audioCropCanvas.width / audioCropZoom;
      audioCropOffset = Math.min(maxOff, Math.max(0, audioCropOffset + move));
      drawAudioCrop();
    }
function drawAudioCrop(skipSync) {
      try {
        if (!audioCropBuffer) return;
        var r = audioCropRange();
        audioCropTime.textContent = r.start.toFixed(1) + 's – ' + r.end.toFixed(1) + 's' + '（共 ' + audioCropBuffer.duration.toFixed(1) + 's，缩放 x' + audioCropZoom.toFixed(1) + '）';
        var ctx = audioCropCanvas.getContext('2d');
        var W = audioCropCanvas.width, H = audioCropCanvas.height;
        ctx.clearRect(0, 0, W, H);
        ctx.fillStyle = '#f3f5fb';
        ctx.fillRect(0, 0, W, H);
        var ch = audioCropBuffer.getChannelData(0);
        var totalLen = ch.length;
        var viewStart = audioCropOffset;
        var viewSpan = 1 / audioCropZoom;
        ctx.strokeStyle = '#9fb0d9';
        ctx.lineWidth = 1;
        ctx.beginPath();
        for (var x = 0; x < W; x++) {
          var g0 = viewStart + x / W * viewSpan;
          var g1 = viewStart + (x + 1) / W * viewSpan;
          var i0 = Math.max(0, Math.floor(g0 * totalLen));
          var i1 = Math.max(i0 + 1, Math.min(totalLen - 1, Math.ceil(g1 * totalLen)));
          var mn = 0, mx = 0;
          for (var i = i0; i < i1; i++) {
            var v = ch[i];
            if (v < mn) mn = v;
            if (v > mx) mx = v;
          }
          var yTop = H / 2 - mx * H / 2;
          var yBot = H / 2 - mn * H / 2;
          ctx.moveTo(x, yTop);
          ctx.lineTo(x, yBot);
        }
        ctx.stroke();
        var vx0 = (r.s - viewStart) / viewSpan * W;
        var vx1 = (r.e - viewStart) / viewSpan * W;
        var drawX0 = Math.max(0, vx0);
        var drawX1 = Math.min(W, vx1);
        if (drawX1 > drawX0) {
          ctx.fillStyle = 'rgba(32,49,112,.25)';
          ctx.fillRect(drawX0, 0, drawX1 - drawX0, H);
          ctx.strokeStyle = '#203170';
          ctx.lineWidth = 2;
          ctx.strokeRect(drawX0 + 0.5, 0.5, drawX1 - drawX0, H - 1);
        }
        ctx.strokeStyle = 'rgba(32,49,112,.3)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(0, H - 1);
        ctx.lineTo(W, H - 1);
        ctx.stroke();
        if (!skipSync) {
          audioCropStartNum.value = r.start.toFixed(3);
          audioCropEndNum.value = r.end.toFixed(3);
          audioCropZoomRange.value = String(audioCropZoom);
          audioCropZoomNum.value = String(Math.round(audioCropZoom * 100) / 100);
        }
        try {
          var trackW = audioCropDual.clientWidth || 200;
          var usable = Math.max(1, trackW - 8);
          audioCropDualStart.style.left = 4 + r.s * usable + 'px';
          audioCropDualEnd.style.left = 4 + r.e * usable + 'px';
          audioCropDualFill.style.left = 4 + r.s * usable + 'px';
          audioCropDualFill.style.width = Math.max(0, (r.e - r.s) * usable) + 'px';
        } catch (err) {}
      } catch (err) {}
    }
function onAudioCropStartInput() {
      syncAudioCropStartNum();
      drawAudioCrop();
    }
function syncAudioCropStartNum() {
      var b = audioCropBuffer;
      if (!b) return;
      audioCropStartNum.value = (b.duration * Number(audioCropStart.value) / 100).toFixed(3);
    }
function onAudioCropEndInput() {
      syncAudioCropEndNum();
      drawAudioCrop();
    }
function syncAudioCropEndNum() {
      var b = audioCropBuffer;
      if (!b) return;
      audioCropEndNum.value = (b.duration * Number(audioCropEnd.value) / 100).toFixed(3);
    }
function onAudioCropStartNumInput() {
      var b = audioCropBuffer;
      if (!b) return;
      var v = Number(audioCropStartNum.value);
      if (!isFinite(v)) return;
      v = Math.min(Math.max(0, v), b.duration);
      var endSec = b.duration * Number(audioCropEnd.value) / 100;
      if (v > endSec - 0.001) v = Math.max(0, endSec - 0.001);
      audioCropStart.value = String(v / b.duration * 100);
      drawAudioCrop(true);
    }
function onAudioCropStartNumChange() {
      var b = audioCropBuffer;
      if (!b) return;
      var v = Number(audioCropStartNum.value);
      if (!isFinite(v)) v = 0;
      v = Math.min(Math.max(0, v), b.duration);
      var endSec = b.duration * Number(audioCropEnd.value) / 100;
      if (v > endSec - 0.001) v = Math.max(0, endSec - 0.001);
      audioCropStart.value = String(v / b.duration * 100);
      drawAudioCrop();
    }
function onAudioCropEndNumInput() {
      var b = audioCropBuffer;
      if (!b) return;
      var v = Number(audioCropEndNum.value);
      if (!isFinite(v)) return;
      v = Math.min(Math.max(0, v), b.duration);
      var startSec = b.duration * Number(audioCropStart.value) / 100;
      if (v < startSec + 0.001) v = Math.min(b.duration, startSec + 0.001);
      audioCropEnd.value = String(v / b.duration * 100);
      drawAudioCrop(true);
    }
function onAudioCropEndNumChange() {
      var b = audioCropBuffer;
      if (!b) return;
      var v = Number(audioCropEndNum.value);
      if (!isFinite(v)) v = b.duration;
      v = Math.min(Math.max(0, v), b.duration);
      var startSec = b.duration * Number(audioCropStart.value) / 100;
      if (v < startSec + 0.001) v = Math.min(b.duration, startSec + 0.001);
      audioCropEnd.value = String(v / b.duration * 100);
      drawAudioCrop();
    }
function applyAudioCropZoom(v, skipSync) {
      if (!audioCropBuffer) return;
      var next = Number(v);
      if (!isFinite(next) || next < 1) next = 1;
      if (next > 50) next = 50;
      var r = audioCropRange();
      var mid = (r.s + r.e) / 2;
      var viewSpan = 1 / audioCropZoom;
      var midInView = viewSpan > 0 ? (mid - audioCropOffset) / viewSpan : 0.5;
      audioCropZoom = next;
      var newSpan = 1 / audioCropZoom;
      audioCropOffset = mid - midInView * newSpan;
      audioCropOffset = Math.min(1 - 1 / audioCropZoom, Math.max(0, audioCropOffset));
      audioCropZoomRange.value = String(audioCropZoom);
      audioCropZoomNum.value = String(Math.round(audioCropZoom * 100) / 100);
      drawAudioCrop(skipSync);
    }
function onAudioCropZoomInput() {
      applyAudioCropZoom(audioCropZoomRange.value);
    }
function onAudioCropZoomNumInput() {
      var v = Number(audioCropZoomNum.value);
      if (!isFinite(v) || v < 1) return;
      if (v > 50) return;
      applyAudioCropZoom(v, true);
    }
function onAudioCropZoomNumChange() {
      applyAudioCropZoom(audioCropZoomNum.value);
    }
var audioCropSelDrag = null;
function onAudioCropSelDown(e) {
      if (!audioCropBuffer) return;
      try {
        e.preventDefault();
        e.stopPropagation();
      } catch (err) {}
      var rect = audioCropCanvas.getBoundingClientRect();
      var W = audioCropCanvas.width;
      var globalRatio = audioCropOffset + (e.clientX - rect.left) / W * (1 / audioCropZoom);
      globalRatio = Math.min(1, Math.max(0, globalRatio));
      audioCropSelDrag = {
        startRatio: globalRatio,
        moved: false
      };
      audioCropStart.value = String(globalRatio * 100);
      syncAudioCropStartNum();
      drawAudioCrop();
    }
function onAudioCropSelMove(e) {
      if (!audioCropSelDrag || !audioCropBuffer) return;
      var rect = audioCropCanvas.getBoundingClientRect();
      var W = audioCropCanvas.width;
      var globalRatio = audioCropOffset + (e.clientX - rect.left) / W * (1 / audioCropZoom);
      globalRatio = Math.min(1, Math.max(0, globalRatio));
      if (Math.abs(globalRatio - audioCropSelDrag.startRatio) > 0.002) audioCropSelDrag.moved = true;
      if (audioCropSelDrag.moved) {
        var s = Math.min(audioCropSelDrag.startRatio, globalRatio);
        var en = Math.max(audioCropSelDrag.startRatio, globalRatio);
        audioCropStart.value = String(s * 100);
        audioCropEnd.value = String(en * 100);
        syncAudioCropStartNum();
        syncAudioCropEndNum();
        drawAudioCrop();
      }
    }
function onAudioCropSelUp() {
      audioCropSelDrag = null;
    }
var audioCropDualDrag = null;
function onAudioCropDualDown(e) {
      if (!audioCropBuffer) return;
      try {
        e.preventDefault();
        e.stopPropagation();
      } catch (err) {}
      var ratio = audioCropDualRatio(e);
      var startV = Number(audioCropStart.value) / 100;
      var endV = Number(audioCropEnd.value) / 100;
      var dStart = Math.abs(ratio - startV);
      var dEnd = Math.abs(ratio - endV);
      audioCropDualDrag = {
        side: dStart <= dEnd ? 'start' : 'end'
      };
      audioCropDualMoveTo(ratio);
    }
function onAudioCropDualMove(e) {
      if (!audioCropDualDrag || !audioCropBuffer) return;
      audioCropDualMoveTo(audioCropDualRatio(e));
    }
function audioCropDualRatio(e) {
      var rect = audioCropDual.getBoundingClientRect();
      var usable = Math.max(1, rect.width - 8);
      var ratio = (e.clientX - rect.left - 4) / usable;
      return Math.min(1, Math.max(0, ratio));
    }
function audioCropDualMoveTo(ratio) {
      if (!audioCropDualDrag) return;
      var startV = Number(audioCropStart.value) / 100;
      var endV = Number(audioCropEnd.value) / 100;
      if (audioCropDualDrag.side === 'start') {
        if (ratio >= endV) ratio = Math.max(0, endV - 0.0001);
        audioCropStart.value = String(ratio * 100);
        syncAudioCropStartNum();
      } else {
        if (ratio <= startV) ratio = Math.min(1, startV + 0.0001);
        audioCropEnd.value = String(ratio * 100);
        syncAudioCropEndNum();
      }
      drawAudioCrop();
    }
function onAudioCropDualUp() {
      audioCropDualDrag = null;
    }
function hideAudioCrop() {
      stopAudioCropPreview();
      audioCropMask.style.display = 'none';
      audioCropBuffer = null;
      audioCropTarget = null;
      try {
        audioCropName.value = '';
      } catch (err) {}
      updateAudioCropOkState();
    }
var audioCropPreviewNode = null;
function stopAudioCropPreview() {
      try {
        if (audioCropPreviewNode) {
          audioCropPreviewNode.stop();
          audioCropPreviewNode.disconnect();
          audioCropPreviewNode = null;
        }
      } catch (err) {}
    }
function previewAudioCrop() {
      try {
        if (!audioCropBuffer || !audioCropCtx) return;
        stopAudioCropPreview();
        var r = audioCropRange();
        var len = Math.floor((r.end - r.start) * audioCropBuffer.sampleRate);
        if (len < 1) return;
        var slice = audioCropCtx.createBuffer(audioCropBuffer.numberOfChannels, len, audioCropBuffer.sampleRate);
        for (var c = 0; c < audioCropBuffer.numberOfChannels; c++) {
          var src = audioCropBuffer.getChannelData(c);
          var dst = slice.getChannelData(c);
          var off = Math.floor(r.start * audioCropBuffer.sampleRate);
          for (var i = 0; i < len; i++) dst[i] = src[off + i] || 0;
        }
        var srcNode = audioCropCtx.createBufferSource();
        srcNode.buffer = slice;
        srcNode.connect(audioCropCtx.destination);
        audioCropPreviewNode = srcNode;
        srcNode.onended = lifecycle.guard(function () {
          if (audioCropPreviewNode === srcNode) audioCropPreviewNode = null;
        });
        srcNode.start();
      } catch (err) {}
    }
function encodeWav(buffer) {
      var numCh = buffer.numberOfChannels;
      var sampleRate = buffer.sampleRate;
      var len = buffer.length;
      var bytesPerSample = 2;
      var blockAlign = numCh * bytesPerSample;
      var dataSize = len * blockAlign;
      var ab = new ArrayBuffer(44 + dataSize);
      var dv = new DataView(ab);
      function writeStr(offset, s) {
        for (var i = 0; i < s.length; i++) dv.setUint8(offset + i, s.charCodeAt(i));
      }
      writeStr(0, 'RIFF');
      dv.setUint32(4, 36 + dataSize, true);
      writeStr(8, 'WAVE');
      writeStr(12, 'fmt ');
      dv.setUint32(16, 16, true);
      dv.setUint16(20, 1, true);
      dv.setUint16(22, numCh, true);
      dv.setUint32(24, sampleRate, true);
      dv.setUint32(28, sampleRate * blockAlign, true);
      dv.setUint16(32, blockAlign, true);
      dv.setUint16(34, 16, true);
      writeStr(36, 'data');
      dv.setUint32(40, dataSize, true);
      var offset = 44;
      for (var i = 0; i < len; i++) {
        for (var c = 0; c < numCh; c++) {
          var v = buffer.getChannelData(c)[i];
          var s = Math.max(-1, Math.min(1, v));
          dv.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
          offset += 2;
        }
      }
      return new Blob([ab], {
        type: 'audio/wav'
      });
    }
function confirmAudioCrop() {
      try {
        if (!audioCropBuffer) return;
        stopAudioCropPreview();
        var fragName = String(audioCropName.value || '').trim();
        if (!fragName) {
          try {
            audioCropName.style.borderColor = '#e0433f';
            audioCropName.style.boxShadow = '0 0 0 2px rgba(224,67,63,.25)';
            audioCropName.focus();
            lifecycle.timeout(function () {
              audioCropName.style.borderColor = 'rgba(32,49,112,.4)';
              audioCropName.style.boxShadow = 'none';
            }, 1200);
          } catch (err) {}
          return;
        }
        var r = audioCropRange();
        var len = Math.floor((r.end - r.start) * audioCropBuffer.sampleRate);
        if (len < 1) {
          ports.assetNotice('所选片段为空');
          return;
        }
        if (44 + len * audioCropBuffer.numberOfChannels * 2 > ports.WhaleMediaGuard.getPolicy().audioBytes) {
          ports.assetNotice('所选音频片段过大，请缩短后再保存');
          return;
        }
        var slice = audioCropCtx.createBuffer(audioCropBuffer.numberOfChannels, len, audioCropBuffer.sampleRate);
        for (var c = 0; c < audioCropBuffer.numberOfChannels; c++) {
          var src = audioCropBuffer.getChannelData(c);
          var dst = slice.getChannelData(c);
          var off = Math.floor(r.start * audioCropBuffer.sampleRate);
          for (var i = 0; i < len; i++) dst[i] = src[off + i] || 0;
        }
        var blob = encodeWav(slice);
        ports.WhaleMediaGuard.checkFile(blob, 'wav');
        var reader = new FileReader();
        reader.onload = lifecycle.guard(function () {
          uploadAudioFragment(reader.result, fragName, function (ok) {
            if (ok) {
              if (audioCropTarget === 'press') {
                audioEditPressVal = lastUploadedFragmentId || audioEditPressVal;
                audioSlotBtnText(audioEditPressBtn, audioEditPressVal);
              } else if (audioCropTarget === 'release') {
                audioEditReleaseVal = lastUploadedFragmentId || audioEditReleaseVal;
                audioSlotBtnText(audioEditReleaseBtn, audioEditReleaseVal);
              }
              audioEditPreviewEnsure(true);
              hideAudioCrop();
            }
          });
        });
        reader.onerror = lifecycle.guard(function () { ports.assetNotice('音频读取失败，请重试'); });
        reader.readAsDataURL(blob);
      } catch (err) { if (!lifecycle.disposed) ports.assetNotice(err.message); }
    }
var lastUploadedFragmentId = null;
function uploadAudioFragment(dataUrl, name, cb) {
      try {
        ports.assetClient.uploadAudioFragment(name, dataUrl).then(lifecycle.guard(function (d) {
          ports.requireSaved(d);
          if (d && d.ok && Array.isArray(d.fragments)) {
            audioFragments = d.fragments;
            lastUploadedFragmentId = d.id || null;
            ports.refreshTaskEndAfterAudio();
            if (cb) cb(true);
          } else {
            if (cb) cb(false);
          }
        })).catch(function (error) {
          if (lifecycle.disposed) return;
          ports.assetFailure(error);
          if (cb) cb(false);
        });
      } catch (err) {
        if (cb) cb(false);
      }
    }
function audioDeleteFragmentInSlot(slot, id) {
      if (!id) return;
      var f = null;
      for (var i = 0; i < audioFragments.length; i++) if (audioFragments[i].id === id) {
        f = audioFragments[i];
        break;
      }
      if (!f || f.preset) return;
      ports.showConfirm('确定删除音频「' + f.name + '」吗？', function () {
        try {
          requestJson(AUDIO_URL, { signal: lifecycle.signal,
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: {
              action: 'delete-fragment',
              id: id
            }
          }).then(lifecycle.guard(function (d) {
          ports.requireSaved(d);
            if (d && d.ok && Array.isArray(d.fragments)) {
              audioFragments = d.fragments;
              if (Array.isArray(d.groups)) audioGroups = d.groups;
              if (slot === 'press' && audioEditPressVal === id) {
                audioEditPressVal = 'ya1';
                audioSlotBtnText(audioEditPressBtn, 'ya1');
              }
              if (slot === 'release' && audioEditReleaseVal === id) {
                audioEditReleaseVal = 'ya2';
                audioSlotBtnText(audioEditReleaseBtn, 'ya2');
              }
              audioEditPreviewEnsure(true);
              renderAudioGroupPanel();
              if (activeSlotPanel) renderAudioSlotPanel(slot);
              ports.refreshTaskEndAfterAudio();
            }
          })).catch(lifecycle.guard(ports.assetFailure));
        } catch (err) { ports.assetFailure(err); }
      });
    }
lifecycle.listen(audioEditPressBtn, 'click', function (e) {
      e.stopPropagation();
      toggleAudioSlotPanel('press');
    });
lifecycle.listen(audioEditReleaseBtn, 'click', function (e) {
      e.stopPropagation();
      toggleAudioSlotPanel('release');
    });
function dispose() { lifecycle.dispose(); hideAudioEditor(); hideAudioCrop(); closeAudioGroupPanel(); stopAudioEditPreview(); stopAudioCropPreview(); audioCropCtx?.close?.().catch(() => {}); audioEditMask.remove(); audioCropMask.remove(); audioCropFileInput.remove(); }
return { dispose, get audioGroups() { return audioGroups; }, set audioGroups(value) { audioGroups = value; },
get audioFragments() { return audioFragments; }, set audioFragments(value) { audioFragments = value; },
loadAudio,
audioGroupName,
audioGroupSlotEmpty,
toggleAudioGroupPanel,
closeAudioGroupPanel,
renderAudioGroupPanel,
openAudioGroupEditor,
openAudioEditorForFeature };
}
