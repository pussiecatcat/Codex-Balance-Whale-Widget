import { createBubbleRowsView } from '/features/widget/bubble-rows-view.js';
import '/money.js';
import '/quota.js';
import '/account-view.js';
import '/insights.js';
import '/workshop.js';
import '/media-guard.js';
import '/audio-engine.js';
import '/client.js';
import '/api-models.js';
import { requestJson } from '/services/request.js';
import { createTurnNoticePoller } from '/features/widget/turn-notice-poller.js';
import { createTaskEndSound } from '/features/widget/task-end-sound.js';
import { createNameMarquee } from '/features/widget/name-marquee.js';
import { createRoleManager } from '/features/widget/role-manager.js';
import { createCharacterInteraction } from '/features/widget/character-interaction.js';
import { createBubbleTemplateHelp } from '/features/widget/bubble-template-help.js';
import { createBubbleAdvanceControl } from '/features/widget/bubble-advance-control.js';
import { createConfirmDialog } from '/features/widget/confirm-dialog.js';
import { createAssetHelpers } from '/features/widget/asset-helpers.js';
import { createRoleCropEditor } from '/features/widget/role-crop-editor.js';
import { createAudioGroupList } from '/features/widget/audio-group-list.js';
import { createAudioSlotPanel } from '/features/widget/audio-slot-panel.js';
import { createAudioGroupEditor } from '/features/widget/audio-group-editor.js';
import { createAudioCropEditor } from '/features/widget/audio-crop-editor.js';
import { createModuleEditorView } from '/features/widget/module-editor-view.js';
import { createBubblePreviewView } from '/features/widget/bubble-preview-view.js';
import { createGifRoleDialog } from '/features/widget/gif-role-dialog.js';
import { createMenuControls } from '/features/widget/menu-controls.js';
import { createBubbleContent } from '/features/widget/bubble-content.js';
import { createUsageNavigation } from '/features/widget/usage-navigation.js';
import { createFxControls } from '/features/widget/fx-controls.js';
import { createUsageOverviewView } from '/features/widget/usage-overview-view.js';
import { createUsageModelsView } from '/features/widget/usage-models-view.js';
import { createUsagePanel } from '/features/widget/usage-panel.js';
import { createBubbleQuickEditors } from '/features/widget/bubble-quick-editors.js';
import { createBubblePalette } from '/features/widget/bubble-palette.js';
import { createBubbleColorSelect } from '/features/widget/bubble-color-select.js';
import { createSnapEditor } from '/features/widget/snap-editor.js';
import { createUsageAlerts } from '/features/widget/usage-alerts.js';
import { createUsageRecordsView } from '/features/widget/usage-records-view.js';
import { aggregateUsageModels, createUsageCharts } from '/features/widget/usage-charts.js';
import { createBubbleSceneController } from '/features/widget/bubble-scene.js';
import { createBubbleNoticeQueue } from '/features/widget/bubble-notice-queue.js';
import { createBubbleInteraction } from '/features/widget/bubble-interaction.js';
import { createAssetClient } from '/features/widget/asset-client.js';
import { createResourceManager } from '/features/widget/resource-manager.js';
import { createBubbleEditorView, bubbleDropShadow } from '/features/widget/bubble-editor-view.js';
import { createBubbleEditorController } from '/features/widget/bubble-editor-controller.js';
import { createReminderEditor } from '/features/widget/reminder-editor.js';
import { createItemEditor } from '/features/widget/item-editor.js';
import { loadBubbleEditorDraft, saveBubbleEditorDraft } from '/features/widget/bubble-editor-model.js';
import { snapBounds as calculateSnapBounds, snapZones as calculateSnapZones, artCenterAt, restoreAnchor, clampToViewport, settlePosition } from '/features/widget/anchors.js';
import { createCustomSelectController } from '/features/widget/custom-select.js';
import { bubbleIsImgMod, bubbleRowsOf, bubbleRowsFlat, bubbleRowsCanon } from '/features/widget/bubble-layout.js';
import {
  bubbleDefaultSubscriptionQueue, bubbleLegacySubscriptionDefault,
  bubbleDefaultSecondModules, bubbleDefaultQueue as buildBubbleDefaultQueue,
  bubbleModuleListLabel, bubbleEditEnsureModules,
  bubbleIsChoice, bubbleChoiceOptions, bubbleChoiceWeight, bubblePickChoiceItem,
} from '/features/widget/default-content.js';
// Adapted from MeteorNOX dsh-whale-widget (MIT). Scheduling modules removed; money display uses two decimals.
// ────────────────────────────────────────────────────────────────────────────
//  分段索引  SECTION INDEX
//
//  本文件是装配入口：DOM 装配与兼容适配留在这里，实现已迁到
//  /features/widget/* 与 /services/* 的模块。分段索引标的是还留在本文件里的区段。
//  各区段以方括号横幅（==== 加区段名）标记。取实时行号：
//
//      grep -n "==== \[" assets/whale-widget.js
//
//  1 素材与媒体工具            11 快速编辑器与调色板
//  2 菜单行与下拉选择          12 气泡预览与样式
//  3 任务结束音效              13 模块编辑器
//  4 汇率显示                  14 GIF 角色确认
//  5 用量面板与设置            15 音频裁剪与气泡测量
//  6 资源管理器                16 气泡渲染与行模板
//  7 用量图表与记录窗口        17 刷新与配置保存
//  8 快照预览                  18 角色面板与裁图确认
//  9 气泡默认内容              19 音频组与槽面板
// 10 气泡编辑器                20 拖拽与锚点定位
//
//  对外契约：与其他 desktop/ui/*.js 插件通过 window.* 通信
//  （WhaleFeedback / WhaleAccountView / WhaleGesture / WhaleQuota /
//    WhaleMoney / WhaleApiModels）。改动前先确认调用方。
// ────────────────────────────────────────────────────────────────────────────
(function () {
  if (window.__dshWhaleWidget || window.__dshWhaleWidgetLoading) return;
  window.__dshWhaleWidgetLoading = true;
  var dshwEnabled = true;
  function dshwInit() {
    if (window.__dshWhaleInit) return true;
    if (window.__dshWhaleInitLoading) return false;
    window.__dshWhaleInitLoading = true;
    var MIN_SCALE = 0.6;
    var MAX_SCALE = 2.5;
    var CLICK_SQ = 9;
    var REFRESH_MS = 60000;


    var BUBBLE_MS = 5000;
    var FETCH_TIMEOUT_MS = 25000;
    var whaleMoneyTemplates = new WeakMap();
    var BALANCE_URL = '/dsh-whale/balance.json';
    var SETTINGS_URL = '/api/sound-settings';
    var IMG_URL = '/dsh-whale/image.png?v=2';
    var GIF_URL = '/dsh-whale/rua.gif';
    var ROLE_URL = '/dsh-whale/roles.json';
    var assetClient = createAssetClient();
    var confirmDialog = createConfirmDialog({ document: document });
    var showConfirm = confirmDialog.show;

    // The combined settings endpoint owns both settings files and guards them
    // with a revision, so a partial update has to read the pair, merge, and send
    // both back. A 409 means something else wrote in between; the local change is
    // the one the user just made, so re-read once and re-apply it rather than
    // dropping the edit.
    function updateSoundSettings(mutate, onSaved, attempt) {
      attempt = attempt || 0;
      return requestJson(SETTINGS_URL).then(function (current) {
        if (!current || current.ok !== true) throw new Error(current && current.error || '无法读取设置');
        var next = mutate({ size: current.size, usage: current.usage });
        return requestJson(SETTINGS_URL, {
          method: 'PUT',
          body: {
            schemaVersion: current.schemaVersion,
            revision: current.revision,
            size: next.size,
            usage: next.usage
          }
        });
      }).then(function (body) {
        requireSaved(body);
        if (onSaved) onSaved(body);
        return body;
      }).catch(function (error) {
        if (error && error.status === 409 && attempt < 1) return updateSoundSettings(mutate, onSaved, attempt + 1);
        assetFailure(error);
      });
    }

    // ==== [素材与媒体工具] ====
    var assetHelpers = createAssetHelpers({ window: window, FileReader: FileReader });
    var assetNotice = assetHelpers.notice;
    var assetWarning = assetHelpers.warning;
    var requireSaved = assetHelpers.requireSaved;
    var assetFailure = assetHelpers.failure;
    var mediaDataUrl = assetHelpers.mediaDataUrl;
    var root = document.createElement('div');
    root.className = 'dshwv-root';
    var positioner = document.createElement('div');
    positioner.className = 'dshwv-position';
    positioner.appendChild(root);
    var img = document.createElement('img');
    img.className = 'dshwv-img';
    var initRoleUrl = IMG_URL;
    try {
      var initRoleId = localStorage.getItem('dshw-role') || '';
      if (initRoleId && initRoleId !== 'default') initRoleUrl = '/dsh-whale/role-image.png?id=' + encodeURIComponent(initRoleId);
    } catch (err) {}
    img.src = initRoleUrl;
    img.alt = '当前 API 余额';
    img.draggable = false;
    var menuBtn = document.createElement('button');
    menuBtn.type = 'button';
    menuBtn.className = 'dshwv-menu-btn';
    menuBtn.title = '菜单';
    menuBtn.innerHTML = '<span></span><span></span><span></span>';
    menuBtn.addEventListener('click', function (e) {
      e.stopPropagation();
      toggleMenu();
    });
    var menuBox = document.createElement('div');
    menuBox.className = 'dshwv-menu';
    menuBox.addEventListener('scroll', function () {
      dshwCustSelClose(); closeRolePanel(); closeAudioGroupPanel(); closeFxInfo();
    });

    // ==== [菜单行与下拉选择] ====
    function menuLabel(text) {
      var s = document.createElement('span');
      s.textContent = text;
      return s;
    }
    function menuRow() {
      var r = document.createElement('div');
      r.className = 'dshwv-menu-row';
      return r;
    }
    var menuControls = createMenuControls({
      document: document, positioner: positioner, minScale: MIN_SCALE, maxScale: MAX_SCALE,
      setScale: setScale, refreshFlip: refreshFlip,
      toggleAudioGroupPanel: function () { return toggleAudioGroupPanel(); },
      openAudioGroupEditor: function (group) { return openAudioGroupEditor(group); },
      toggleUsagePanel: function () { return toggleUsagePanel(); }
    });
    var scaleInput = menuControls.scaleInput, scaleNumber = menuControls.scaleNumber;
    var audioGroupBtn = menuControls.audioGroupBtn, audioGroupBtnLabel = menuControls.audioGroupBtnLabel, audioGroupPanel = menuControls.audioGroupPanel;
    var audioImportBtn = menuControls.audioImportBtn, usageRecBtn = menuControls.usageRecBtn;
    var nameMarquee = createNameMarquee({ document: document });
    var makeNameCell = nameMarquee.makeCell;
    var bindNameMarquee = nameMarquee.bind;
    var customSelect = createCustomSelectController({ document: document, window: window,
      dropOpen: dshwDropOpen, makeNameCell: makeNameCell, bindNameMarquee: bindNameMarquee });
    var dshwCustSel = customSelect.enhance;
    var dshwCustSelClose = customSelect.close;
    window.WhaleSelect = window.WhaleSelect || {};
    window.WhaleSelect.enhance = customSelect.enhance;
    window.WhaleSelect.close = customSelect.close;
    window.WhaleSelect.sync = customSelect.sync;
    window.WhaleSelect.refresh = customSelect.refresh;
    var usageRecBtn = document.createElement('button');
    usageRecBtn.type = 'button';
    usageRecBtn.className = 'dshwv-roleimport';
    usageRecBtn.dataset.action = 'toggle-usage-records';
    usageRecBtn.textContent = '- = 小龙娘记账 = -';
    usageRecBtn.title = '打开小龙娘记账';
    usageRecBtn.addEventListener('click', function (e) {
      e.stopPropagation();
      toggleUsagePanel();
    });
    var taskEndToggle = document.createElement('input');
    taskEndToggle.type = 'checkbox';
    taskEndToggle.className = 'dshwv-check';
    taskEndToggle.checked = false;
    taskEndToggle.title = '每轮对话回复完成时播放提示音';
    taskEndToggle.addEventListener('change', function () {
      var settings = usagePanelApi.getUsageSet() || ({});
      settings.taskEnd = settings.taskEnd || ({ on: false, sel: '' });
      settings.taskEnd.on = taskEndToggle.checked;
      usagePanelApi.setUsageSet(settings);
      taskEndSel.disabled = !taskEndToggle.checked;
      if (taskEndDrop) taskEndDrop.refresh();
      usagePanelApi.save({ taskEnd: settings.taskEnd });
    });
    var taskEndSel = document.createElement('select');
    var taskEndDrop = null;
    taskEndSel.className = 'dshwv-sound';
    taskEndSel.disabled = true;
    taskEndSel.title = '选择任务结束音:音效组(点按整组)/单个音频(与按下/松开同库)';
    taskEndSel.addEventListener('change', function () {
      var settings = usagePanelApi.getUsageSet() || ({});
      settings.taskEnd = settings.taskEnd || ({ on: false, sel: '' });
      settings.taskEnd.sel = taskEndSel.value;
      usagePanelApi.setUsageSet(settings);
      usagePanelApi.save({ taskEnd: settings.taskEnd });
    });

    // ==== [任务结束音效] ====
    var taskEndSound = createTaskEndSound({
      document: document, window: window, Audio: Audio, taskEndSelect: taskEndSel,
      getTaskEndDrop: function () { return taskEndDrop; },
      getUsageSettings: function () { return usagePanelApi.getUsageSet(); },
      setUsageSettings: function (settings) { usagePanelApi.setUsageSet(settings); },
      getAudioGroups: function () { return audioGroups; },
      getAudioFragments: function () { return audioFragments; },
      audioGroupName: audioGroupName,
      getSoundState: function () { return { on: soundOn, volume: soundVol }; }
    });
    var fillTaskEndOptions = taskEndSound.fillOptions;
    var refreshTaskEndAfterAudio = taskEndSound.refreshAfterAudio;
    var playTaskEndSound = taskEndSound.play;
    var bubbleToggle = document.createElement('input');
    bubbleToggle.type = 'checkbox';
    bubbleToggle.className = 'dshwv-check';
    bubbleToggle.checked = true;
    bubbleToggle.title = '开启/关闭思考气泡';
    bubbleToggle.addEventListener('change', function () {
      setBubbleOn(bubbleToggle.checked);
    });
    var turnCostToggle = document.createElement('input');
    turnCostToggle.type = 'checkbox';
    turnCostToggle.className = 'dshwv-check';
    turnCostToggle.checked = true;
    turnCostToggle.title = '每轮对话结束后自动显示本轮消耗金额';
    turnCostToggle.addEventListener('change', function () {
      setTurnCostOn(turnCostToggle.checked);
    });
    var turnCostCloseInput = document.createElement('input');
    turnCostCloseInput.type = 'number';
    turnCostCloseInput.min = '0';
    turnCostCloseInput.step = '1';
    turnCostCloseInput.className = 'dshwv-number';
    turnCostCloseInput.value = '5';
    turnCostCloseInput.disabled = false;
    turnCostCloseInput.title = '填 0 表示不自动关闭，需手动点击关闭';
    turnCostCloseInput.addEventListener('input', function () {
      setTurnCostClose(turnCostCloseInput.value);
    });
    turnCostCloseInput.addEventListener('change', function () {
      setTurnCostClose(turnCostCloseInput.value);
    });
    var scrollGapToggle = document.createElement('input');
    scrollGapToggle.type = 'checkbox';
    scrollGapToggle.className = 'dshwv-check';
    scrollGapToggle.checked = false;
    scrollGapToggle.title = '开启后挂件右侧按设定像素避开滚动条；关闭则贴边（盖住滚动条）';
    scrollGapToggle.addEventListener('change', function () {
      setScrollGapOn(scrollGapToggle.checked);
    });
    var scrollGapInput = document.createElement('input');
    scrollGapInput.type = 'number';
    scrollGapInput.min = '0';
    scrollGapInput.step = '1';
    scrollGapInput.className = 'dshwv-number';
    scrollGapInput.value = '17';
    scrollGapInput.disabled = true;
    scrollGapInput.title = '避让滚动条的像素宽度，填 0 表示贴边';
    scrollGapInput.addEventListener('input', function () {
      setScrollGapPx(scrollGapInput.value);
    });
    scrollGapInput.addEventListener('change', function () {
      setScrollGapPx(scrollGapInput.value);
    });
    var row1 = menuRow();
    row1.appendChild(menuLabel('大小'));
    row1.appendChild(scaleInput);
    row1.appendChild(scaleNumber);
    var shapeRow = menuRow();
    shapeRow.appendChild(menuLabel('气泡形状'));
    var shapeSel = document.createElement('select');
    shapeSel.id = 'dshw-bubble-shape';
    shapeSel.className = 'dshwv-sound';
    shapeSel.title = '切换气泡外形：椭圆更圆润，圆角方形能显示更多内容';
    [['ellipse', '椭圆'], ['round', '圆角方形']].forEach(function (entry) {
      var option = document.createElement('option');
      option.value = entry[0]; option.textContent = entry[1]; shapeSel.appendChild(option);
    });
    shapeRow.appendChild(shapeSel);
    dshwCustSel(shapeSel, { bottom: function () { return row2; } });
    shapeSel.parentNode.style.flex = '0 0 104px';
    shapeSel.parentNode.style.width = '104px';
    shapeSel.addEventListener('change', function () {
      var applied = applyBubbleShape(shapeSel.value);
      shapeSel.value = applied;
      try { localStorage.setItem('dshw-bubble-shape', applied); } catch (err) {}
      // The committed frame was fitted against the previous path.
      try { window.WhaleRendering && window.WhaleRendering.presentFor(260); } catch (err) {}
    });
    var row2 = menuRow();
    row2.appendChild(menuLabel('音效'));
    row2.appendChild(audioGroupBtn);
    row2.appendChild(audioImportBtn);
    var volInput = document.createElement('input');
    volInput.type = 'range';
    volInput.min = '0';
    volInput.max = '1';
    volInput.step = '0.05';
    volInput.className = 'dshwv-range';
    volInput.value = '0.9';
    var volPct = document.createElement('span');
    volPct.className = 'dshwv-volpct';
    volPct.textContent = '90%';
    volInput.addEventListener('input', function () {
      setVol(volInput.value);
    });
    var row3 = menuRow();
    row3.appendChild(menuLabel('音量'));
    row3.appendChild(volInput);
    row3.appendChild(volPct);
    var row6 = menuRow();
    row6.appendChild(menuLabel('气泡全局开关'));
    row6.appendChild(bubbleToggle);
    var bubbleCustomBtn = document.createElement('button');
    bubbleCustomBtn.type = 'button';
    bubbleCustomBtn.className = 'dshwv-roleimport';
    bubbleCustomBtn.style.flex = '1';
    bubbleCustomBtn.textContent = '自定义泡泡';
    bubbleCustomBtn.title = '打开“自定义泡泡”设置';
    bubbleCustomBtn.addEventListener('click', function (e) {
      e.stopPropagation();
      openBubbleEditor();
    });
    row6.appendChild(bubbleCustomBtn);
    var menuSep1 = document.createElement('div');
    menuSep1.className = 'dshwv-menu-sep';
    var row7 = menuRow();
    row7.appendChild(menuLabel('每轮消耗提示'));
    row7.appendChild(turnCostToggle);
    row7.appendChild(menuLabel('自动关闭'));
    row7.appendChild(turnCostCloseInput);
    row7.appendChild(menuLabel('秒'));
    var turnCostEditBtn = document.createElement('button');
    turnCostEditBtn.type = 'button';
    turnCostEditBtn.className = 'dshwv-roleimport';
    turnCostEditBtn.textContent = '自定义';
    turnCostEditBtn.title = '编辑每轮结束后显示的泡泡内容和样式';
    turnCostEditBtn.addEventListener('click', function (e) {
      e.stopPropagation();
      usageAlertBudgetEditor('turnCost', function (o) {
        var settings = usagePanelApi.getUsageSet() || ({}); settings.turnCost = { lines: o.lines };
        usagePanelApi.setUsageSet(settings);
        setTurnCostOn(o.on); setTurnCostClose(o.ttlSec);
        usagePanelApi.save({ turnCost: settings.turnCost });
      });
    });
    row7.appendChild(turnCostEditBtn);
    var row9 = menuRow();
    row9.appendChild(menuLabel('避让滚动条'));
    row9.appendChild(scrollGapToggle);
    row9.appendChild(menuLabel('宽度'));
    row9.appendChild(scrollGapInput);
    row9.appendChild(menuLabel('px'));
    var roleBtn = document.createElement('button');
    roleBtn.type = 'button';
    roleBtn.className = 'dshwv-rolebtn';
    roleBtn.title = '选择角色';
    var roleBtnLabel = document.createElement('span');
    roleBtnLabel.className = 'dshwv-btnlabel';
    roleBtnLabel.textContent = '小鲸鱼';
    roleBtn.appendChild(roleBtnLabel);
    var rolePanel = document.createElement('div');
    rolePanel.className = 'dshwv-rolelist';
    var roleImportBtn = document.createElement('button');
    roleImportBtn.type = 'button';
    roleImportBtn.className = 'dshwv-roleimport';
    roleImportBtn.textContent = '导入';
    roleImportBtn.title = '导入自定义角色图片';
    var rowRole = menuRow();
    rowRole.appendChild(menuLabel('角色'));
    rowRole.appendChild(roleBtn);
    rowRole.appendChild(roleImportBtn);
    var roleFileInput = document.createElement('input');
    roleFileInput.type = 'file';
    roleFileInput.accept = 'image/*';
    roleFileInput.style.display = 'none';
    var roleManager = createRoleManager({
      document: document, window: window, localStorage: localStorage, location: location, Image: Image,
      rendering: WhaleRendering, imageElement: img, roleButton: roleBtn, roleButtonLabel: roleBtnLabel,
      rolePanel: rolePanel, imageUrl: IMG_URL, assetClient: assetClient, assetWarning: assetWarning,
      assetNotice: assetNotice, assetFailure: assetFailure, requireSaved: requireSaved,
      viewport: viewport, setupHitTest: function (url) { return characterInteraction.setupHitTest(url); }, makeNameCell: makeNameCell,
      bindNameMarquee: bindNameMarquee, confirm: showConfirm
    });
    var closeRolePanel = roleManager.close;
    var toggleRolePanel = roleManager.toggle;
    var loadRoles = roleManager.load;
    var applyRole = roleManager.apply;
    roleBtn.addEventListener('click', function (e) {
      e.stopPropagation();
      toggleRolePanel();
    });
    roleImportBtn.addEventListener('click', function (e) {
      e.stopPropagation();
      roleFileInput.click();
    });
    roleFileInput.addEventListener('change', function () {
      onRoleFileChosen(roleFileInput);
    });
    menuBox.appendChild(rowRole);
    menuBox.appendChild(row1);
    menuBox.appendChild(shapeRow);
    menuBox.appendChild(row2);
    menuBox.appendChild(row3);
    menuBox.appendChild(row6);
    menuBox.appendChild(row7);
    var rowTaskEnd = menuRow();
    rowTaskEnd.appendChild(menuLabel('任务结束音效'));
    rowTaskEnd.appendChild(taskEndToggle);
    rowTaskEnd.appendChild(taskEndSel);
    taskEndDrop = dshwCustSel(taskEndSel, {
      bottom: function () {
        return usageNavRow;
      },
      scrollNames: true
    });
    try {
      var taskEndWrapEl = taskEndSel.parentNode;
      if (taskEndWrapEl) {
        taskEndWrapEl.style.flex = '0 0 120px';
        taskEndWrapEl.style.width = '120px';
        taskEndWrapEl.style.maxWidth = '120px';
      }
    } catch (err) {}
    menuBox.appendChild(rowTaskEnd);
    var currencyRow = menuRow();
    currencyRow.dataset.accountApi = 'true';
    currencyRow.appendChild(menuLabel('显示币种'));
    var currencySel = document.createElement('select');
    currencySel.id = 'dshw-display-currency';
    currencySel.className = 'dshwv-sound';
    [['USD', '美元 USD'], ['CNY', '人民币 CNY']].forEach(function (entry) {
      var option = document.createElement('option');
      option.value = entry[0]; option.textContent = entry[1]; currencySel.appendChild(option);
    });
    currencyRow.appendChild(currencySel);
    var currencyDrop = dshwCustSel(currencySel, { bottom: function () { return usageNavRow; } });
    currencySel.parentNode.style.flex = '0 0 120px';
    currencySel.parentNode.style.width = '120px';
    menuBox.appendChild(currencyRow);
    var currencyNote = document.createElement('div');
    currencyNote.className = 'dshwv-fx-info';
    currencyNote.id = 'dshw-currency-note';
    currencyNote.hidden = true; currencyNote.tabIndex = -1;
    currencyNote.setAttribute('role', 'region'); currencyNote.setAttribute('aria-label', '参考汇率说明');
    document.body.appendChild(currencyNote);
    var fxRefreshRow = menuRow();
    fxRefreshRow.dataset.accountApi = 'true';
    fxRefreshRow.appendChild(menuLabel('参考汇率'));
    var fxRefreshBtn = document.createElement('button');
    fxRefreshBtn.type = 'button'; fxRefreshBtn.className = 'dshwv-roleimport';
    fxRefreshBtn.id = 'dshw-fx-refresh'; fxRefreshBtn.textContent = '刷新汇率';
    fxRefreshBtn.title = '立即检查 Frankfurter 汇率并更新金额文字；15 秒内避免重复请求';
    fxRefreshRow.appendChild(fxRefreshBtn);
    var fxInfoBtn = document.createElement('button');
    fxInfoBtn.type = 'button'; fxInfoBtn.className = 'dshwv-fx-info-button';
    fxInfoBtn.id = 'dshw-fx-info'; fxInfoBtn.textContent = '!';
    fxInfoBtn.setAttribute('aria-label', '查看参考汇率说明');
    fxInfoBtn.setAttribute('aria-controls', currencyNote.id); fxInfoBtn.setAttribute('aria-expanded', 'false');
    fxRefreshRow.appendChild(fxInfoBtn); menuBox.appendChild(fxRefreshRow);

    // ==== [汇率显示] ====
    var fxControls = createFxControls({
      document: document, window: window, WhaleMoney: WhaleMoney, currencyNote: currencyNote,
      fxInfoBtn: fxInfoBtn, fxRefreshBtn: fxRefreshBtn, currencySel: currencySel,
      currencyDrop: currencyDrop, dshwCustSelClose: dshwCustSelClose,
      closeRolePanel: closeRolePanel, closeAudioGroupPanel: closeAudioGroupPanel,
      assetNotice: assetNotice
    });
    var closeFxInfo = fxControls.close;
    menuBox.appendChild(menuSep1);
    menuBox.appendChild(row9);
    var rowSnap = menuRow();
    var snapRowLabel = document.createElement('span');
    snapRowLabel.textContent = '吸附与翻转';
    var snapCustomBtn = document.createElement('button');
    snapCustomBtn.type = 'button';
    snapCustomBtn.className = 'dshwv-roleimport';
    snapCustomBtn.textContent = '自定义';
    snapCustomBtn.title = '自定义各边吸附区宽度与翻转线位置';
    snapCustomBtn.addEventListener('click', function (e) {
      e.stopPropagation();
      openSnapModal();
    });
    rowSnap.appendChild(snapRowLabel);
    rowSnap.appendChild(snapCustomBtn);
    menuBox.appendChild(rowSnap);
    var menuHideToggle = document.createElement('input');
    menuHideToggle.type = 'checkbox';
    menuHideToggle.className = 'dshwv-check';
    menuHideToggle.checked = false;
    menuHideToggle.title = '启用后隐藏挂件上的菜单按钮;右键小鲸鱼可唤出菜单(位置不变)';
    menuHideToggle.addEventListener('change', function () {
      setMenuBtnHide(menuHideToggle.checked);
    });
    var rowHide = menuRow();
    rowHide.appendChild(menuLabel('隐藏菜单按钮'));
    rowHide.appendChild(menuHideToggle);
    menuBox.appendChild(rowHide);
    var rowRes = menuRow();
    var resOpenBtn = document.createElement('button');
    resOpenBtn.type = 'button';
    resOpenBtn.className = 'dshwv-roleimport';
    resOpenBtn.style.flex = '1';
    resOpenBtn.textContent = '管理';
    resOpenBtn.title = '集中管理当前导入插件的图片与音频资源';
    resOpenBtn.addEventListener('click', function (e) {
      e.stopPropagation();
      openResManager();
    });
    rowRes.appendChild(menuLabel('资源管理'));
    rowRes.appendChild(resOpenBtn);
    menuBox.appendChild(rowRes);
    var rowLogs = menuRow();
    var logsOpenBtn = document.createElement('button');
    logsOpenBtn.type = 'button';
    logsOpenBtn.className = 'dshwv-roleimport';
    logsOpenBtn.textContent = '打开';
    logsOpenBtn.title = '打开运行日志目录（runtime.log）；反馈问题时请附上最近一段';
    logsOpenBtn.addEventListener('click', function (e) {
      e.stopPropagation();
      if (window.whaleDesktop && window.whaleDesktop.command) {
        Promise.resolve(window.whaleDesktop.command('diagnostics')).catch(function () {});
      }
    });
    rowLogs.appendChild(menuLabel('运行日志'));
    rowLogs.appendChild(logsOpenBtn);
    menuBox.appendChild(rowLogs);
    var USAGE_REC_URL = '/dsh-whale/usage-records.json';

    // ==== [用量面板与设置] ====
    var usagePanelApi = createUsagePanel({
      document: document, requestJson: requestJson, settingsUrl: SETTINGS_URL, recordsUrl: USAGE_REC_URL,
      assetWarning: assetWarning, assetFailure: assetFailure, WhaleMoney: WhaleMoney,
      updateSoundSettings: updateSoundSettings,
      getPanel: function () { return usagePanel; }, getMain: function () { return usageMainEl; },
      fill: function (d) { fillUsagePanel(d); }, getState: function () { return state; },
      refreshBalance: function (manual) { refresh(manual); },
      getTodayKey: function () { return usageTodayKeyStr(); },
      getRecordsView: function () { return usageRecordsView; }
    });
    var loadUsageSettings = usagePanelApi.load;
    var usageReconcileEditor = usagePanelApi.reconcile;
    var refreshUsageMain = usagePanelApi.refresh;
    var openUsageRecordsWindow = usagePanelApi.openRecords;
    var closeUsageRecordsWindow = usagePanelApi.close;
    var apiSettingsBtn = document.createElement('button');
    apiSettingsBtn.type = 'button';
    apiSettingsBtn.className = 'dshwv-roleimport dshwv-api-open';
    apiSettingsBtn.dataset.action = 'open-api-settings';
    apiSettingsBtn.dataset.accountApi = 'true';
    apiSettingsBtn.textContent = 'API 设置';
    apiSettingsBtn.addEventListener('click', function (e) {
      e.stopPropagation();
      window.dispatchEvent(new Event('whale-open-settings'));
    });
    menuBox.appendChild(apiSettingsBtn);
    var menuRootView = document.createElement('div');
    menuRootView.className = 'dshwv-menuview';
    while (menuBox.firstChild) menuRootView.appendChild(menuBox.firstChild);
    menuBox.appendChild(menuRootView);

    // ── 一级快捷菜单收敛 ────────────────────────────────────────────────
    // 方案要求一级只保留七项日常操作，其余全部搬进独立的完整设置窗口。
    // 这里不重写上面那些行的构建逻辑（它们各自绑着事件和存储写入），
    // 而是按行首文字把要下沉的行隐藏掉，再就地补三行控件。
    function syncLevel1Controls() {
      // 打开菜单时把新控件同步成当前真实值。已有的非标准组合显示「自定义」，
      // 打开菜单不能把用户已有的提醒组合改写成标准三选一。
      try {
        var modeSel = document.getElementById('dshw-desktop-display');
        if (modeSel && window.whaleDesktop && window.whaleDesktop.command) {
          Promise.resolve(window.whaleDesktop.command('mode')).then(function (mode) {
            if (mode) modeSel.value = mode;
          }).catch(function () {});
        }
        var clickToggle = document.getElementById('dshw-click-sound');
        var remindSel = document.getElementById('dshw-complete-reminder');
        if (!clickToggle && !remindSel) return;
        // 主线把 size 与 usage 合在 /api/sound-settings 的一份快照里。
        requestJson(SETTINGS_URL, { cache: 'no-store' }).then(function (d) {
          if (clickToggle && d && typeof d.size?.sound === 'boolean') clickToggle.checked = d.size.sound;
          if (!remindSel) return;
          var bubbleOn = !d || d.size?.turnCostOn !== false;
          var soundOn2 = !!(d && d.usage && d.usage.taskEnd && d.usage.taskEnd.on === true);
          var value = !bubbleOn && !soundOn2 ? 'off' : bubbleOn && !soundOn2 ? 'bubble' : bubbleOn && soundOn2 ? 'both' : 'custom';
          if (value === 'custom' && !remindSel.querySelector('option[value="custom"]')) {
            var custom = document.createElement('option');
            custom.value = 'custom';
            custom.textContent = '自定义';
            remindSel.appendChild(custom);
          }
          remindSel.value = value;
        }).catch(function () {});
      } catch (err) {}
    }
    // 一级菜单「点击音效」用的开关。只影响按下与松开，
    // 任务完成、余额预警的提示音各自独立，不受它影响。
    function setSoundOn(v) {
      soundOn = v !== false;
      try {
        if (pressAudio) pressAudio.volume = soundOn ? soundVol : 0;
        if (releaseAudio) releaseAudio.volume = soundOn ? soundVol : 0;
      } catch (err) {}
      saveConfig();
    }
    (function compactLevel1Menu() {
      function run() {
        var root = menuRootView;
        if (!root || !root.parentNode) return;
        function rowByLabel(text) {
          var rows = Array.prototype.slice.call(root.children);
          for (var i = 0; i < rows.length; i++) {
            if (rows[i].classList && rows[i].classList.contains('dshwv-menu-row')) {
              var first = rows[i].firstElementChild;
              if (first && first.textContent && first.textContent.trim().indexOf(text) === 0) return rows[i];
            }
          }
          return null;
        }
        function setLabel(row, text) {
          if (!row || !row.firstElementChild) return;
          row.firstElementChild.textContent = text;
        }
        function sink(row) {
          if (!row) return;
          // account-view 会在之后异步刷新并把 [data-account-api] 的 hidden 置回
          // false，所以除了 hidden 还要加一个强制 display:none 的类，
          // 否则下沉掉的「显示币种」会自己冒回来。
          row.hidden = true;
          row.classList.add('dshwv-level1-sunk');
        }
        // 下沉到完整设置窗口的行：一行都不留在日常菜单里。
        ['音效', '音量', '每轮消耗提示', '任务结束音效', '音效与提示', '气泡形状',
          '避让滚动条', '吸附与翻转', '隐藏菜单按钮', '资源管理', '显示币种', '参考汇率',
          '峰谷时段', '素材包导入/导出', '进入独立桌面', '改为跟随 Codex'].forEach(function (text) {
          sink(rowByLabel(text));
        });
        setLabel(rowByLabel('气泡全局开关'), '气泡');
        // 旧的整屏「API 设置」按钮由「高级设置…」取代。
        if (typeof apiSettingsBtn !== 'undefined' && apiSettingsBtn) sink(apiSettingsBtn);

        if (root.dataset.compacted === '1') return;
        root.dataset.compacted = '1';

        var modeRow = menuRow();
        modeRow.appendChild(menuLabel('桌面显示'));
        var modeSel = document.createElement('select');
        modeSel.id = 'dshw-desktop-display';
        modeSel.className = 'dshwv-sound';
        [['follow-codex', '跟随 Codex'], ['standalone', '常驻桌面']].forEach(function (entry) {
          var option = document.createElement('option');
          option.value = entry[0];
          option.textContent = entry[1];
          modeSel.appendChild(option);
        });
        modeSel.addEventListener('change', function () {
          try { window.whaleDesktop.command(modeSel.value === 'standalone' ? 'desktop' : 'follow'); } catch (err) {}
        });
        modeRow.appendChild(modeSel);

        var soundRow = menuRow();
        soundRow.appendChild(menuLabel('点击音效'));
        var clickToggle = document.createElement('input');
        clickToggle.type = 'checkbox';
        clickToggle.id = 'dshw-click-sound';
        clickToggle.className = 'dshwv-check';
        clickToggle.title = '控制按下和松开鲸鱼时是否发声，不影响任务完成提示音';
        clickToggle.addEventListener('change', function () { setSoundOn(clickToggle.checked); });
        soundRow.appendChild(clickToggle);

        var remindRow = menuRow();
        remindRow.appendChild(menuLabel('完成提醒'));
        var remindSel = document.createElement('select');
        remindSel.id = 'dshw-complete-reminder';
        remindSel.className = 'dshwv-sound';
        [['off', '关闭'], ['bubble', '仅气泡'], ['both', '气泡和声音']].forEach(function (entry) {
          var option = document.createElement('option');
          option.value = entry[0];
          option.textContent = entry[1];
          remindSel.appendChild(option);
        });
        remindSel.addEventListener('change', function () {
          var want = remindSel.value;
          if (want === 'custom') return;
          setTurnCostOn(want !== 'off');
          usagePanelApi.save({ taskEnd: { on: want === 'both' } });
        });
        remindRow.appendChild(remindSel);

        var advancedRow = menuRow();
        advancedRow.appendChild(menuLabel('高级设置…'));
        var advancedBtn = document.createElement('button');
        advancedBtn.type = 'button';
        advancedBtn.className = 'dshwv-roleimport';
        advancedBtn.style.flex = '1';
        advancedBtn.textContent = '打开';
        advancedBtn.title = '打开完整设置窗口';
        advancedBtn.addEventListener('click', function (e) {
          e.stopPropagation();
          try { window.whaleDesktop.openSettings(); } catch (err) { window.dispatchEvent(new Event('whale-open-settings')); }
        });
        advancedRow.appendChild(advancedBtn);

        var bottomRow = menuRow();
        bottomRow.appendChild(menuLabel('位置'));
        var moveBtn = document.createElement('button');
        moveBtn.type = 'button';
        moveBtn.className = 'dshwv-roleimport';
        moveBtn.style.flex = '1';
        moveBtn.textContent = '移回右下角';
        moveBtn.title = '把鲸鱼移回桌面右下角';
        moveBtn.addEventListener('click', function (e) {
          e.stopPropagation();
          window.dispatchEvent(new Event('whale-reset-position'));
        });
        bottomRow.appendChild(moveBtn);

        // 方案顺序：查看数据 · 角色 · 大小 · 桌面显示 · 点击音效 · 完成提醒 · 气泡
        var sizeRow = rowByLabel('大小');
        var roleRow = rowByLabel('角色');
        var anchor = sizeRow || roleRow;
        if (anchor && anchor.parentNode === root) {
          root.insertBefore(modeRow, anchor.nextSibling);
          root.insertBefore(soundRow, modeRow.nextSibling);
          root.insertBefore(remindRow, soundRow.nextSibling);
        }
        root.appendChild(advancedRow);
        root.appendChild(bottomRow);
        syncLevel1Controls();
      }
      // 其余脚本（音效入口、独立桌面、素材包、数据显示）会在各自的
      // DOMContentLoaded 里往菜单追加行，所以推迟一拍再收敛一次。
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function () {
          setTimeout(run, 0);
          // account-view 读完 display-mode 后会再刷一次菜单，第二次收敛盖住它。
          setTimeout(run, 400);
        }, { once: true });
      } else { setTimeout(run, 0); setTimeout(run, 400); }
    })();
    var usagePanel = document.createElement('div');
    usagePanel.className = 'dshwv-usage-sub';
    usagePanel.style.display = 'none';
    var usageArea = document.createElement('div');
    usageArea.className = 'dshwv-usage-area';
    usageArea.style.cssText = 'flex:1 1 auto;min-height:0;overflow:hidden;position:relative';
    menuBox.appendChild(usageArea);
    usageArea.appendChild(usagePanel);
    var usageNavRow = menuRow();
    usageNavRow.dataset.accountApi = 'true';
    usageNavRow.style.flex = '0 0 auto';
    usageRecBtn.style.width = '100%';
    usageNavRow.appendChild(usageRecBtn);
    menuBox.appendChild(usageNavRow);
    var usageMainEl = null;
    var usageNavigation = createUsageNavigation({
      window: window, menuBox: menuBox, menuRootView: menuRootView,
      usageArea: usageArea, usagePanel: usagePanel, usageRecBtn: usageRecBtn,
      renderUsagePanel: renderUsagePanel
    });
    var toggleUsagePanel = usageNavigation.toggle;
    var closeUsagePanel = usageNavigation.close;
    window.WhaleLegacyUsage = {
      start: usageNavigation.startLegacy,
      stop: usageNavigation.stopLegacy,
      records: function () { openUsageRecordsWindow(); },
      showWait: function (detail) { return showWaitBubble(detail || {}); },
      hideWait: function (id) { hideWaitBubble(false, id); }
    };
    function dismissLedgerWarning() {
      return requestJson('/api/usage-warning', { method: 'POST' }).catch(function () { return null; });
    }
    var usageOverviewView = createUsageOverviewView({
      document: document, WhaleMoney: WhaleMoney,
      getCurrency: function () { return state.currency || 'USD'; },
      getMain: function () { return usageMainEl; }, getPanel: function () { return usagePanel; },
      openRecords: openUsageRecordsWindow, dismissLedgerWarning: dismissLedgerWarning
    });
    var whaleCurrencySymbol = usageOverviewView.currencySymbol;
    var usageMoney = usageOverviewView.money;
    var usageMoneyText = usageOverviewView.moneyText;
    var bindUsageMoney = usageOverviewView.bindMoney;
    var uSectionTitle = usageOverviewView.sectionTitle;
    var fillUsagePanel = usageOverviewView.fill;
    function renderUsagePanel() {
      if (usageMainEl && usageNavigation.isOpen() && usagePanelApi.getUsageSet() !== null) {
        renderUsageModels(false);
        refreshUsageMain();
        return;
      }
      buildUsageSubShell();
      refreshUsageMain();
    }
    function buildUsageSubShell() {
      usagePanel.innerHTML = '';
      var subTitle = document.createElement('div');
      subTitle.className = 'dshwv-usage-subtitle';
      subTitle.textContent = '- = 小龙娘记账 = -';
      usagePanel.appendChild(subTitle);
      buildUsageModelArea();
      usageMainEl = document.createElement('div');
      usageMainEl.className = 'dshwv-usagebody';
      usagePanel.appendChild(usageMainEl);
    }
    var usageModelsView = createUsageModelsView({
      document: document, window: window, WhaleMoney: WhaleMoney,
      getPanel: function () { return usagePanel; }
    });
    var renderUsageModels = usageModelsView.render;
    var buildUsageModelArea = usageModelsView.build;
    var usageAlertBudgetEditor = null;
    window.addEventListener('whale-api-model-changed', function () {
      if (usageNavigation.isOpen() && usageModelsView.hasList()) renderUsageModels(true);
    });
    window.addEventListener('whale-open-balance-reconcile', function () {
      usageReconcileEditor();
    });
    // ==== [资源管理器（角色 / 气泡图 / 音频）] ====
    var resourceManager = createResourceManager({
      document: document, client: assetClient, confirm: showConfirm,
      requireSaved: requireSaved, onError: assetFailure,
      onRoleDelete: function (id, data) {
        roleManager.handleDeleted(id, data.roles);
      },
      onBubbleImageDelete: function (id, data) { bubbleImgList = data.images; },
      onAudioGroupDelete: function (id, data) {
        audioGroups = data.groups;
        renderAudioGroupPanel();
        refreshTaskEndAfterAudio();
        if (soundSet === id) setSoundSet('duck');
      },
      onAudioFragmentDelete: function (id, data) {
        audioFragments = data.fragments;
        if (Array.isArray(data.groups)) audioGroups = data.groups;
        renderAudioGroupPanel();
        refreshTaskEndAfterAudio();
      }
    });
    function openResManager() { resourceManager.open().catch(assetFailure); }
    // Bubble and usage views call the same alert controller, including its day-level dedupe.
    var usageAlerts = createUsageAlerts({
      document: document, window: window, WhaleMoney: WhaleMoney,
      whaleMoneyTemplates: whaleMoneyTemplates, fmt: fmt,
      bubbleTokenValue: function (value) { return bubbleTokenValue(value); },
      whaleCurrencySymbol: whaleCurrencySymbol, getUsageSet: function () { return usagePanelApi.getUsageSet(); },
      getLastTurnNotice: function () { return lastTurnNotice; },
      getCurrency: function () { return state.currency || 'USD'; },
      getBubbleNoticeQueue: function () { return bubbleNoticeQueue; },
      getAlertTtl: function () { return USAGE_ALERT_TTL; }
    });
    var usageTodayKeyStr = usageAlerts.usageTodayKeyStr;
    var usageRemindDefaultLines = usageAlerts.usageRemindDefaultLines;
    var usageTurnCostDefaultLines = usageAlerts.usageTurnCostDefaultLines;
    var usageWaitDefaultLines = usageAlerts.usageWaitDefaultLines;
    var usageWaitLinesOf = usageAlerts.usageWaitLinesOf;
    var usageTurnCostLines = usageAlerts.usageTurnCostLines;
    var usageRemindLinesOf = usageAlerts.usageRemindLinesOf;
    var usageFillText = usageAlerts.usageFillText;
    var usageAlertModsResolved = usageAlerts.usageAlertModsResolved;
    var checkUsageAlerts = usageAlerts.checkUsageAlerts;
    var showUsagePopup = usageAlerts.showUsagePopup;
    var usageAggModels = aggregateUsageModels;
    var usageCharts = createUsageCharts({ document: document, window: window,
      sectionTitle: uSectionTitle, bindMoney: bindUsageMoney, formatMoney: usageMoney,
      getCurrency: function () { return state.currency || 'USD'; }, money: WhaleMoney });
    var usageRatioRows = usageCharts.ratioRows;
    var usageDrawBarChart = usageCharts.drawBarChart;
    var usageRecordsView = createUsageRecordsView({
      document: document, card: usagePanelApi.card, close: closeUsageRecordsWindow,
      bindUsageMoney: bindUsageMoney, usageMoney: usageMoney, usageMoneyText: usageMoneyText,
      usageAggModels: usageAggModels, usageRatioRows: usageRatioRows,
      usageDrawBarChart: usageDrawBarChart, usageTodayKeyStr: usageTodayKeyStr,
      WhaleMoney: WhaleMoney, dismissLedgerWarning: dismissLedgerWarning,
      getCurrency: function () { return state.currency || 'USD'; }
    });
    document.body.appendChild(rolePanel);
    var snapEditor = createSnapEditor({
      document: document, viewport: viewport, cloneSnap: cloneSnap,
      clampSnapKey: clampSnapKey, fixSnapConfig: fixSnapConfig,
      getSnapConfig: function () { return snapConfig; },
      setSnapConfig: function (next) { snapConfig = next; },
      saveSnapConfig: saveSnapConfig, closeRolePanel: closeRolePanel,
      closeAudioGroupPanel: closeAudioGroupPanel,
      setFlip: function (value) { state.flip = value; },
      express: express, snapCheck: snapCheck
    });
    var openSnapModal = snapEditor.open;
    var bubbleMask = null;
    var bubbleEditorState = {
      items: [], lib: [], tapAdvance: false, editorSnap: null, itemSnap: null,
      itemIdx: -1, itemSide: -1, palEl: null, pvEl: null, pvPrevEl: null,
    };
    // Reminder and item editors share the bubble editor's live state and its
    // late-bound overlay/render elements. The accessors keep those bindings
    // writable in the entry while the dialogs are open.
    var bubbleEditorCtx = {
      get renderPv() { return renderBubblePv; }, set renderPv(value) { renderBubblePv = value; },
      get qeditEnsure() { return qeditEnsure; }, set qeditEnsure(value) { qeditEnsure = value; },
      get dragKey() { return bubbleDragKey; }, set dragKey(value) { bubbleDragKey = value; },
      get modDrag() { return bubbleModDrag; }, set modDrag(value) { bubbleModDrag = value; },
      get moduleMask() { return moduleMask; },
      get qeditEl() { return qeditEl; },
      get turnCostOn() { return turnCostOn; },
      get turnCostCloseMs() { return turnCostCloseMs; },
      get renderPal() { return renderBubblePal; },
      get itemMask() { return bubbleItemMask; },
      get itemTitleEl() { return bubbleItemTitleEl; },
      get itemSideEl() { return bubbleItemSideEl; }
    };
    usageAlertBudgetEditor = createReminderEditor({
      document: document, window: window, WhaleMoney: WhaleMoney, WhaleTurnNotice: WhaleTurnNotice,
      state: { get currency() { return state.currency; } }, usagePanelApi: usagePanelApi, bubbleEditorState: bubbleEditorState,
      ctx: bubbleEditorCtx,
      qLabel: qLabel, bubblePaletteModule: bubblePaletteModule, bubbleModuleAdd: bubbleModuleAdd,
      bubblePickImageToAdd: bubblePickImageToAdd, bubblePvDropBlockEnd: bubblePvDropBlockEnd,
      bubbleRowsCanon: bubbleRowsCanon, bubblePreviewInto: function (element, modules) { return bubblePreviewInto(element, modules); }, bubbleEditTarget: bubbleEditTarget,
      usageTurnCostLines: usageTurnCostLines, usageWaitLinesOf: usageWaitLinesOf, usageRemindLinesOf: usageRemindLinesOf,
      usageTurnCostDefaultLines: usageTurnCostDefaultLines, usageWaitDefaultLines: usageWaitDefaultLines,
      usageRemindDefaultLines: usageRemindDefaultLines, usageAlertModsResolved: usageAlertModsResolved
    });
    var bubbleMoreListEl = null;
    var bubbleFirstChipEl = null;
    var bubbleAdvanceControl = null;
    function bubbleDefaultQueue(subscriptionMode) {
      if (typeof subscriptionMode !== 'boolean') subscriptionMode = window.WhaleAccountView?.mode === 'subscription';
      return buildBubbleDefaultQueue(subscriptionMode);
    }
    var itemEditor = createItemEditor({
      document: document, state: bubbleEditorState, target: bubbleEditTarget, stepLabel: bubbleEditStepLabel,
      isChoice: bubbleIsChoice, choiceOptions: bubbleChoiceOptions, choiceWeight: bubbleChoiceWeight,
      ensureModules: bubbleEditEnsureModules, rowsCanon: bubbleRowsCanon, zClean: whaleZClean,
      ctx: bubbleEditorCtx
    });
    var openBubbleItem = itemEditor.openBubbleItem;
    var closeBubbleItem = itemEditor.closeBubbleItem;
    // ==== [气泡编辑器] ====
    var bubbleEditorView = createBubbleEditorView({
      document: document,
      getItems: function () { return bubbleEditorState.items; },
      getFirstChip: function () { return bubbleFirstChipEl; },
      getMoreList: function () { return bubbleMoreListEl; },
      openItem: openBubbleItem, confirm: showConfirm
    });
    var bubbleEditorApi = createBubbleEditorController({
      state: bubbleEditorState, view: bubbleEditorView,
      getMask: function () { return bubbleMask; }, getAdvance: function () { return bubbleAdvanceControl; },
      getMode: function () { return window.WhaleAccountView?.mode; },
      getConfig: function () { return bubbleCfg; }, isConfigLoaded: function () { return bubbleCfgLoaded; },
      loadConfig: loadBubbleCfg, saveConfig: saveBubbleCfg,
      draftOf: loadBubbleEditorDraft, draftSave: saveBubbleEditorDraft,
      defaultQueue: bubbleDefaultQueue, showConfirm: showConfirm, assetFailure: assetFailure,
      closeRolePanel: closeRolePanel, closeAudioGroupPanel: closeAudioGroupPanel
    });
    var renderBubbleFirst = bubbleEditorApi.renderFirst;
    var renderBubbleMore = bubbleEditorApi.renderMore;
    var bubbleDropToEnd = bubbleEditorApi.dropToEnd;
    var bubbleAddMore = bubbleEditorApi.addMore;
    var bubbleEditorDirty = bubbleEditorApi.dirty;
    var bubbleApplyPreset = bubbleEditorApi.applyPreset;
    var openBubbleEditor = bubbleEditorApi.open;
    var closeBubbleEditor = bubbleEditorApi.close;
    var bubbleEditorReset = bubbleEditorApi.reset;
    var bubbleEditorSave = bubbleEditorApi.save;
    var bubbleItemMask = null;
    var bubbleItemTitleEl = null;
    var bubbleItemSideEl = null;
    function bubbleEditTarget() {
      var step = bubbleEditorState.items[bubbleEditorState.itemIdx];
      if (!step) return null;
      if (bubbleIsChoice(step)) {
        var o = bubbleChoiceOptions(step)[bubbleEditorState.itemSide === 0 || bubbleEditorState.itemSide === 1 ? bubbleEditorState.itemSide : 0];
        return o ? o.item : null;
      }
      return step;
    }
    function bubbleEditStepLabel(step, idx) {
      var base = '第' + (idx + 1) + '次点击';
      if (bubbleIsChoice(step)) return base + ' · ' + (bubbleEditorState.itemSide === 1 ? 'B泡' : 'A泡');
      return base;
    }
    var qeditEl = null;
    function qeditEnsure() {
      if (qeditEl) return qeditEl;
      qeditEl = document.createElement('div');
      qeditEl.className = 'dshwv-qedit';
      qeditEl.style.display = 'none';
      document.body.appendChild(qeditEl);
      if (!window.__dshwQeditBound) {
        window.__dshwQeditBound = true;
        document.addEventListener('pointerdown', function (e) {
          if (!qeditEl || qeditEl.style.display === 'none') return;
          if (e.target && e.target.closest && (e.target.closest('.dshwv-qedit') || e.target.closest('.dshwv-rgbmenu') || e.target.closest('.dshwv-custmenu') || e.target.closest('.dshwv-rgbhead') || e.target.closest('.dshwv-custbtn') || e.target.closest('.dshwv-fontwrap') || e.target.closest('.dshwv-usagepanel') || e.target.closest('.dshwv-usage-mask') || e.target.closest('.dshwv-resmask'))) return;
          qeditClose();
        }, true);
        document.addEventListener('keydown', function (e) {
          if (e.key === 'Escape') qeditClose();
        });
      }
      return qeditEl;
    }
    function qeditClose() {
      if (qeditEl) qeditEl.style.display = 'none';
    }
    function qRow() {
      var d = document.createElement('div');
      d.className = 'dshwv-qedit-row';
      return d;
    }
    function qLabel(t) {
      var s = document.createElement('label');
      s.textContent = t;
      return s;
    }
    function qeditPlace(anchorRect, widthPx, preferAbove) {
      try {
        var vp = viewport();
        var box = qeditEl;
        var w = Math.max(180, Math.min(widthPx || 320, vp.w - 16));
        box.style.width = w + 'px';
        box.style.display = 'block';
        var h = box.offsetHeight || 200;
        var left = anchorRect.left + anchorRect.width / 2 - w / 2;
        left = Math.max(8, Math.min(left, vp.w - w - 8));
        var top = preferAbove ? anchorRect.top - h - 8 : anchorRect.bottom + 6;
        if (preferAbove && top < 8) top = Math.min(8, anchorRect.bottom + 6);
        if (top + h > vp.h - 8) top = Math.max(8, vp.h - h - 8);
        if (top < 8) top = 8;
        box.style.left = Math.round(left) + 'px';
        box.style.top = Math.round(top) + 'px';
      } catch (err) {}
    }

    // ==== [快速编辑器与调色板] ====
    var bubbleColorSelect = createBubbleColorSelect({
      document: document, qRow: qRow, qLabel: qLabel, dshwDropOpen: dshwDropOpen
    });
    var qColorSelectBuild = bubbleColorSelect.build;
    var bubbleQuickEditors = createBubbleQuickEditors({
      document: document, window: window, qeditClose: qeditClose,
      qRow: qRow, qLabel: qLabel, bubbleFontEditRow: bubbleFontEditRow,
      qColorSelectBuild: qColorSelectBuild, qeditPlace: qeditPlace,
      // Resolved at call time, not here. usageAlertBudgetEditor swaps both
      // bindings while it is open — qeditEnsure to lift the quick-edit box above
      // that editor's mask, renderBubblePv to apply the alert-resolved modules —
      // and a value captured now would miss the swap.
      qeditEnsure: function () { return qeditEnsure(); },
      renderBubblePv: function () { return renderBubblePv(); },
      getPreviewElement: function () { return bubbleEditorState.pvPrevEl; },
      bubbleTplHelpToggle: function (m, anchor) { return bubbleTplHelpToggle(m, anchor); }
    });
    var openQuickTextEditor = bubbleQuickEditors.openText;
    var openQuickModuleEditor = bubbleQuickEditors.openModule;
    var openQuickSentenceEditor = bubbleQuickEditors.openSentence;
    var bubblePalette = createBubblePalette({
      document: document, getPaletteElement: function () { return bubbleEditorState.palEl; },
      getLibrary: function () { return bubbleEditorState.lib; },
      setDragKey: function (key) { bubbleDragKey = key; },
      getMode: function () { return window.WhaleAccountView && window.WhaleAccountView.mode; },
      bubbleModuleAdd: bubbleModuleAdd, bubbleModuleNew: bubbleModuleNew,
      bubblePickImageToAdd: bubblePickImageToAdd, bubblePaletteModule: bubblePaletteModule,
      bubbleCloneModule: bubbleCloneModule, bubbleDefaultSecondModules: bubbleDefaultSecondModules,
      showConfirm: showConfirm, bubbleLiblibDel: bubbleLiblibDel
    });
    var renderBubblePal = bubblePalette.render;
    function bubbleLiblibById(id) {
      for (var i = 0; i < bubbleEditorState.lib.length; i++) if (bubbleEditorState.lib[i].id === id) return bubbleEditorState.lib[i];
      return null;
    }
    var bubbleDragKey = null;
    function bubbleItemHasImage() {
      try {
        var it = bubbleEditTarget();
        if (!it || !it.modules) return false;
        for (var i = 0; i < it.modules.length; i++) if (bubbleIsImgMod(it.modules[i])) return true;
      } catch (err) {}
      return false;
    }
    function bubbleWarnOneImage() {
      showConfirm('一个泡泡只能有一个图片/动图。当前泡泡已含图片,请先修改或删除现有图片模块后再添加。', function () {}, '知道了');
    }
    function bubbleModuleAdd(m) {
      try {
        var it = bubbleEditTarget();
        if (!it) return;
        if (!it.modules) it.modules = [];
        if (bubbleIsImgMod(m) && bubbleItemHasImage()) {
          bubbleWarnOneImage();
          return;
        }
        if (bubbleRowsOf(it.modules).length >= BUBBLE_PV_ROW_MAX) {
          bubblePvWarn('泡泡最多 ' + BUBBLE_PV_ROW_MAX + ' 行,无法再加新行');
          return;
        }
        it.modules.push(m);
        renderBubblePv();
      } catch (err) {}
    }
    function bubbleModuleNew(m) {
      openModuleEditor(m, function (saved) {
        if (saved) bubbleModuleAdd(saved);
      });
    }
    function bubblePickImageToAdd() {
      if (bubbleItemHasImage()) {
        bubbleWarnOneImage();
        return;
      }
      bubbleModuleNew({
        type: 'image',
        imgId: '',
        size: 6
      });
    }
    var BUBBLE_PV_ROW_MAX = 6;
    var BUBBLE_PV_MOD_MAX = 6;
    var bubbleModDrag = null;
    var bubblePvZone = '';
    function bubblePvWarn(msg) {
      showConfirm(msg, function () {}, '知道了');
    }
    function bubblePvRowModel() {
      var it = bubbleEditTarget();
      if (!it || !Array.isArray(it.modules)) return [];
      return bubbleRowsOf(it.modules);
    }
    function bubblePvRowCommit(rows) {
      var it = bubbleEditTarget();
      if (!it) return;
      it.modules = bubbleRowsFlat(rows);
      renderBubblePv();
    }
    function bubbleModuleEdit(m) {
      try {
        if (m && (m.type === 'text' || m.type === 'link')) {
          openQuickTextEditor(m);
          return;
        }
        if (m && (m.type === 'balance' || m.type === 'today' || m.type === 'quota' || m.type === 'turn' || m.type === 'session' || m.type === 'plan' || m.type === 'peak' || m.type === 'nextpeak' || m.type === 'source')) {
          openQuickModuleEditor(m);
          return;
        }
        openModuleEditor(m, function (saved) {
          if (saved) renderBubblePv();
        });
      } catch (err) {}
    }
    function bubblePvDelBlock(ri, mi) {
      var rows = bubblePvRowModel();
      if (!rows[ri] || mi >= rows[ri].length) return;
      rows[ri].splice(mi, 1);
      if (!rows[ri].length) rows.splice(ri, 1);
      bubblePvRowCommit(rows);
    }
    function bubblePvMoveRow(fromRow, toRow, zone) {
      var rows = bubblePvRowModel();
      if (fromRow < 0 || fromRow >= rows.length || toRow < 0 || toRow >= rows.length || fromRow === toRow) return;
      var target = rows[toRow];
      var moved = rows.splice(fromRow, 1)[0];
      var t = rows.indexOf(target);
      if (t < 0) {
        rows.push(moved);
        bubblePvRowCommit(rows);
        return;
      }
      rows.splice(zone === 'after' ? t + 1 : t, 0, moved);
      bubblePvRowCommit(rows);
    }
    function bubblePvDropBlock(riFrom, miFrom, riTarget, zone) {
      try {
        var rows = bubblePvRowModel();
        if (!rows[riFrom] || miFrom >= rows[riFrom].length || !rows[riTarget]) return;
        var m = rows[riFrom][miFrom];
        if (!m || typeof m !== 'object') return;
        var tRow = rows[riTarget];
        var imageInvolved = bubbleIsImgMod(m) || bubbleIsImgMod(tRow[0]);
        if (imageInvolved && (zone === 'pairL' || zone === 'pairR')) zone = 'before';
        rows[riFrom].splice(miFrom, 1);
        if (!rows[riFrom].length) rows.splice(riFrom, 1);
        var tIdx = -1;
        for (var i = 0; i < rows.length; i++) if (rows[i] === tRow) {
          tIdx = i;
          break;
        }
        if (tIdx >= 0 && (zone === 'pairL' || zone === 'pairR')) {
          var tgt = rows[tIdx];
          if (!bubbleIsImgMod(m) && !bubbleIsImgMod(tgt[0])) {
            if (tgt.length >= BUBBLE_PV_MOD_MAX) {
              bubblePvWarn('同一行最多 ' + BUBBLE_PV_MOD_MAX + ' 个模块,无法再并入');
              return;
            }
            tgt.splice(zone === 'pairL' ? 0 : tgt.length, 0, m);
            bubblePvRowCommit(rows);
            return;
          }
          zone = 'before';
        }
        if (rows.length >= BUBBLE_PV_ROW_MAX) {
          bubblePvWarn('泡泡最多 ' + BUBBLE_PV_ROW_MAX + ' 行,无法另起新行');
          return;
        }
        var at = tIdx >= 0 ? zone === 'after' ? tIdx + 1 : tIdx : Math.min(riFrom, rows.length);
        rows.splice(at, 0, [m]);
        bubblePvRowCommit(rows);
      } catch (err) {}
    }
    function bubblePvDropBlockEnd(riFrom, miFrom) {
      var rows = bubblePvRowModel();
      if (!rows[riFrom] || miFrom >= rows[riFrom].length) return;
      var m = rows[riFrom][miFrom];
      rows[riFrom].splice(miFrom, 1);
      if (!rows[riFrom].length) rows.splice(riFrom, 1);
      if (rows.length >= BUBBLE_PV_ROW_MAX) {
        bubblePvWarn('泡泡最多 ' + BUBBLE_PV_ROW_MAX + ' 行,无法再另起一行');
        return;
      }
      rows.push([m]);
      bubblePvRowCommit(rows);
    }
    function bubblePvMoveRowEnd(fromRow) {
      var rows = bubblePvRowModel();
      if (fromRow < 0 || fromRow >= rows.length) return;
      rows.push(rows.splice(fromRow, 1)[0]);
      bubblePvRowCommit(rows);
    }
    function bubblePvAddToRow(ri) {
      var rows = bubblePvRowModel();
      if (!rows[ri]) return;
      if (rows[ri].length >= BUBBLE_PV_MOD_MAX) {
        bubblePvWarn('同一行最多 ' + BUBBLE_PV_MOD_MAX + ' 个模块');
        return;
      }
      rows[ri].push({
        type: 'text',
        text: '新内容',
        size: 6,
        bold: true
      });
      bubblePvRowCommit(rows);
    }
    function bubblePvPaletteToRow(key, ri) {
      try {
        var rows = bubblePvRowModel();
        if (!rows[ri]) return;
        var tgt = rows[ri];
        if (bubbleIsImgMod(tgt[0])) {
          bubblePvWarn('该行是图片(独占一行):请拖到下方空白区另起一行');
          return;
        }
        if (key === 'image' || key === 'randimg') {
          bubblePvWarn('图片模块必须独占一整行:请拖到下方空白区新增');
          return;
        }
        if (key === 'wizard') key = 'text';
        var m = bubblePaletteModule(key);
        if (!m) return;
        if (tgt.length >= BUBBLE_PV_MOD_MAX) {
          bubblePvWarn('同一行最多 ' + BUBBLE_PV_MOD_MAX + ' 个模块,无法再加入');
          return;
        }
        tgt.push(m);
        bubblePvRowCommit(rows);
      } catch (err) {}
    }
    function bubblePaletteModule(key) {
      if (key === 'text') return {
        type: 'text',
        text: '新内容',
        size: 6,
        bold: true
      };
      if (key === 'balance') return {
        type: 'balance',
        size: 11,
        tpl: '{balance_api}'
      };
      if (key === 'today') return {
        type: 'today',
        size: 1,
        tpl: '今日已观测 {expense_api}'
      };
      if (key === 'quota5' || key === 'quotaWeek') return {
        type: 'quota',
        quotaStyle: 'meter',
        windowDurationMins: key === 'quotaWeek' ? 10080 : 300,
        size: 5
      };
      if (key === 'turn') return {
        type: 'turn',
        size: 5,
        tpl: '上轮使用 {turn_tokens} tokens'
      };
      if (key === 'plan') return { type: 'plan', size: 5, bold: true, tpl: '{plan_name}' };
      if (key === 'session') return { type: 'session', size: 4, tpl: '当前会话 · {session_name}' };
      if (key === 'source') return { type: 'source', size: 3, tpl: '{source_line}' };
      if (key === 'peak') return { type: 'peak', size: 5, bold: true, tpl: '{peak_phase} · {peak_countdown}' };
      if (key === 'link') return {
        type: 'link',
        text: '打开链接',
        url: '',
        size: 6,
        color: '#2f4488'
      };
      if (key === 'randimg') return { type: 'randimg', imgs: [], imgScale: 1 };
      if (key === 'random') return bubbleCloneModule(bubbleDefaultSecondModules()[0]);
      if (typeof key === 'string' && key.indexOf('lib:') === 0) {
        var lb = bubbleLiblibById(key.slice(4));
        return lb ? bubbleCloneModule(lb.module) : null;
      }
      return null;
    }

    // ==== [气泡预览与样式] ====
    var bubblePreviewView = createBubblePreviewView({
      document: document, rowsOf: bubbleRowsOf, isImgMod: bubbleIsImgMod,
      moduleLabel: bubbleModuleListLabel, editModule: bubbleModuleEdit,
      deleteBlock: bubblePvDelBlock, addToRow: bubblePvAddToRow,
      moveRow: bubblePvMoveRow, dropBlock: bubblePvDropBlock,
      paletteToRow: bubblePvPaletteToRow, dropShadow: bubbleDropShadow,
      previewInto: function (element, modules, width) { return bubblePreviewInto(element, modules, width); },
      getRowDrag: function () { return bubbleRowDragIdx; }, setRowDrag: function (value) { bubbleRowDragIdx = value; },
      getModDrag: function () { return bubbleModDrag; }, setModDrag: function (value) { bubbleModDrag = value; },
      getZone: function () { return bubblePvZone; }, setZone: function (value) { bubblePvZone = value; },
      getKey: function () { return bubbleDragKey; }, setKey: function (value) { bubbleDragKey = value; }
    });
    function renderBubblePv() { return bubblePreviewView.render(bubbleEditorState, bubbleEditTarget, function () { return root; }); }
    var bubbleRowDragIdx = null;
    function bubbleItemDiscard() {
      try {
        var idx = bubbleEditorState.itemIdx;
        var snap = bubbleEditorState.itemSnap;
        bubbleEditorState.itemSnap = null;
        if (idx >= 0 && idx < bubbleEditorState.items.length && snap) bubbleEditorState.items[idx] = snap;
      } catch (err) {}
      closeBubbleItem();
      renderBubbleFirst();
      renderBubbleMore();
    }
    function bubbleItemSave() {
      showConfirm('保存该泡泡内容?', function () {
        var it = bubbleEditTarget();
        if (it) {
          it.kind = 'custom';
          if (!it.modules) it.modules = [];
        }
        bubbleEditorState.itemSnap = null;
        closeBubbleItem();
        renderBubbleFirst();
        renderBubbleMore();
      });
    }
    function bubbleItemResetToDefault() {
      showConfirm('恢复该泡泡为默认内容?', function () {
        var it = bubbleEditTarget();
        if (it) {
          it.kind = it.kind === 'random' ? 'random' : 'normal';
          it.modules = undefined;
          bubbleEditEnsureModules(it);
        }
        renderBubblePv();
      });
    }
    bubbleMask = document.createElement('div');
    bubbleMask.className = 'dshwv-bubmask';
    bubbleMask.style.display = 'none';
    var bubbleCard = document.createElement('div');
    bubbleCard.className = 'dshwv-bubcard';
    var bubbleTitle = document.createElement('div');
    bubbleTitle.className = 'dshwv-bubtitle';
    bubbleTitle.textContent = '自定义泡泡';
    bubbleCard.appendChild(bubbleTitle);
    var bubblePresetRow = document.createElement('div');
    bubblePresetRow.className = 'dshwv-bubpresets';
    var presetSpecs = (window.WhaleAccountView && window.WhaleAccountView.mode === 'subscription')
      ? [['quota', '额度优先'], ['quota-cards', '潮汐卡片'], ['minimal', '极简'], ['companion', '小龙娘陪伴']]
      : [['balance', '余额优先'], ['minimal', '极简'], ['companion', '小龙娘陪伴']];
    presetSpecs.forEach(function (spec) {
      var pbtn = document.createElement('button');
      pbtn.type = 'button';
      pbtn.className = 'dshwv-bubpreset';
      pbtn.textContent = spec[1];
      pbtn.title = '用预设替换当前泡泡序列（保存前不会写入）';
      pbtn.addEventListener('click', function (e) { e.stopPropagation(); bubbleApplyPreset(spec[0]); });
      bubblePresetRow.appendChild(pbtn);
    });
    bubbleCard.appendChild(bubblePresetRow);
    var bubbleSecFirst = document.createElement('div');
    bubbleSecFirst.className = 'dshwv-bubsec dshwv-bubsec-first';
    bubbleSecFirst.textContent = '首次点击弹出内容';
    bubbleCard.appendChild(bubbleSecFirst);
    var bubbleFirstRow = document.createElement('div');
    bubbleFirstRow.className = 'dshwv-bubrow';
    bubbleFirstChipEl = document.createElement('div');
    bubbleFirstChipEl.className = 'dshwv-bubchip';
    bubbleFirstChipEl.title = '点击编辑该泡泡的内容模块';
    bubbleFirstChipEl.addEventListener('click', function (e) {
      e.stopPropagation();
      openBubbleItem(0);
    });
    bubbleFirstRow.appendChild(bubbleFirstChipEl);
    bubbleCard.appendChild(bubbleFirstRow);
    var bubbleSecMore = document.createElement('div');
    bubbleSecMore.className = 'dshwv-bubsec';
    bubbleSecMore.textContent = '再次点击弹出内容';
    bubbleCard.appendChild(bubbleSecMore);
    bubbleMoreListEl = document.createElement('div');
    bubbleMoreListEl.addEventListener('dragover', function (e) {
      try {
        if (e.target && e.target.closest && e.target.closest('.dshwv-bubrow-drag')) return;
        e.preventDefault();
      } catch (err) {}
    });
    bubbleMoreListEl.addEventListener('drop', function (e) {
      try {
        if (e.target && e.target.closest && e.target.closest('.dshwv-bubrow-drag')) return;
        e.preventDefault();
        bubbleDropToEnd();
      } catch (err) {}
    });
    bubbleCard.appendChild(bubbleMoreListEl);
    var bubbleAddBtn = document.createElement('button');
    bubbleAddBtn.type = 'button';
    bubbleAddBtn.className = 'dshwv-bubadd';
    bubbleAddBtn.textContent = '+ 添加泡泡(点完上一个后显示下一个)';
    bubbleAddBtn.addEventListener('click', bubbleAddMore);
    bubbleCard.appendChild(bubbleAddBtn);
    bubbleAdvanceControl = createBubbleAdvanceControl({
      document: document,
      viewport: viewport,
      onChange: function (value) { bubbleEditorState.tapAdvance = value; }
    });
    bubbleCard.appendChild(bubbleAdvanceControl.element);
    var bubbleBtns = document.createElement('div');
    bubbleBtns.className = 'dshwv-bubbtns';
    function bubbleBtn(label, cls, fn) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'dshwv-bubbtn ' + cls;
      b.textContent = label;
      b.addEventListener('click', function (e) {
        e.stopPropagation();
        fn();
      });
      return b;
    }
    bubbleBtns.appendChild(bubbleBtn('取消', 'dshwv-bubbtn-no', function () {
      if (bubbleEditorDirty()) showConfirm('放弃未保存的更改?', function () {
        closeBubbleEditor();
      }); else closeBubbleEditor();
    }));
    bubbleBtns.appendChild(bubbleBtn('重置', 'dshwv-bubbtn-no', bubbleEditorReset));
    bubbleBtns.appendChild(bubbleBtn('保存', 'dshwv-bubbtn-ok', bubbleEditorSave));
    bubbleCard.appendChild(bubbleBtns);
    bubbleMask.appendChild(bubbleCard);
    document.body.appendChild(bubbleMask);
    bubbleItemMask = document.createElement('div');
    bubbleItemMask.className = 'dshwv-bubmask';
    bubbleItemMask.style.display = 'none';
    var bubbleItemCard = document.createElement('div');
    bubbleItemCard.className = 'dshwv-bubcard';
    bubbleItemTitleEl = document.createElement('div');
    bubbleItemTitleEl.className = 'dshwv-bubtitle';
    bubbleItemCard.appendChild(bubbleItemTitleEl);
    bubbleItemSideEl = document.createElement('div');
    bubbleItemSideEl.className = 'dshwv-sidebar';
    bubbleItemSideEl.style.display = 'none';
    bubbleItemCard.appendChild(bubbleItemSideEl);
    var bubbleSecPal = document.createElement('div');
    bubbleSecPal.className = 'dshwv-bubsec dshwv-bubsec-first';
    bubbleSecPal.textContent = '可选模块(点击或拖入下方泡泡框)';
    bubbleItemCard.appendChild(bubbleSecPal);
    bubbleEditorState.palEl = document.createElement('div');
    bubbleEditorState.palEl.className = 'dshwv-bubpal';
    bubbleItemCard.appendChild(bubbleEditorState.palEl);
    var bubbleSecPv = document.createElement('div');
    bubbleSecPv.className = 'dshwv-bubsec';
    bubbleSecPv.textContent = '泡泡内容预览（示例数据；同一行模块并排显示,≤6 个;拖模块块到行左/右边缘=并入该行、上/下=另起一行;拖 ⠿ 整行排序）';
    bubbleItemCard.appendChild(bubbleSecPv);
    bubbleEditorState.pvEl = document.createElement('div');
    bubbleEditorState.pvEl.className = 'dshwv-bubpvbox';
    bubbleEditorState.pvEl.addEventListener('dragover', function (e) {
      try {
        if (e.target && e.target.closest && e.target.closest('.dshwv-pvrow')) return;
        e.preventDefault();
      } catch (err) {}
    });
    bubbleEditorState.pvEl.addEventListener('drop', function (e) {
      try {
        if (e.target && e.target.closest && e.target.closest('.dshwv-pvrow')) return;
        e.preventDefault();
        if (bubbleRowDragIdx !== null && bubbleRowDragIdx !== undefined) {
          var fr = bubbleRowDragIdx;
          bubbleRowDragIdx = null;
          bubblePvMoveRowEnd(fr);
          return;
        }
        if (bubbleModDrag) {
          var mdd = bubbleModDrag;
          bubbleModDrag = null;
          bubblePvDropBlockEnd(mdd.ri, mdd.mi);
          return;
        }
        var key = bubbleDragKey;
        if (!key) return;
        bubbleDragKey = null;
        if (key === 'image') {
          bubblePickImageToAdd();
          return;
        }
        if (key === 'wizard') {
          bubbleModuleAdd({
            type: 'text',
            text: '新内容',
            size: 6,
            bold: true
          });
          return;
        }
        var m = bubblePaletteModule(key);
        if (m) bubbleModuleAdd(m);
      } catch (err) {}
    });
    bubbleItemCard.appendChild(bubbleEditorState.pvEl);
    bubbleEditorState.pvPrevEl = document.createElement('div');
    bubbleEditorState.pvPrevEl.className = 'dshwv-bubprev';
    bubbleItemCard.appendChild(bubbleEditorState.pvPrevEl);
    var bubbleItemBtns = document.createElement('div');
    bubbleItemBtns.className = 'dshwv-bubbtns';
    bubbleItemBtns.appendChild(bubbleBtn('取消', 'dshwv-bubbtn-no', function () {
      showConfirm('放弃该泡泡的未保存修改?', function () {
        bubbleItemDiscard();
      });
    }));
    bubbleItemBtns.appendChild(bubbleBtn('恢复默认', 'dshwv-bubbtn-no', bubbleItemResetToDefault));
    bubbleItemBtns.appendChild(bubbleBtn('保存', 'dshwv-bubbtn-ok', bubbleItemSave));
    bubbleItemCard.appendChild(bubbleItemBtns);
    bubbleItemMask.appendChild(bubbleItemCard);
    document.body.appendChild(bubbleItemMask);
    var moduleMask = null;
    var moduleEditRef = null;
    var moduleOnSave = null;
    var moduleEditNew = false;
    var moduleTitleEl = null;
    var moduleBodyEl = null;
    var bubbleImgList = [];
    function loadBubbleImgs(cb) {
      try {
        assetClient.bubbleImages().then(function (d) {
          if (d) {
            bubbleImgList = d.images;
            assetWarning(d);
            if (cb) cb();
          }
        }).catch(function () {});
      } catch (err) {}
    }
    async function bubbleUploadImg(file, cb) {
      try {
        WhaleMediaGuard.checkFile(file, 'bubble');
        var bytes = await file.arrayBuffer();
        var media = WhaleMediaGuard.inspectImage(bytes, 'bubble');
        if (['png', 'apng', 'gif'].indexOf(media.format) < 0) throw new Error('泡泡图片请选择 PNG 或 GIF');
        var data = await mediaDataUrl(new Blob([bytes], { type: media.mime }));
        var d = await assetClient.uploadBubbleImage(file.name || '', data);
        if (!d || !d.ok || !Array.isArray(d.images)) throw new Error(d && d.error || '图片保存失败，请重试');
        bubbleImgList = d.images;
        assetWarning(d);
        if (cb) cb(true);
      } catch (err) {
        assetNotice(err.message);
        if (cb) cb(false);
      }
    }
    var bubbleFontOpenMenu = null;
    function visibleTopZ() {
      var top = 20500;
      var cand = [bubbleMask, bubbleItemMask, moduleMask, usagePanelApi.mask, qeditEl, window.__dshwRemindMask];
      function eff(el) {
        try {
          if (!el) return 0;
          if (el.style && el.style.display === 'none') return 0;
          var s = el.style ? el.style.zIndex || '' : '';
          if (!s) {
            var cs = window.getComputedStyle ? window.getComputedStyle(el) : null;
            if (cs) s = cs.zIndex;
          }
          var n = parseFloat(s);
          return isFinite(n) ? n : 0;
        } catch (err) {
          return 0;
        }
      }
      for (var i = 0; i < cand.length; i++) {
        var n = eff(cand[i]);
        if (n > top) top = n;
      }
      return top;
    }
    function whaleZClean() {
      try {
        var zsEl = document.getElementById('dshw-remind-overlay-z');
        if (zsEl) {
          try {
            document.head.removeChild(zsEl);
          } catch (err) {}
        }
        if (!window.__dshwRemindMask) {
          if (moduleMask && moduleMask.style.zIndex) moduleMask.style.zIndex = '';
          if (qeditEl && qeditEl.style.zIndex) qeditEl.style.zIndex = '';
        }
      } catch (err) {}
    }
    function dshwDropOpen(menuEl, anchorEl) {
      try {
        if (menuEl.parentNode !== document.body) document.body.appendChild(menuEl);
        menuEl.style.position = 'fixed';
        menuEl.style.minWidth = '0px';
        menuEl.style.maxHeight = '220px';
        menuEl.style.left = '0px';
        menuEl.style.top = '0px';
        menuEl.classList.add('dshwv-rgbopen');
        var r = anchorEl.getBoundingClientRect();
        var vp = viewport();
        var w = Math.max(20, Math.round(r.width));
        if (menuEl.classList && menuEl.classList.contains('dshwv-qcolmenu')) {
          try {
            var rowHost = anchorEl && anchorEl.parentNode ? anchorEl.parentNode.parentNode : null;
            if (rowHost && rowHost.querySelector) {
              var swEl = rowHost.querySelector('.dshwv-qcolorhost');
              if (swEl && swEl.offsetWidth > 0) w = Math.max(w, Math.round(r.width + swEl.offsetWidth));
            }
          } catch (err) {}
        }
        if (w > vp.w - 16) w = Math.max(20, vp.w - 16);
        menuEl.style.width = w + 'px';
        menuEl.style.maxWidth = 'none';
        var left = r.left;
        if (left + w > vp.w - 8) left = Math.max(8, vp.w - w - 8);
        menuEl.style.left = Math.round(left) + 'px';
        var below = Math.max(0, vp.h - r.bottom - 8);
        var above = Math.max(0, r.top - 8);
        var wantedH = Math.min(220, Math.max(36, Math.ceil(menuEl.scrollHeight || 0)));
        var openBelow = wantedH <= below || below >= above;
        var room = openBelow ? below : above;
        var maxH = Math.max(36, Math.min(220, room - 2));
        menuEl.style.maxHeight = Math.floor(maxH) + 'px';
        var measuredH = Math.min(maxH, Math.max(0, menuEl.getBoundingClientRect().height || wantedH));
        var top = openBelow ? r.bottom + 2 : r.top - measuredH - 2;
        top = Math.max(8, Math.min(top, vp.h - measuredH - 8));
        menuEl.style.top = Math.round(top) + 'px';
        var vTop = visibleTopZ();
        menuEl.style.zIndex = String(Math.max(26010, Math.round(vTop) + 10));
      } catch (err) {}
    }
    var bubbleSysFontList = [];
    var bubbleSysFontTried = false;
    function refreshSystemFonts(onDone) {
      if (bubbleSysFontTried) {
        if (onDone) onDone();
        return;
      }
      bubbleSysFontTried = true;
      if (!window.queryLocalFonts) {
        if (onDone) onDone();
        return;
      }
      try {
        window.queryLocalFonts().then(function (list) {
          try {
            var seen = {};
            var out = [];
            if (list && list.length) {
              for (var i = 0; i < list.length; i++) {
                var fam = String(list[i] && list[i].family || '');
                var lab = String(list[i] && (list[i].fullName || list[i].family) || fam);
                if (!fam) continue;
                if (fam.indexOf('"') >= 0 || fam.indexOf(',') >= 0) continue;
                var key = fam.toLowerCase();
                if (seen[key]) continue;
                seen[key] = true;
                out.push({
                  v: '"' + fam + '"',
                  l: lab
                });
              }
              out.sort(function (a, b) {
                return a.l < b.l ? -1 : a.l > b.l ? 1 : 0;
              });
            }
            bubbleSysFontList = out;
          } catch (err) {}
          if (onDone) onDone();
        }).catch(function () {
          if (onDone) onDone();
        });
      } catch (err) {
        if (onDone) onDone();
      }
    }
    function bubbleFontEditRow(getVal, setVal) {
      var FONT_OPTIONS = [['', '默认字体'], ['"Microsoft YaHei",sans-serif', '微软雅黑'], ['"PingFang SC","Microsoft YaHei",sans-serif', '苹方/雅黑'], ['DengXian,"Microsoft YaHei",sans-serif', '等线'], ['SimSun,serif', '宋体'], ['SimHei,sans-serif', '黑体'], ['KaiTi,serif', '楷体'], ['FangSong,serif', '仿宋'], ['STKaiti,KaiTi,serif', '华文楷体'], ['"Noto Sans SC",sans-serif', 'Noto Sans SC'], ['"Source Han Sans SC",sans-serif', '思源黑体'], ['"Segoe UI",sans-serif', 'Segoe UI'], ['Arial,Helvetica,sans-serif', 'Arial'], ['Helvetica,Arial,sans-serif', 'Helvetica'], ['Verdana,sans-serif', 'Verdana'], ['Tahoma,sans-serif', 'Tahoma'], ['"Trebuchet MS",sans-serif', 'Trebuchet MS'], ['"Times New Roman",serif', 'Times New Roman'], ['Georgia,serif', 'Georgia'], ['"Courier New",monospace', 'Courier New'], ['Consolas,monospace', 'Consolas'], ['Impact,fantasy', 'Impact'], ['"Comic Sans MS",cursive', 'Comic Sans MS']];
      var row = document.createElement('div');
      row.className = 'dshwv-audiorow';
      var fl = document.createElement('span');
      fl.textContent = '字体';
      row.appendChild(fl);
      var box = document.createElement('div');
      box.className = 'dshwv-rgbwrap dshwv-fontwrap';
      var head = document.createElement('button');
      head.type = 'button';
      head.className = 'dshwv-rgbhead';
      head.title = '选择系统字体';
      box.appendChild(head);
      var menu = document.createElement('div');
      menu.className = 'dshwv-rgbmenu dshwv-fontmenu';
      function currentVal() {
        return getVal ? String(getVal() || '') : '';
      }
      function labelOf(v) {
        for (var i = 0; i < FONT_OPTIONS.length; i++) if (FONT_OPTIONS[i][0] === v) return FONT_OPTIONS[i][1];
        if (v) return String(v).slice(0, 14);
        return '默认字体';
      }
      function syncHead() {
        var v = currentVal();
        head.textContent = labelOf(v);
        head.style.fontFamily = v || '';
        head.title = '当前: ' + (v || '默认字体') + ';点击选择系统字体';
      }
      function optionList() {
        var list = [];
        var seen = {};
        for (var i = 0; i < FONT_OPTIONS.length; i++) {
          list.push(FONT_OPTIONS[i]);
          seen[FONT_OPTIONS[i][0]] = true;
        }
        for (var s = 0; s < bubbleSysFontList.length; s++) {
          if (!seen[bubbleSysFontList[s].v]) {
            seen[bubbleSysFontList[s].v] = true;
            list.push([bubbleSysFontList[s].v, bubbleSysFontList[s].l]);
          }
        }
        return list;
      }
      function fill() {
        menu.innerHTML = '';
        var cur = currentVal();
        var all = optionList();
        for (var i = 0; i < all.length; i++) {
          (function (fv, flab) {
            var o = document.createElement('div');
            o.className = 'dshwv-rgbopt' + (fv === cur ? ' dshwv-rgbcur' : '');
            o.textContent = flab;
            o.style.fontFamily = fv || '';
            o.addEventListener('click', function () {
              if (setVal) setVal(fv);
              closeFontMenu();
              syncHead();
              fill();
            });
            menu.appendChild(o);
          })(all[i][0], all[i][1]);
        }
      }
      box.appendChild(menu);
      function closeFontMenu() {
        menu.classList.remove('dshwv-rgbopen');
        bubbleFontOpenMenu = null;
      }
      head.addEventListener('click', function (e) {
        e.stopPropagation();
        if (bubbleFontOpenMenu === menu) {
          closeFontMenu();
          return;
        }
        if (bubbleFontOpenMenu) bubbleFontOpenMenu.classList.remove('dshwv-rgbopen');
        fill();
        bubbleFontOpenMenu = menu;
        dshwDropOpen(menu, head);
        refreshSystemFonts(function () {
          if (bubbleFontOpenMenu === menu && menu.classList.contains('dshwv-rgbopen')) {
            fill();
            dshwDropOpen(menu, head);
          }
        });
      });
      if (!window.__dshwFontDocBound) {
        window.__dshwFontDocBound = true;
        document.addEventListener('pointerdown', function (e) {
          if (!bubbleFontOpenMenu) return;
          try {
            if (e.target && e.target.closest && (e.target.closest('.dshwv-fontwrap') || e.target.closest('.dshwv-rgbmenu'))) return;
          } catch (err) {}
          bubbleFontOpenMenu.classList.remove('dshwv-rgbopen');
          bubbleFontOpenMenu = null;
        }, true);
      }
      row.appendChild(box);
      syncHead();
      fill();
      return row;
    }
    function moduleTypeName(t, m) {
      if (t === 'quota') return m?.windowDurationMins === 10080 ? '每周额度' : '5 小时额度';
      if (t === 'turn') return '上轮 token 用量';
      if (t === 'balance') return '余额数值';
      if (t === 'today') return '今日已观测';
      if (t === 'image') return '图片/动图';
      if (t === 'randimg') return '随机图片';
      if (t === 'random') return '随机语句模块';
      if (t === 'source') return '来源行';
      return '文本模块';
    }

    // ==== [模块编辑器] ====
    var moduleEditorView = createModuleEditorView({
      document: document,
      getLib: function () { return bubbleEditorState.lib; },
      getPalEl: function () { return bubbleEditorState.palEl; },
      getImgList: function () { return bubbleImgList; },
      loadImgs: loadBubbleImgs, uploadImg: bubbleUploadImg,
      fontEditRow: bubbleFontEditRow, colorSelect: qColorSelectBuild,
      openSentence: openQuickSentenceEditor, renderPal: function () { return renderBubblePal(); },
      typeName: moduleTypeName, tplHelp: function (m, anchor) { return bubbleTplHelpToggle(m, anchor); },
      enhanceSelect: dshwCustSel, cloneModule: bubbleCloneModule,
      confirm: showConfirm, libDelete: bubbleLiblibDel
    });
    function renderModuleEditor() { return moduleEditorView.render(moduleEditRef, moduleEditNew, moduleTitleEl, moduleBodyEl); }
    var moduleNamePromptModule = null;
    function openModuleNamePrompt(m) {
      try {
        moduleNamePromptModule = m || moduleEditRef || null;
        moduleNameInput.value = '';
        moduleNamePromptMask.style.display = 'flex';
        setTimeout(function () {
          try {
            moduleNameInput.focus();
          } catch (err) {}
        }, 30);
      } catch (err) {}
    }
    function closeModuleNamePrompt() {
      moduleNamePromptMask.style.display = 'none';
      moduleNamePromptModule = null;
    }
    function saveModuleNamePrompt() {
      var m = moduleNamePromptModule || moduleEditRef;
      if (!m) {
        closeModuleNamePrompt();
        return;
      }
      bubbleLiblibAdd(moduleNameInput.value, m);
      moduleNameInput.value = '';
      closeModuleNamePrompt();
      if (bubbleEditorState.palEl) renderBubblePal();
    }
    function openModuleEditor(m, onSave, isNew) {
      try {
        whaleZClean();
        moduleEditRef = m;
        moduleOnSave = onSave || null;
        moduleEditNew = !!isNew;
        renderModuleEditor();
        moduleMask.style.display = 'flex';
      } catch (err) {}
    }
    function closeModuleEditor(saved) {
      try {
        if (saved && moduleEditRef) {
          if (moduleEditorView.colorEl) moduleEditRef.color = moduleEditorView.colorEl.value === '#203170' && !moduleEditRef.color ? '' : moduleEditorView.colorEl.value;
          if (moduleEditorView.sizeEl) moduleEditRef.size = Math.max(1, Math.min(50, Math.round(Number(moduleEditorView.sizeEl.value) || 6)));
          if (moduleEditRef.type === 'image' && !moduleEditRef.imgId) {
            showConfirm('请先选择或上传一张图片', function () {});
            return;
          }
          if (moduleEditRef.type === 'randimg' && !(moduleEditRef.imgs || []).some(function (item) { return item && item.imgId; })) {
            showConfirm('请至少选择一张随机图片', function () {});
            return;
          }
          if (moduleOnSave) moduleOnSave(moduleEditRef);
        }
        moduleMask.style.display = 'none';
        moduleEditRef = null;
        moduleOnSave = null;
        moduleEditNew = false;
      } catch (err) {
        moduleMask.style.display = 'none';
      }
    }
    moduleMask = document.createElement('div');
    moduleMask.className = 'dshwv-bubmask';
    moduleMask.style.display = 'none';
    var moduleCard = document.createElement('div');
    moduleCard.className = 'dshwv-bubcard';
    moduleTitleEl = document.createElement('div');
    moduleTitleEl.className = 'dshwv-bubtitle';
    moduleCard.appendChild(moduleTitleEl);
    moduleBodyEl = document.createElement('div');
    moduleCard.appendChild(moduleBodyEl);
    var moduleBtns = document.createElement('div');
    moduleBtns.className = 'dshwv-bubbtns';
    moduleBtns.appendChild(bubbleBtn('取消', 'dshwv-bubbtn-no', function () {
      closeModuleEditor(false);
    }));
    var saveAsBtn = document.createElement('button');
    saveAsBtn.type = 'button';
    saveAsBtn.className = 'dshwv-bubbtn dshwv-bubbtn-no';
    saveAsBtn.textContent = '另存';
    saveAsBtn.title = '另存为可选模块:把当前模块存入模块库,可在任意泡泡里复用';
    saveAsBtn.addEventListener('click', function (e) {
      e.stopPropagation();
      openModuleNamePrompt(moduleEditRef);
    });
    moduleBtns.appendChild(saveAsBtn);
    moduleBtns.appendChild(bubbleBtn('保存', 'dshwv-bubbtn-ok', function () {
      closeModuleEditor(true);
    }));
    moduleCard.appendChild(moduleBtns);
    moduleMask.appendChild(moduleCard);
    document.body.appendChild(moduleMask);
    var moduleNamePromptMask = document.createElement('div');
    moduleNamePromptMask.className = 'dshwv-confirmmask';
    moduleNamePromptMask.style.display = 'none';
    var moduleNamePromptCard = document.createElement('div');
    moduleNamePromptCard.className = 'dshwv-audiowin';
    var moduleNamePromptTitle = document.createElement('div');
    moduleNamePromptTitle.className = 'dshwv-audiotitle';
    moduleNamePromptTitle.textContent = '存为可选模块';
    moduleNamePromptCard.appendChild(moduleNamePromptTitle);
    var moduleNameInput = document.createElement('input');
    moduleNameInput.type = 'text';
    moduleNameInput.className = 'dshwv-audionameinput';
    moduleNameInput.maxLength = 20;
    moduleNameInput.placeholder = '模块名称(留空自动编号)';
    moduleNamePromptCard.appendChild(moduleNameInput);
    var moduleNameBtns = document.createElement('div');
    moduleNameBtns.className = 'dshwv-cropbtns';
    var moduleNameCancel = document.createElement('button');
    moduleNameCancel.type = 'button';
    moduleNameCancel.className = 'dshwv-cropbtn dshwv-cropbtn-no';
    moduleNameCancel.textContent = '取消';
    moduleNameCancel.addEventListener('click', closeModuleNamePrompt);
    var moduleNameOk = document.createElement('button');
    moduleNameOk.type = 'button';
    moduleNameOk.className = 'dshwv-cropbtn dshwv-cropbtn-ok';
    moduleNameOk.textContent = '保存';
    moduleNameOk.addEventListener('click', saveModuleNamePrompt);
    moduleNameBtns.appendChild(moduleNameCancel);
    moduleNameBtns.appendChild(moduleNameOk);
    moduleNamePromptCard.appendChild(moduleNameBtns);
    moduleNamePromptMask.appendChild(moduleNamePromptCard);
    document.body.appendChild(moduleNamePromptMask);
    moduleNameInput.addEventListener('keydown', function (e) {
      try {
        if (e.key === 'Enter') saveModuleNamePrompt(); else if (e.key === 'Escape') closeModuleNamePrompt();
      } catch (err) {}
    });
    var roleCrop = createRoleCropEditor({
      document: document, window: window, requestJson: requestJson, roleUrl: ROLE_URL, Image: Image,
      roleManager: roleManager, requireSaved: requireSaved, assetNotice: assetNotice,
      assetFailure: assetFailure, mediaDataUrl: mediaDataUrl, mediaGuard: WhaleMediaGuard,
      openGifRole: function (dataUrl, fileName, format) { openGifRoleModal(dataUrl, fileName, format); }
    });
    function onRoleFileChosen(input) { return roleCrop.openFile(input); }
    var gifRoleDialog = createGifRoleDialog({
      document: document, requestJson: requestJson, roleUrl: ROLE_URL,
      roleManager: roleManager, requireSaved: requireSaved, assetFailure: assetFailure
    });
    var openGifRoleModal = gifRoleDialog.open;
    var audioEditMask = document.createElement('div');
    audioEditMask.className = 'dshwv-audiomask';
    audioEditMask.style.display = 'none';
    var audioEditCard = document.createElement('div');
    audioEditCard.className = 'dshwv-audiowin';
    var audioEditTitle = document.createElement('div');
    audioEditTitle.className = 'dshwv-audiotitle';
    audioEditTitle.textContent = '音效组';
    var audioEditName = document.createElement('input');
    audioEditName.type = 'text';
    audioEditName.className = 'dshwv-audionameinput';
    audioEditName.maxLength = 20;
    audioEditName.placeholder = '预设名称';
    var audioEditPressRow = document.createElement('div');
    audioEditPressRow.className = 'dshwv-audiorow';
    var audioEditPressLabel = document.createElement('span');
    audioEditPressLabel.className = 'dshwv-audioslotlabel';
    audioEditPressLabel.textContent = '按压';
    var audioEditPressWrap = document.createElement('div');
    audioEditPressWrap.className = 'dshwv-slotwrap';
    var audioEditPressBtn = document.createElement('button');
    audioEditPressBtn.type = 'button';
    audioEditPressBtn.className = 'dshwv-slotbtn';
    audioEditPressBtn.textContent = '小黄鸭·按下';
    var audioEditPressPanel = document.createElement('div');
    audioEditPressPanel.className = 'dshwv-slotlist';
    audioEditPressWrap.appendChild(audioEditPressBtn);
    audioEditPressWrap.appendChild(audioEditPressPanel);
    var audioEditPressImport = document.createElement('button');
    audioEditPressImport.type = 'button';
    audioEditPressImport.className = 'dshwv-audiosmallimport';
    audioEditPressImport.textContent = '导入';
    audioEditPressImport.title = '导入并裁剪按压音';
    audioEditPressRow.appendChild(audioEditPressLabel);
    audioEditPressRow.appendChild(audioEditPressWrap);
    audioEditPressRow.appendChild(audioEditPressImport);
    var audioEditReleaseRow = document.createElement('div');
    audioEditReleaseRow.className = 'dshwv-audiorow';
    var audioEditReleaseLabel = document.createElement('span');
    audioEditReleaseLabel.className = 'dshwv-audioslotlabel';
    audioEditReleaseLabel.textContent = '松开';
    var audioEditReleaseWrap = document.createElement('div');
    audioEditReleaseWrap.className = 'dshwv-slotwrap';
    var audioEditReleaseBtn = document.createElement('button');
    audioEditReleaseBtn.type = 'button';
    audioEditReleaseBtn.className = 'dshwv-slotbtn';
    audioEditReleaseBtn.textContent = '小黄鸭·松开';
    var audioEditReleasePanel = document.createElement('div');
    audioEditReleasePanel.className = 'dshwv-slotlist';
    audioEditReleaseWrap.appendChild(audioEditReleaseBtn);
    audioEditReleaseWrap.appendChild(audioEditReleasePanel);
    var audioEditReleaseImport = document.createElement('button');
    audioEditReleaseImport.type = 'button';
    audioEditReleaseImport.className = 'dshwv-audiosmallimport';
    audioEditReleaseImport.textContent = '导入';
    audioEditReleaseImport.title = '导入并裁剪松开音';
    audioEditReleaseRow.appendChild(audioEditReleaseLabel);
    audioEditReleaseRow.appendChild(audioEditReleaseWrap);
    audioEditReleaseRow.appendChild(audioEditReleaseImport);
    var audioEditBtns = document.createElement('div');
    audioEditBtns.className = 'dshwv-cropbtns';
    var audioEditCancel = document.createElement('button');
    audioEditCancel.type = 'button';
    audioEditCancel.className = 'dshwv-cropbtn dshwv-cropbtn-no';
    audioEditCancel.textContent = '取消';
    var audioEditPlay = document.createElement('button');
    audioEditPlay.type = 'button';
    audioEditPlay.className = 'dshwv-cropbtn dshwv-cropbtn-no';
    audioEditPlay.textContent = '试听';
    audioEditPlay.title = '按住播放按压音，松开播放松开音（模拟点击挂件）';
    var audioEditSave = document.createElement('button');
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
    document.body.appendChild(audioEditMask);
    audioEditCancel.addEventListener('click', hideAudioEditor);
    audioEditPlay.addEventListener('pointerdown', function (e) {
      e.stopPropagation();
      audioEditPreviewDown();
    });
    audioEditPlay.addEventListener('pointerup', function (e) {
      e.stopPropagation();
      audioEditPreviewUp();
    });
    audioEditPlay.addEventListener('pointercancel', audioEditPreviewUp);
    audioEditPlay.addEventListener('pointerleave', audioEditPreviewUp);
    audioEditSave.addEventListener('click', saveAudioGroup);
    audioEditMask.addEventListener('click', function (e) {
      if (e.target === audioEditMask || e.target === audioEditCard) closeAudioSlotPanels();
    });
    var audioCropMask = document.createElement('div');
    audioCropMask.className = 'dshwv-audiomask';
    audioCropMask.style.display = 'none';
    var audioCropCard = document.createElement('div');
    audioCropCard.className = 'dshwv-audiowin';
    var audioCropTitle = document.createElement('div');
    audioCropTitle.className = 'dshwv-audiotitle';
    audioCropTitle.textContent = '裁剪音频';
    var audioCropCanvas = document.createElement('canvas');
    audioCropCanvas.width = 300;
    audioCropCanvas.height = 120;
    audioCropCanvas.className = 'dshwv-audiocropcanvas';
    var audioCropStart = document.createElement('input');
    audioCropStart.type = 'range';
    audioCropStart.min = '0';
    audioCropStart.max = '100';
    audioCropStart.step = '0.001';
    audioCropStart.value = '0';
    audioCropStart.className = 'dshwv-cropzoom';
    var audioCropStartNum = document.createElement('input');
    audioCropStartNum.type = 'number';
    audioCropStartNum.min = '0';
    audioCropStartNum.step = '0.001';
    audioCropStartNum.value = '0';
    audioCropStartNum.className = 'dshwv-cropnum';
    audioCropStartNum.title = '起始时间（秒）';
    var audioCropStartRow = document.createElement('div');
    audioCropStartRow.className = 'dshwv-audiosliderrow';
    audioCropStartRow.appendChild(audioCropStart);
    audioCropStartRow.appendChild(audioCropStartNum);
    var audioCropEnd = document.createElement('input');
    audioCropEnd.type = 'range';
    audioCropEnd.min = '0';
    audioCropEnd.max = '100';
    audioCropEnd.step = '0.001';
    audioCropEnd.value = '100';
    audioCropEnd.className = 'dshwv-cropzoom';
    var audioCropEndNum = document.createElement('input');
    audioCropEndNum.type = 'number';
    audioCropEndNum.min = '0';
    audioCropEndNum.step = '0.001';
    audioCropEndNum.value = '0';
    audioCropEndNum.className = 'dshwv-cropnum';
    audioCropEndNum.title = '结束时间（秒）';
    var audioCropEndRow = document.createElement('div');
    audioCropEndRow.className = 'dshwv-audiosliderrow';
    audioCropEndRow.appendChild(audioCropEnd);
    audioCropEndRow.appendChild(audioCropEndNum);
    audioCropStart.style.display = 'none';
    audioCropEnd.style.display = 'none';
    var audioCropDual = document.createElement('div');
    audioCropDual.className = 'dshwv-dualrange';
    var audioCropDualTrack = document.createElement('div');
    audioCropDualTrack.className = 'dshwv-dualrange-track';
    var audioCropDualFill = document.createElement('div');
    audioCropDualFill.className = 'dshwv-dualrange-fill';
    var audioCropDualStart = document.createElement('div');
    audioCropDualStart.className = 'dshwv-dualrange-thumb';
    var audioCropDualEnd = document.createElement('div');
    audioCropDualEnd.className = 'dshwv-dualrange-thumb';
    audioCropDual.appendChild(audioCropDualTrack);
    audioCropDual.appendChild(audioCropDualFill);
    audioCropDual.appendChild(audioCropDualStart);
    audioCropDual.appendChild(audioCropDualEnd);
    var audioCropDualRow = document.createElement('div');
    audioCropDualRow.className = 'dshwv-audiosliderrow';
    audioCropDualRow.appendChild(audioCropStartNum);
    audioCropDualRow.appendChild(audioCropDual);
    audioCropDualRow.appendChild(audioCropEndNum);
    var audioCropZoomLabel = document.createElement('span');
    audioCropZoomLabel.className = 'dshwv-zoomlabel';
    audioCropZoomLabel.textContent = '缩放倍数';
    var audioCropZoomRange = document.createElement('input');
    audioCropZoomRange.type = 'range';
    audioCropZoomRange.min = '1';
    audioCropZoomRange.max = '50';
    audioCropZoomRange.step = '1';
    audioCropZoomRange.value = '1';
    audioCropZoomRange.className = 'dshwv-cropzoom';
    audioCropZoomRange.title = '波形放大倍数';
    var audioCropZoomNum = document.createElement('input');
    audioCropZoomNum.type = 'number';
    audioCropZoomNum.min = '1';
    audioCropZoomNum.max = '50';
    audioCropZoomNum.step = '1';
    audioCropZoomNum.value = '1';
    audioCropZoomNum.className = 'dshwv-cropnum';
    audioCropZoomNum.title = '放大倍数';
    var audioCropZoomRow = document.createElement('div');
    audioCropZoomRow.className = 'dshwv-audiosliderrow';
    audioCropZoomRow.appendChild(audioCropZoomLabel);
    audioCropZoomRow.appendChild(audioCropZoomRange);
    audioCropZoomRow.appendChild(audioCropZoomNum);
    var audioCropTime = document.createElement('div');
    audioCropTime.className = 'dshwv-audiotime';
    audioCropTime.textContent = '0.0s – 0.0s';
    var audioCropNameRow = document.createElement('div');
    audioCropNameRow.className = 'dshwv-audiosliderrow';
    audioCropNameRow.style.justifyContent = 'center';
    audioCropNameRow.style.margin = '2px 0';
    var audioCropName = document.createElement('input');
    audioCropName.type = 'text';
    audioCropName.maxLength = 30;
    audioCropName.placeholder = '音频片段名称';
    audioCropName.title = '裁剪后片段的名称（可改名，留空用源文件名）';
    audioCropName.style.cssText = 'width:min(60%,240px);flex:0 1 auto;margin:0;text-align:center;border:1px solid rgba(32,49,112,.4);border-radius:6px;padding:2px 6px;font-size:12px;color:#203170;background:#fff;box-sizing:border-box';
    audioCropNameRow.appendChild(audioCropName);
    audioCropNameRow.style.marginBottom = '12px';

    // ==== [音频裁剪与气泡测量] ====
    function updateAudioCropOkState() {
      try {
        audioCropOk.disabled = false;
      } catch (err) {}
    }
    audioCropName.addEventListener('input', updateAudioCropOkState);
    var audioCropBtns = document.createElement('div');
    audioCropBtns.className = 'dshwv-cropbtns';
    var audioCropCancel = document.createElement('button');
    audioCropCancel.type = 'button';
    audioCropCancel.className = 'dshwv-cropbtn dshwv-cropbtn-no';
    audioCropCancel.textContent = '取消';
    var audioCropPlay = document.createElement('button');
    audioCropPlay.type = 'button';
    audioCropPlay.className = 'dshwv-cropbtn dshwv-cropbtn-no';
    audioCropPlay.textContent = '试听';
    audioCropPlay.title = '试听裁剪后的片段';
    var audioCropOk = document.createElement('button');
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
    document.body.appendChild(audioCropMask);
    var textBox = document.createElement('div');
    textBox.className = 'dshwv-text';
    var bubbleFrames = new WhaleRendering.BubbleRenderer(textBox, GIF_URL);
    var bubbleTarget, labelEl, amountEl, hintEl, gifEl;
    var bubbleSceneController;
    function bindBubbleParts(parts) {
      bubbleTarget = parts.root; labelEl = parts.label; amountEl = parts.amount;
      hintEl = parts.hint; gifEl = parts.gif;
    }
    bindBubbleParts(bubbleFrames.front);
    // Bubble body geometry. Both shapes share the 1026x700 viewBox and the same
    // outer bounds, so the pop box, the tail beads and the native window region
    // are unaffected by a shape switch. The rounded variant keeps the same tail
    // notch near x=340..445 so .dshwv-b1/.dshwv-b2 stay attached.
    var BUBBLE_SHAPES = {
      ellipse: 'M 827 248 A 373 232 0 1 0 81 246 A 373 232 0 0 0 301 465 A 57 32 10 0 0 413 484 A 373 232 0 0 0 827 248 Z',
      round: 'M 231 15 L 677 15 A 150 150 0 0 1 827 165 L 827 329 A 150 150 0 0 1 677 479 L 445 479 C 428 479 420 496 404 502 C 390 507 376 500 369 489 C 361 478 352 479 338 479 L 231 479 A 150 150 0 0 1 81 329 L 81 165 A 150 150 0 0 1 231 15 Z'
    };
    var bubbleShape = 'ellipse';
    var bubbleBox = document.createElement('div');
    bubbleBox.className = 'dshwv-pop';
    bubbleBox.innerHTML = '<svg viewBox="0 0 1026 700" preserveAspectRatio="xMidYMid meet" xmlns="http://www.w3.org/2000/svg">' + '<path class="dshwv-bshape" fill="#FFFFFF" stroke="#203170" stroke-width="18" stroke-linejoin="round" stroke-linecap="round" d="' + BUBBLE_SHAPES.ellipse + '"/>' + '<ellipse class="dshwv-b1" cx="352" cy="561" rx="37.5" ry="26" fill="#FFFFFF" stroke="#203170" stroke-width="18"/>' + '<ellipse class="dshwv-b2" cx="442" cy="646" rx="24.5" ry="18" fill="#FFFFFF" stroke="#203170" stroke-width="18"/>' + '</svg>';
    bubbleBox.appendChild(textBox);
    bubbleSceneController = createBubbleSceneController({
      frames: bubbleFrames, box: bubbleBox, bindParts: bindBubbleParts,
      beforeRender: function () { WhaleMoney.applyLatestQuote({ refreshBindings: false }); },
      afterCommit: function (committed) {
        if (committed) WhaleMoney.refreshBindings(menuBox);
        else WhaleRendering.presentFor(650);
      },
      onAutoClose: bubbleAutoClose,
      onSceneChange: function (kind) {
        costBubbleActive = kind === 'cost';
      }
    });
    bubbleBox.addEventListener('click', function (e) {
      e.stopPropagation();
      if (!bubbleSceneController.shown) return;
      if (costBubbleActive) {
        hideCostBubble();
        return;
      }
      bubbleNext();
    });
    var body = document.createElement('div');
    body.className = 'dshwv-body';
    body.appendChild(img);
    body.appendChild(bubbleBox);
    root.appendChild(body);
    root.appendChild(menuBtn);
    document.body.appendChild(positioner);
    document.body.appendChild(menuBox);
    function measureBubbleCenter() {
      try {
        var svg = bubbleBox && bubbleBox.querySelector('svg');
        var shape = svg && svg.querySelector('.dshwv-bshape');
        if (!shape || typeof shape.getBBox !== 'function') return;
        var bb = shape.getBBox();
        if (!bb || !isFinite(bb.x + bb.y + bb.width + bb.height) || bb.width <= 0 || bb.height <= 0) return;
        var cx = (bb.x + bb.width / 2) / 1026 * 100;
        var cy = (bb.y + bb.height / 2) / 700 * 100;
        if (!isFinite(cx) || !isFinite(cy)) return;
        try {
          var s = document.documentElement.style;
          s.setProperty('--dshw-vx', cx + '%');
          s.setProperty('--dshw-vy', cy + '%');
        } catch (err) {}
      } catch (err) {}
    }
    measureBubbleCenter();
    try {
      if (typeof requestAnimationFrame === 'function') requestAnimationFrame(measureBubbleCenter);
    } catch (err) {}
    setTimeout(measureBubbleCenter, 120);
    try {
      window.addEventListener('load', function () {
        measureBubbleCenter();
      });
    } catch (err) {}
    function applyBubbleShape(next) {
      if (!BUBBLE_SHAPES) return 'ellipse';
      if (!Object.prototype.hasOwnProperty.call(BUBBLE_SHAPES, next)) next = 'ellipse';
      if (next === bubbleShape) return bubbleShape;
      bubbleShape = next;
      try {
        var shape = bubbleBox && bubbleBox.querySelector('.dshwv-bshape');
        if (shape) shape.setAttribute('d', BUBBLE_SHAPES[bubbleShape]);
        bubbleBox.classList.toggle('dshwv-shape-round', bubbleShape === 'round');
        // The preview and the settings dialog render outside .dshwv-pop, so the
        // shape also has to reach the document for their CSS to switch.
        document.documentElement.classList.toggle('dshw-shape-round', bubbleShape === 'round');
      } catch (err) {}
      // The rounded path has a different bounding box than the ellipse.
      measureBubbleCenter();
      try { window.WhaleRendering && window.WhaleRendering.refitBubble(); } catch (err) {}
      return bubbleShape;
    }
    // dshw-bubble-shape is mirrored to ui-state.json by the /^dshw[-v]/ rule in
    // desktop/ui-state-store.cjs, so no size.json signature change is needed.
    try {
      var savedShape = localStorage.getItem('dshw-bubble-shape');
      if (savedShape) applyBubbleShape(savedShape);
    } catch (err) {}
    // The menu select is built earlier in this closure; sync it to the restored shape.
    try { if (typeof shapeSel !== 'undefined' && shapeSel) shapeSel.value = bubbleShape; } catch (err) {}
    // Menu rows and the settings window call this instead of owning the path map.
    window.WhaleBubbleShape = Object.freeze({ apply: applyBubbleShape, current: function () { return bubbleShape; } });
    var state = {
      scale: 1.5,
      h: 'right',
      hOff: 0,
      v: 'bottom',
      vOff: 0,
      left: 0,
      top: 0,
      balance: null,
      currency: null,
      todayUsage: null,
      status: 'loading',
      message: '',
      code: '',
      updatedAt: null,
      flip: false
    };
    var drag = { active: false };
    var SNAP_KEY = 'dshw-snap';
    var SNAP_VER = 3;
    var SNAP_DEFAULTS = {
      mode: 'ratio',
      ratio: {
        L: 10,
        T: 0,
        R: 10,
        B: 15,
        F: 50
      },
      px: {
        L: 80,
        T: 0,
        R: 80,
        B: 80,
        F: -1
      }
    };
    var snapConfig = null;
    function cloneSnap(c) {
      return {
        mode: c.mode,
        ratio: {
          L: c.ratio.L,
          T: c.ratio.T,
          R: c.ratio.R,
          B: c.ratio.B,
          F: c.ratio.F
        },
        px: {
          L: c.px.L,
          T: c.px.T,
          R: c.px.R,
          B: c.px.B,
          F: c.px.F
        }
      };
    }
    function clampSnapKey(mode, key, val, vp, config) {
      try {
        if (mode === 'px') {
          var w = Math.max(1, vp.w), h = Math.max(1, vp.h);
          var p = (config || snapConfig).px;
          if (key === 'L') return Math.max(0, Math.min(val, p.F >= 0 ? p.F : w / 2));
          if (key === 'R') return Math.max(0, Math.min(val, Math.max(0, w - (p.F >= 0 ? p.F : w / 2))));
          if (key === 'T') return Math.max(0, Math.min(val, Math.max(0, h - p.B)));
          if (key === 'B') return Math.max(0, Math.min(val, Math.max(0, h - p.T)));
          if (key === 'F') return Math.max(p.L, Math.min(val, Math.max(p.L, w - p.R)));
        } else {
          var r = (config || snapConfig).ratio;
          if (key === 'L') return Math.max(0, Math.min(val, r.F));
          if (key === 'R') return Math.max(0, Math.min(val, 100 - r.F));
          if (key === 'T') return Math.max(0, Math.min(val, 100 - r.B));
          if (key === 'B') return Math.max(0, Math.min(val, 100 - r.T));
          if (key === 'F') return Math.max(r.L, Math.min(val, 100 - r.R));
        }
      } catch (err) {}
      return val;
    }
    function fixSnapConfig(cfg, mode) {
      try {
        var m = mode || cfg.mode;
        if (m === 'off') return;
        var vp = viewport();
        if (m === 'px') {
          var w = Math.max(1, vp.w), h = Math.max(1, vp.h);
          if (!(cfg.px.F >= 0)) {
            cfg.px.F = Math.round(w / 2);
            if (!(cfg.px.L > 0)) cfg.px.L = 80;
            if (!(cfg.px.R > 0)) cfg.px.R = 80;
            cfg.px.B = Math.max(0, cfg.px.B > 0 ? cfg.px.B : 80);
            cfg.px.T = Math.max(0, Math.min(cfg.px.T, Math.max(0, h - cfg.px.B)));
          }
          cfg.px.L = Math.max(0, Math.min(cfg.px.L, cfg.px.F));
          cfg.px.R = Math.max(0, Math.min(cfg.px.R, Math.max(0, w - cfg.px.F)));
          cfg.px.F = Math.max(cfg.px.L, Math.min(cfg.px.F, Math.max(cfg.px.L, w - cfg.px.R)));
          cfg.px.L = Math.max(0, Math.min(cfg.px.L, cfg.px.F));
          cfg.px.R = Math.max(0, Math.min(cfg.px.R, Math.max(0, w - cfg.px.F)));
          cfg.px.T = Math.max(0, Math.min(cfg.px.T, Math.max(0, h - cfg.px.B)));
          cfg.px.B = Math.max(0, Math.min(cfg.px.B, Math.max(0, h - cfg.px.T)));
          cfg.px.T = Math.max(0, Math.min(cfg.px.T, Math.max(0, h - cfg.px.B)));
        } else {
          cfg.ratio.L = Math.max(0, Math.min(cfg.ratio.L, cfg.ratio.F));
          cfg.ratio.R = Math.max(0, Math.min(cfg.ratio.R, 100 - cfg.ratio.F));
          cfg.ratio.F = Math.max(cfg.ratio.L, Math.min(cfg.ratio.F, 100 - cfg.ratio.R));
          cfg.ratio.L = Math.max(0, Math.min(cfg.ratio.L, cfg.ratio.F));
          cfg.ratio.R = Math.max(0, Math.min(cfg.ratio.R, 100 - cfg.ratio.F));
          cfg.ratio.T = Math.max(0, Math.min(cfg.ratio.T, 100 - cfg.ratio.B));
          cfg.ratio.B = Math.max(0, Math.min(cfg.ratio.B, 100 - cfg.ratio.T));
          cfg.ratio.T = Math.max(0, Math.min(cfg.ratio.T, 100 - cfg.ratio.B));
        }
      } catch (err) {}
    }
    function loadSnapConfig() {
      snapConfig = cloneSnap(SNAP_DEFAULTS);
      try {
        var raw = localStorage.getItem(SNAP_KEY);
        if (raw) {
          var d = JSON.parse(raw);
          if (d && d.v === SNAP_VER) {
            if (d.mode === 'ratio' || d.mode === 'px' || d.mode === 'off') snapConfig.mode = d.mode;
            var keys = ['L', 'T', 'R', 'B', 'F'];
            var i, k;
            if (d.ratio) for (i = 0; i < keys.length; i++) {
              k = keys[i];
              if (typeof d.ratio[k] === 'number' && isFinite(d.ratio[k])) snapConfig.ratio[k] = d.ratio[k];
            }
            if (d.px) for (i = 0; i < keys.length; i++) {
              k = keys[i];
              if (typeof d.px[k] === 'number' && isFinite(d.px[k])) snapConfig.px[k] = d.px[k];
            }
          }
        }
      } catch (err) {}
      fixSnapConfig(snapConfig, 'ratio');
      fixSnapConfig(snapConfig, 'px');
    }
    function saveSnapConfig() {
      try {
        var out = cloneSnap(snapConfig);
        out.v = SNAP_VER;
        localStorage.setItem(SNAP_KEY, JSON.stringify(out));
      } catch (err) {}
    }
    loadSnapConfig();
    var busy = false;





    var BUBBLE_STYLE_CLASS = {
      A: 'dshwv-label',
      B: 'dshwv-amount',
      P: 'dshwv-period',
      C: 'dshwv-hint'
    };
    function pickOne(arr) {
      return arr[Math.floor(Math.random() * arr.length)];
    }
    function singleCenter(style, text, color, wrap) {
      return [null, {
        t: text,
        s: style,
        c: color || '',
        w: !!wrap
      }, null];
    }
    var RANDOM_GROUPS = [{
      w: 7,
      lines: function () {
        return singleCenter('B', pickOne(['好模型... ↓', '好女孩...↓']));
      }
    }, {
      w: 7,
      lines: function () {
        return singleCenter('A', pickOne(['不知道用户有什么用，先赶走吧~', '我...我...我也要挣钱吗？', '我去吃饭啦，测完叫我', '压力一只蓝色大肥鱼？！', 'DeepSleep...', '坏了...用户彻底怒了！']), '', true);
      }
    }, {
      w: 10,
      lines: function () {
        return {
          gif: true
        };
      }
    }, {
      w: 3,
      lines: function () {
        return singleCenter('A', pickOne(['你目录里的dsh是什么...大烧货吗...?', '恭喜你实现token自由！token全跑了！', '真当我是便宜货啊...']), '', true);
      }
    }, {
      w: 1,
      lines: function () {
        return singleCenter('B', '哦鲸鲸... ');
      }
    }];
    function pickRandomLines() {
      var total = 0;
      for (var i = 0; i < RANDOM_GROUPS.length; i++) total += RANDOM_GROUPS[i].w;
      var r = Math.random() * total;
      for (var i = 0; i < RANDOM_GROUPS.length; i++) {
        r -= RANDOM_GROUPS[i].w;
        if (r < 0) return RANDOM_GROUPS[i].lines();
      }
      return RANDOM_GROUPS[RANDOM_GROUPS.length - 1].lines();
    }
    function applyBubbleLines(lines) {
      if (lines && lines.gif) {
        gifEl.style.display = 'block';
        labelEl.style.display = 'none';
        amountEl.style.display = 'none';
        hintEl.style.display = 'none';
        return;
      }
      gifEl.style.display = 'none';
      var els = [labelEl, amountEl, hintEl];
      for (var i = 0; i < 3; i++) {
        var el = els[i], ln = lines && lines[i];
        el.style.display = ln ? '' : 'none';
        el.className = ln ? (BUBBLE_STYLE_CLASS[ln.s] || 'dshwv-label') + (ln.w ? ' dshwv-wrap' : '') : el.className;
        el.textContent = ln ? ln.t : '';
        el.style.color = ln ? ln.c || '' : '';
      }
    }




    
    
    function restoreBubbleLines() {
      gifEl.style.display = 'none';
      labelEl.style.display = '';
      labelEl.className = 'dshwv-label';
      labelEl.textContent = '当前 API 余额';
      amountEl.style.display = '';
      hintEl.style.display = '';
      render();
    }

    var bubbleSeq = bubbleDefaultQueue();
    var bubbleSeqIdx = 0;
    var bubbleRoundOn = false;
    var bubbleCfg = null;
    var bubbleCfgLoaded = false;
    var bubbleCfgLoad = null;
    var lastTurnNotice = null;
    function bubbleCloneModule(m) {
      var copy = JSON.parse(JSON.stringify(m || ({})));
      if (m && whaleMoneyTemplates.has(m)) whaleMoneyTemplates.set(copy, whaleMoneyTemplates.get(m));
      return copy;
    }
    function bubbleLiblibAdd(name, module) {
      try {
        if (!module) return null;
        var id = 'bmod_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 6);
        var it = {
          id: id,
          name: String(name || '').trim().slice(0, 20) || '模块' + (bubbleEditorState.lib.length + 1),
          module: bubbleCloneModule(module)
        };
        bubbleEditorState.lib.push(it);
        return it;
      } catch (err) {
        return null;
      }
    }
    function bubbleLiblibDel(id) {
      bubbleEditorState.lib = bubbleEditorState.lib.filter(function (x) {
        return x.id !== id;
      });
    }

    // ==== [气泡渲染与行模板] ====
    function applyBubbleCfgSeq() {
      try {
        var configured = window.WhaleAccountView?.mode === 'subscription' ? bubbleCfg && bubbleCfg.subscriptionItems : bubbleCfg && bubbleCfg.items;
        if (window.WhaleAccountView?.mode === 'subscription' && bubbleLegacySubscriptionDefault(configured)) configured = bubbleDefaultSubscriptionQueue();
        if (!Array.isArray(configured) || !configured.length) { bubbleSeq = bubbleDefaultQueue(); return; }
        var seq = [];
        for (var i = 0; i < configured.length; i++) {
          var it = configured[i];
          if (it && it.kind === 'choice' && Array.isArray(it.options)) {
            var opts = [];
            for (var ci = 0; ci < it.options.length && ci < 2; ci++) {
              var co = it.options[ci] || ({});
              var cit = co.item || ({});
              var citem = null;
              if (cit.kind === 'custom' && Array.isArray(cit.modules)) citem = {
                kind: 'custom',
                modules: cit.modules
              }; else if (cit.kind === 'random') citem = {
                kind: 'random'
              }; else citem = {
                kind: 'normal'
              };
              opts.push({
                w: bubbleChoiceWeight(co),
                item: citem
              });
            }
            if (opts.length) {
              seq.push({
                kind: 'choice',
                options: opts
              });
              continue;
            }
          }
          if (it && it.kind === 'custom' && Array.isArray(it.modules)) seq.push({
            kind: 'custom',
            modules: it.modules
          }); else if (it && it.kind === 'random') seq.push({
            kind: 'random'
          }); else seq.push({
            kind: 'normal'
          });
        }
        if (seq.length) bubbleSeq = seq;
      } catch (err) {}
    }
    function loadBubbleCfg() {
      if (bubbleCfgLoad) return bubbleCfgLoad;
      bubbleCfgLoad = assetClient.bubbleConfig().then(function (d) {
        if (!d) return false;
        bubbleCfg = d.config || null;
        bubbleEditorState.lib = bubbleCfg && Array.isArray(bubbleCfg.lib) ? JSON.parse(JSON.stringify(bubbleCfg.lib)) : [];
        bubbleCfgLoaded = true;
        applyBubbleCfgSeq();
        return true;
      }).catch(function () { return false; }).finally(function () { bubbleCfgLoad = null; });
      return bubbleCfgLoad;
    }
    function saveBubbleCfg(cfg, okFn) {
      try {
        assetClient.saveBubbleConfig(cfg).then(function (d) {
          requireSaved(d);
          if (d && d.ok && d.config) {
            bubbleCfg = d.config;
            bubbleCfgLoaded = true;
            applyBubbleCfgSeq();
            if (okFn) okFn();
          } else if (okFn) okFn(false);
        }).catch(function (error) {
          assetFailure(error);
          if (okFn) okFn(false);
        });
      } catch (err) {
        if (okFn) okFn(false);
      }
    }
    function bubbleAutoClose() {
      bubbleSceneController.timerFired();
      if (bubbleSceneController.scene && bubbleSceneController.scene.kind === 'cost') {
        if (bubbleNoticeQueue.swapNext()) return;
        hideCostBubble();
        return;
      }
      if (bubbleSceneController.scene && bubbleSceneController.scene.kind === 'alert') {
        if (bubbleNoticeQueue.swapNext()) return;
        hideUsageAlertBubble();
        return;
      }
      hideBubble();
    }
    function bubbleRenderDefault() {
      restoreBubbleLines();
    }
    function bubbleRenderRandom(lines) {
      applyBubbleLines(lines);
    }
    function bubbleRenderCost(amount, notice) {
      notice = notice || WhaleTurnNotice.snapshot({ amount: amount }, state.currency);
      var configured = usageTurnCostLines();
      bubbleRenderModules(usageAlertModsResolved(configured, null, notice.amount, notice));
    }
    function bubblePickChoiceStep(step) {
      return bubblePickChoiceItem(step, Math.random);
    }
    function bubbleShowSeqNext() {
      var step = bubbleSeq[bubbleSeqIdx];
      if (!step) {
        hideBubble();
        return;
      }
      bubbleSeqIdx++;
      var item = bubbleIsChoice(step) ? bubblePickChoiceStep(step) : step;
      if (!item) {
        hideBubble();
        return;
      }
      if (item.kind === 'random') {
        var lines = pickRandomLines();
        bubbleSceneController.open('random', function () {
          bubbleRenderRandom(lines);
        }, window.WhaleAccountView?.mode === 'subscription' ? 0 : BUBBLE_MS);
      } else if (item.kind === 'custom') {
        bubbleSceneController.open('custom', function () {
          bubbleRenderModules(item.modules || []);
        }, window.WhaleAccountView?.mode === 'subscription' ? 0 : BUBBLE_MS);
      } else {
        bubbleSceneController.open('normal', bubbleRenderDefault, window.WhaleAccountView?.mode === 'subscription' ? 0 : BUBBLE_MS);
      }
    }
    var bubbleContent = createBubbleContent({
      window: window, getState: function () { return state; },
      getMode: function () { return window.WhaleAccountView && window.WhaleAccountView.mode; },
      getLastTurnNotice: function () { return lastTurnNotice; }, fmt: fmt,
      whaleMoneyTemplates: whaleMoneyTemplates, usageFillText: usageFillText,
      bubbleCloneModule: bubbleCloneModule
    });
    var bubbleModuleFontU = bubbleContent.fontU;
    var bubbleTokenValue = bubbleContent.tokenValue;
    var bubbleTplHelpItems = bubbleContent.tplHelpItems;
    var bubbleSnapshot = bubbleContent.snapshot;
    var bubbleTemplateHelp = createBubbleTemplateHelp({
      document: document, viewport: viewport, bubbleTplHelpItems: bubbleTplHelpItems
    });
    var bubbleTplHelpToggle = bubbleTemplateHelp.toggle;
    var bubbleRowsView = createBubbleRowsView({
      document: document, window: window, WhaleMoney: WhaleMoney,
      bubbleSnapshot: bubbleSnapshot, bubbleModuleFontU: bubbleModuleFontU,
      bubbleRowsOf: bubbleRowsOf, bubbleIsImgMod: bubbleIsImgMod,
      whaleMoneyTemplates: whaleMoneyTemplates,
      getBubbleTarget: function () { return bubbleTarget; },
      getSceneController: function () { return bubbleSceneController; },
      getVisuals: function () { return { gifEl: gifEl, labelEl: labelEl, amountEl: amountEl, hintEl: hintEl }; },
      getRoot: function () { return root; }, getBubbleBox: function () { return bubbleBox; }
    });
    var bubbleRenderModules = bubbleRowsView.render;
    var bubblePreviewInto = bubbleRowsView.preview;
    var bubbleInteraction = createBubbleInteraction({
      isEnabled: function () { return bubbleOn; },
      getScene: function () { return bubbleSceneController.scene; },
      isShown: function () { return bubbleSceneController.shown; },
      getCurrentNotice: function () { return bubbleNoticeQueue.current; },
      closeWait: hideWaitBubble,
      isSubscription: function () { return window.WhaleAccountView?.mode === 'subscription'; },
      refreshQuota: function () { window.WhaleQuota?.refresh(true); },
      startRound: function () {
        bubbleRoundOn = true;
        bubbleSeqIdx = 0;
        bubbleShowSeqNext();
      },
      isAtRoundStart: function () { return bubbleRoundOn && bubbleSeqIdx === 1; },
      shouldAdvanceOnCharacter: function () {
        return window.WhaleAccountView?.mode === 'subscription'
          ? bubbleCfg?.subscriptionTapAdvance === true
          : bubbleCfg?.tapAdvance === true;
      },
      canAdvance: function () { return bubbleRoundOn && bubbleSeqIdx < bubbleSeq.length; },
      showNext: bubbleShowSeqNext,
      closeCost: hideCostBubble,
      closeAlert: hideUsageAlertBubble,
      closeBubble: hideBubble
    });
    var whaleClick = bubbleInteraction.whaleClick;
    var bubbleNext = bubbleInteraction.bubbleNext;
    function hideBubble() {
      bubbleSceneController.clear();
      window.WhaleQuota?.clearBindings(bubbleBox);
      window.WhaleApiModels?.clearBindings(bubbleBox);
      costBubbleActive = false;
      bubbleNoticeQueue.clear();
      bubbleRoundOn = false;
      bubbleSeqIdx = 0;
      bubbleSceneController.dismiss();

      bubbleSceneController.closeVisual();
    }
    function showCostBubble(amount, notice) {
      notice = notice || WhaleTurnNotice.snapshot({ amount: amount }, state.currency);
      if (!bubbleOn || !WhaleTurnNotice.enabled(notice, {}, turnCostOn)) return;
      bubbleNoticeQueue.push({
        kind: 'cost',
        amount: amount,
        notice: notice,
        rank: 3
      });
    }
    function hideCostBubble() {
      if (bubbleNoticeQueue.swapNext()) return;
      bubbleSceneController.clear();
      costBubbleActive = false;
      bubbleSceneController.dismiss();
      bubbleSceneController.closeVisual();
      bubbleNoticeQueue.done();
    }
    var USAGE_ALERT_TTL = 6500;
    var bubbleNoticeQueue = createBubbleNoticeQueue({
      canShow: function () { return !!(bubbleOn && bubbleBox && textBox); },
      isBlocked: function () { return costBubbleActive || bubbleSceneController.scene && bubbleSceneController.scene.kind === 'alert'; },
      rejectWithoutCurrent: function () { return costBubbleActive; },
      isVisible: function () { return bubbleSceneController.shown; },
      showItem: function (item) {
        if (item.kind === 'cost') {
          bubbleSceneController.open('cost', function () { bubbleRenderCost(item.amount, item.notice); }, turnCostCloseMs > 0 ? turnCostCloseMs : 0);
        } else if (item.kind === 'wait') {
          bubbleSceneController.open('wait', function () { bubbleRenderModules(item.mods || []); }, 0);
        } else {
          bubbleSceneController.open('alert', function () { bubbleRenderModules(item.mods || []); }, item.ttlMs != null ? item.ttlMs : USAGE_ALERT_TTL);
        }
      }
    });
    function showWaitBubble(detail) {
      try {
        if (!detail || !detail.id || !bubbleOn) return false;
        var id = String(detail.id);
        if (bubbleNoticeQueue.current && bubbleNoticeQueue.current.kind === 'wait' && bubbleNoticeQueue.current.id === id) return true;
        bubbleNoticeQueue.removeWait();
        var lines = Array.isArray(detail.lines) && detail.lines.length ? detail.lines : usageWaitDefaultLines(detail.kind);
        var mods = usageAlertModsResolved(lines, null, null, { sessionLabel: detail.sessionLabel || '当前对话' });
        return bubbleNoticeQueue.push({ kind: 'wait', id: id, waitKind: detail.kind, mods: mods, rank: 1, ttlMs: 0, closeOnRole: detail.closeOnRole === true });
      } catch (err) { return false; }
    }
    function hideWaitBubble(userDismissed, id) {
      try {
        bubbleNoticeQueue.removeWait(id);
        if (!bubbleNoticeQueue.current || bubbleNoticeQueue.current.kind !== 'wait' || id && bubbleNoticeQueue.current.id !== id) return;
        var closedId = bubbleNoticeQueue.current.id;
        if (userDismissed) window.dispatchEvent(new CustomEvent('whale-wait-dismissed', { detail: { id: closedId } }));
        if (bubbleNoticeQueue.swapNext()) return;
        bubbleSceneController.clear();
        bubbleSceneController.dismiss();
        bubbleSceneController.closeVisual(); bubbleNoticeQueue.done();
      } catch (err) {}
    }
    function hideUsageAlertBubble() {
      if (bubbleNoticeQueue.swapNext()) return;
      bubbleSceneController.clear();
      bubbleSceneController.dismiss();

      bubbleSceneController.closeVisual();
      bubbleNoticeQueue.done();
    }
    function clamp(v, lo, hi) {
      return v < lo ? lo : v > hi ? hi : v;
    }
    function viewport() {
      return {
        w: window.innerWidth || document.documentElement.clientWidth || 1280,
        h: window.innerHeight || document.documentElement.clientHeight || 800
      };
    }
    function rightGap() {
      if (!scrollGapOn) return 0;
      return scrollGapPx > 0 ? scrollGapPx : 0;
    }
    function fmt(balance, currency) {
      return WhaleMoney.formatMoney(balance, currency || state && state.currency || 'USD', true);
    }
    
    function render() {
      // Stopgap guard plus root fix: refresh() no longer calls this function.
      if (bubbleFrames.switching && !bubbleSceneController.building) return;
      if (!bubbleSceneController.building) return;
      var captured = { balance: state.balance, todayUsage: state.todayUsage, currency: state.currency || 'USD', status: state.status, message: state.message };
      WhaleMoney.bind(amountEl, function () { return captured.balance === null ? (captured.status === 'error' ? '--' : '…') : fmt(captured.balance, captured.currency); });
      WhaleMoney.bind(hintEl, function () { return captured.status === 'error' ? (captured.message || '获取失败 · 点击重试').slice(0, 20) : captured.balance === null ? '加载中…' : '今日已观测 ' + (captured.todayUsage != null ? fmt(captured.todayUsage, captured.currency) : '--'); });
    }
    function express() {
      positioner.style.transform = 'translate3d(' + state.left + 'px,' + state.top + 'px,0)';
      root.classList.toggle('dshwv-left', !!state.flip);
      WhaleRendering.presentFor(drag && drag.active ? 0 : 200);
    }
    function settle() {
      var vp = viewport();
      var w = root.offsetWidth || root.getBoundingClientRect().width || 0;
      var h = root.offsetHeight || root.getBoundingClientRect().height || 0;
      if (drag && drag.active) {
        var dragging = clampToViewport(state.left, state.top, w, h, vp, rightGap());
        state.left = dragging.left;
        state.top = dragging.top;
        express();
        return;
      }
      // A minimized/tiny host or an older saved anchor can have negative edge
      // distances. Keep the pet on screen after every viewport restoration.
      var position = settlePosition(state, vp, w, h, rightGap());
      state.left = position.left;
      state.top = position.top;
      refreshFlip();
    }
    function snapBounds(vp) {
      try { return calculateSnapBounds(snapConfig, vp); }
      catch (err) { return calculateSnapBounds(null, vp); }
    }
    function snapZones(cx, cyBox, cyImg, vp) {
      try { return calculateSnapZones(snapConfig, cx, cyBox, cyImg, vp); }
      catch (err) { return calculateSnapZones(null, cx, cyBox, cyImg, vp); }
    }
    function refreshFlip() {
      try {
        if (state.h === 'left') {
          state.flip = true;
        } else if (state.h === 'right') {
          state.flip = false;
        } else {
          var w = root.offsetWidth || root.getBoundingClientRect().width || 0;
          var h = root.offsetHeight || root.getBoundingClientRect().height || 0;
          var ac = artCenterAt(state.left, state.top, w, h, !!state.flip);
          var vp = viewport();
          state.flip = ac.cx < snapBounds(vp).F;
        }
        express();
      } catch (err) {}
    }
    // ==== [刷新与配置保存] ====
    function refresh(manual) {
      if (window.WhaleAccountView?.mode === 'subscription') { window.WhaleAccountView.refresh(); return; }
      if (busy) return;
      busy = true;
      if (manual || state.balance === null) state.status = 'loading';
      var ctrl = null;
      var timer = null;
      try {
        ctrl = new AbortController();
        timer = setTimeout(function () {
          try {
            ctrl.abort();
          } catch (err) {}
        }, FETCH_TIMEOUT_MS);
      } catch (err) {}
      requestJson(BALANCE_URL + (manual ? '?refresh=1' : ''), {
        signal: ctrl ? ctrl.signal : undefined
      }).then(function (data) {
        if (data && data.ok) {
          var nb = data.unlimited ? Infinity : Number(data.totalBalance);
          var nc = String(data.currency || 'USD');
          state.balance = nb;
          state.currency = nc;
          WhaleMoney.setNativeCurrency(nc);
          state.message = '';
          state.code = '';
          state.updatedAt = Number(data.updatedAt) || Date.now();
          state.todayUsage = data.todayUsage !== undefined ? data.todayUsage : null;
          state.unlimited = !!data.unlimited;
          state.providerName = data.providerName || '';
          state.balanceScope = data.balanceScope || '';
          state.stale = !!data.stale;
          root.title = (data.providerName || '') + ' · ' + (data.balanceLabel || 'API 可用余额') + (data.stale ? '（上次成功数据）' : '');
          window.dispatchEvent(new CustomEvent('whale-balance', {
            detail: data
          }));
          checkUsageAlerts(nb, state.todayUsage);
          state.status = 'ok';
        } else {
          state.status = 'error';
          state.code = data && data.code || 'ERROR';
          state.message = data && data.error ? String(data.error) : '获取失败';
          window.dispatchEvent(new CustomEvent('whale-balance', {
            detail: data || ({
              ok: false
            })
          }));
        }
      }).catch(function () {
        state.status = 'error';
        state.code = 'NETWORK';
        state.message = '获取失败';
      }).finally(function () {
        busy = false;
        if (timer) clearTimeout(timer);
      });
    }
    var soundOn = true;
    var soundVol = 0.9;
    var soundSet = 'duck';
    var usageMode = 'ledger';
    var bubbleOn = true;
    var turnCostOn = true;
    var turnCostCloseMs = 5000;
    var costBubbleActive = false;
    var scrollGapOn = false;
    var scrollGapPx = 17;
    var menuBtnHide = false;
    function saveConfig() {
      try {
        updateSoundSettings(function (current) {
          return {
            size: Object.assign({}, current.size, {
              scale: state.scale,
              sound: soundOn,
              vol: soundVol,
              soundSet: soundSet,
              usageMode: usageMode,
              bubbleOn: bubbleOn,
              turnCostOn: turnCostOn,
              turnCostCloseMs: turnCostCloseMs,
              scrollGapOn: scrollGapOn,
              scrollGapPx: scrollGapPx,
              menuBtnHide: menuBtnHide
            }),
            usage: current.usage
          };
        });
        var vp = viewport();
        var w = root.offsetWidth || root.getBoundingClientRect().width || 0;
        var h = root.offsetHeight || root.getBoundingClientRect().height || 0;
        var leftDist = state.left;
        var rightDist = vp.w - state.left - w;
        var topDist = state.top;
        var bottomDist = vp.h - state.top - h;
        var hAnchor = leftDist <= rightDist ? 'left' : 'right';
        var hDistRaw = Math.round(Math.min(leftDist, rightDist));
        var hDist = hAnchor === 'right' && scrollGapOn ? Math.max(0, hDistRaw - rightGap()) : hDistRaw;
        localStorage.setItem('dshw-pos', JSON.stringify({
          v: 2,
          hAnchor: hAnchor,
          hDist: hDist,
          vAnchor: topDist <= bottomDist ? 'top' : 'bottom',
          vDist: Math.round(Math.min(topDist, bottomDist))
        }));
      } catch (err) {}
    }
    function setBubbleOn(v) {
      bubbleOn = !!v;
      bubbleToggle.checked = bubbleOn;
      saveConfig();
      if (!bubbleOn) hideCostBubble();
    }
    function setTurnCostOn(v) {
      turnCostOn = !!v;
      turnCostToggle.checked = turnCostOn;
      turnCostCloseInput.disabled = !turnCostOn;
      saveConfig();
      if (!turnCostOn) hideCostBubble();
    }
    function setTurnCostClose(v) {
      if (!turnCostOn) return;
      var n = Math.max(0, Math.round(Number(v) || 0));
      turnCostCloseMs = n * 1000;
      turnCostCloseInput.value = String(n);
      saveConfig();
    }
    function setScrollGapOn(v) {
      scrollGapOn = !!v;
      scrollGapToggle.checked = scrollGapOn;
      scrollGapInput.disabled = !scrollGapOn;
      saveConfig();
      settle();
    }
    function setScrollGapPx(v) {
      if (!scrollGapOn) return;
      var n = Math.max(0, Math.round(Number(v) || 0));
      scrollGapPx = n;
      scrollGapInput.value = String(n);
      saveConfig();
      settle();
    }
    function applyMenuBtnHideUI() {
      try {
        menuBtn.classList.toggle('dshwv-menu-btn-hidden', menuBtnHide);
        if (menuBtnHide) resetMenuButtonHover();
      } catch (err) {}
    }
    function setMenuBtnHide(v) {
      menuBtnHide = !!v;
      if (menuHideToggle) menuHideToggle.checked = menuBtnHide;
      saveConfig();
      applyMenuBtnHideUI();
    }
    function scaleToDisplay(s) {
      return Math.round((s - MIN_SCALE) / ((MAX_SCALE - MIN_SCALE) / 19)) + 1;
    }
    function setScale(v) {
      var next = Math.round(Math.min(MAX_SCALE, Math.max(MIN_SCALE, Number(v))) * 10) / 10;
      var prevTrans = positioner.style.transition;
      positioner.style.transition = 'none';
      var rect = whaleLayoutRect();
      var fx = state.flip ? rect.left : rect.right;
      var fy = rect.bottom;
      state.scale = next;
      root.style.setProperty('--dshw-scale', String(next));
      scaleInput.value = String(next);
      scaleNumber.value = String(scaleToDisplay(next));
      saveConfig();
      var r2 = whaleLayoutRect();
      var vp = viewport();
      if (state.flip) {
        state.left = Math.min(Math.max(fx, 0), Math.max(0, vp.w - r2.width));
      } else {
        state.left = Math.min(Math.max(fx - r2.width, 0), Math.max(0, vp.w - r2.width));
      }
      state.top = Math.min(Math.max(fy - r2.height, 0), Math.max(0, vp.h - r2.height));
      express();
      requestAnimationFrame(function () {
        positioner.style.transition = prevTrans;
      });
    }
    function setVol(v) {
      var next = Math.round(Math.min(1, Math.max(0, Number(v))) * 100) / 100;
      soundVol = next;
      volInput.value = String(next);
      volPct.textContent = Math.round(next * 100) + '%';
      try {
        if (pressAudio) pressAudio.volume = next;
        if (releaseAudio) releaseAudio.volume = next;
      } catch (err) {}
      saveConfig();
    }
    function setSoundSet(v) {
      soundSet = typeof v === 'string' && v ? v : 'duck';
      setAudioBtnText(audioGroupName(soundSet));
      applySoundSet();
      saveConfig();
    }
    var SQUISH = 'scaleY(0.88) scaleX(1.05)';
    var pressAudio = null;
    var releaseAudio = null;
    var releasePlayed = false;
    function applySoundSet() {
      try {
        if (pressAudio) { pressAudio.pause(); pressAudio.removeAttribute('src'); pressAudio.load(); }
        if (releaseAudio) { releaseAudio.pause(); releaseAudio.removeAttribute('src'); releaseAudio.load(); }
        if (window.WhaleAudio) { window.WhaleAudio.stop('gesture'); ['press', 'release'].forEach(function (slot) { if (!audioGroupSlotEmpty(soundSet, slot)) window.WhaleAudio.warm('/dsh-whale/sound/' + slot + '.mp3?set=' + encodeURIComponent(soundSet)).catch(function () {}); }); pressAudio = null; releaseAudio = null; return; }
        var pEmpty = audioGroupSlotEmpty(soundSet, 'press');
        var rEmpty = audioGroupSlotEmpty(soundSet, 'release');
        if (pEmpty) {
          pressAudio = null;
        } else {
          pressAudio = new Audio('/dsh-whale/sound/press.mp3?set=' + soundSet);
          pressAudio.preload = 'auto';
          pressAudio.volume = soundVol;
        }
        if (rEmpty) {
          releaseAudio = null;
        } else {
          releaseAudio = new Audio('/dsh-whale/sound/release.mp3?set=' + soundSet);
          releaseAudio.preload = 'auto';
          releaseAudio.volume = soundVol;
        }
      } catch (err) {}
    }
    function feedback(event) {
      var url = '/dsh-whale/sound/' + event + '.mp3?set=' + encodeURIComponent(soundSet);
      if (audioGroupSlotEmpty(soundSet, event)) url = '';
      window.WhaleFeedbackSources = window.WhaleFeedbackSources || {};
      window.WhaleFeedbackSources[event] = url;
      if (window.WhaleFeedback) return window.WhaleFeedback.play(event, url, soundOn ? soundVol : 0);
      return false;
    }
    function playPress() {
      releasePlayed = false;
      if (feedback('press')) return;
      if (!soundOn || !pressAudio) return;
      try { if (releaseAudio) releaseAudio.pause(); pressAudio.currentTime = 0; pressAudio.play().catch(function () {}); } catch (err) {}
    }
    function playRelease() {
      if (releasePlayed) return;
      releasePlayed = true;
      if (feedback('release')) return;
      if (!soundOn || !releaseAudio) return;
      try { if (pressAudio) pressAudio.pause(); releaseAudio.currentTime = 0; releaseAudio.play().catch(function () {}); } catch (err) {}
    }
    // Only the character squishes. The bubble shares the same parent, so a transform
    // on the parent would deform and shake the text above it.
    function pressDown() {
      if (window.WhaleGesture) window.WhaleGesture.apply(img, true, window.WhaleFeedback && window.WhaleFeedback.feel);
      else { img.style.transitionDuration = '75ms'; img.style.transform = SQUISH; }
      playPress();
    }
    function pressUp() {
      if (window.WhaleGesture) window.WhaleGesture.apply(img, false, window.WhaleFeedback && window.WhaleFeedback.feel);
      else { img.style.transitionDuration = '140ms'; img.style.transform = 'scaleY(1) scaleX(1)'; }
      playRelease();
    }    var menuOpen = false;
    var menuPositionFrame = 0;
    new ResizeObserver(function () {
      if (!menuOpen || menuPositionFrame) return;
      // Read/write menu geometry in the next frame, never while the browser is
      // delivering resize observations for that same menu.
      menuPositionFrame = requestAnimationFrame(function () {
        menuPositionFrame = 0;
        if (menuOpen) positionMenu();
      });
    }).observe(menuBox);
    function toggleMenu() {
      menuOpen = !menuOpen;
      if (menuOpen) positionMenu();
      menuBox.classList.toggle('dshwv-menu-open', menuOpen);
      if (menuOpen) showMenuButton();
      if (!menuOpen) { closeUsagePanel(); closeFxInfo(); }
    }
    function closeMenu() {
      menuOpen = false;
      closeFxInfo();
      if (menuPositionFrame) cancelAnimationFrame(menuPositionFrame);
      menuPositionFrame = 0;
      menuBox.classList.remove('dshwv-menu-open');
      closeRolePanel();
      closeAudioGroupPanel();
      closeUsagePanel();
      positioner.style.transition = '';
      snapCheck();
    }
    // 完整设置窗口保存后，主进程会把这批改动广播给两个窗口。挂件这边要把
    // 改动镜像回 localStorage（它才是运行期的读取源），并对需要即时重绘的项
    // 真正执行一次，否则要等重载才生效。
    var settingsApplyEpoch = 0;
    try { window.whaleDesktop.onSettingsChanged(function (change) {
      if (change && ['size', 'usage', 'completion'].includes(change.domain)) {
        var ownSettingsEpoch = ++settingsApplyEpoch;
        requestJson(SETTINGS_URL).then(function (snapshot) {
          if (ownSettingsEpoch !== settingsApplyEpoch) return;
          applySoundSettingsSnapshot(snapshot);
          var saved = snapshot.size;
          state.scale = saved.scale;
          root.style.setProperty('--dshw-scale', String(saved.scale));
          scaleInput.value = String(saved.scale); scaleNumber.value = String(scaleToDisplay(saved.scale));
          bubbleOn = saved.bubbleOn; bubbleToggle.checked = bubbleOn;
          scrollGapOn = saved.scrollGapOn; scrollGapPx = saved.scrollGapPx;
          scrollGapToggle.checked = scrollGapOn; scrollGapInput.value = String(scrollGapPx); scrollGapInput.disabled = !scrollGapOn;
          menuBtnHide = saved.menuBtnHide; if (menuHideToggle) menuHideToggle.checked = menuBtnHide;
          applyMenuBtnHideUI(); settle(); syncLevel1Controls();
          window.WhaleRendering.refitBubble();
        }).catch(assetFailure);
        return;
      }
      if (change && change.domain === 'displayMode') {
        window.WhaleAccountView.setMode(change.values.mode).catch(assetFailure);
        return;
      }
      if (!change || change.domain !== 'ui' || !Array.isArray(change.keys)) return;
      for (var i = 0; i < change.keys.length; i++) {
        var key = change.keys[i];
        var value = change.values ? change.values[key] : undefined;
        try {
          if (value === null || value === undefined) localStorage.removeItem(key);
          else localStorage.setItem(key, typeof value === 'string' ? value : JSON.stringify(value));
        } catch (err) {}
      }
      if (change.values && Object.hasOwn(change.values, 'dshw-bubble-shape')) {
        try {
          var appliedShape = window.WhaleBubbleShape.apply(String(change.values['dshw-bubble-shape'] || 'ellipse'));
          var shapeSel = document.getElementById('dshw-bubble-shape');
          if (shapeSel) shapeSel.value = appliedShape;
          syncLevel1Controls();
        } catch (err) {}
      }
      if (change.values && Object.hasOwn(change.values, 'dshw-role')) {
        try { applyRole(change.values['dshw-role']); } catch (err) {}
      }
      if (change.values && Object.hasOwn(change.values, 'dshw-v3-feedback') && window.WhaleFeedback && window.WhaleFeedback.reload) {
        try { window.WhaleFeedback.reload(); } catch (err) {}
      }
    }); } catch (err) {}

    window.addEventListener('whale-storage-reconciled', function () {
      window.WhaleBubbleShape.apply(localStorage.getItem('dshw-bubble-shape') || 'ellipse');
      window.WhaleFeedback?.reload();
    });
    // 完整设置窗口通过具体动作按钮唤起这里的原生编辑器。
    // 这些弹层闭包在 whale-widget.js 内部、依赖鲸鱼自身的 DOM 与状态，
    // 所以不搬进设置窗口，只在这里加事件监听。
    window.addEventListener('whale-open-editor', function (event) {
      var editor = event && event.detail ? String(event.detail.editor || '') : '';
      // 主进程已经把鲸鱼点亮并置前了，这里只管关掉菜单再打开对应弹层。
      try { if (menuOpen) closeMenu(); } catch (err) {}
      if (editor === 'role') { toggleRolePanel(); return; }
      if (editor === 'snap') { openSnapModal(); return; }
      if (editor === 'bubble') { openBubbleEditor(); return; }
      if (editor === 'reminder') { usageAlertBudgetEditor('alert', function () {}); return; }
      if (editor === 'workshop' && window.WhaleWorkshopOpen) { window.WhaleWorkshopOpen(); return; }
      if (editor === 'api') { window.dispatchEvent(new Event('whale-open-settings')); return; }
      if (editor === 'sound') {
        var soundEntry = document.querySelector('[data-action="open-sound-settings"]');
        if (soundEntry) soundEntry.click();
        else if (window.WhaleFeedback) window.WhaleFeedback.open();
        return;
      }
    });
    function snapCheck() {
      if (!snapConfig || snapConfig.mode === 'off') return;
      var rect = whaleLayoutRect();
      var vp = viewport();
      var w = rect.width, h = rect.height;
      var left = rect.left, top = rect.top;
      var ac = artCenterAt(left, top, w, h, !!state.flip);
      var z = snapZones(ac.cx, top + h / 2, ac.cy, vp);
      var moved = false;
      if (z.zH === 'left') {
        state.h = 'left';
        state.hOff = 0;
        left = 0;
        moved = true;
      } else if (z.zH === 'right') {
        state.h = 'right';
        state.hOff = 0;
        left = vp.w - w - rightGap();
        moved = true;
      } else {
        state.h = null;
        state.hOff = left;
      }
      if (z.zV === 'top') {
        state.v = 'top';
        state.vOff = 0;
        top = 0;
        moved = true;
      } else if (z.zV === 'bottom') {
        state.v = 'bottom';
        state.vOff = 0;
        top = Math.max(0, vp.h - h);
        moved = true;
      } else {
        state.v = 'bottom';
        state.vOff = Math.max(0, vp.h - top - h);
      }
      state.flip = z.flip;
      if (moved) {
        state.left = left;
        state.top = top;
        settle();
      } else {
        express();
      }
    }
    function positionMenu() {
      try {
        var r = positioner.getBoundingClientRect();
        var b = menuBtn.getBoundingClientRect();
        var vp = viewport();
        var onLeft = r.left + root.offsetWidth / 2 < vp.w / 2;
        var width = menuBox.offsetWidth, height = menuBox.offsetHeight;
        var assetTop = r.top + root.offsetHeight * (1 - 0.5945);
        var left = onLeft ? b.left : b.right - width;
        var top = assetTop - height - 10;
        if (top < 8) {
          if (b.right + 12 + width <= vp.w - 8) left = b.right + 12;
          else if (b.left - 12 - width >= 8) left = b.left - 12 - width;
          else if (b.bottom + height + 10 <= vp.h - 8) top = b.bottom + 10;
          if (top < 8) top = b.top - height / 2;
        }
        menuBox.style.left = clamp(left, 8, Math.max(8, vp.w - width - 8)) + 'px';
        menuBox.style.right = 'auto';
        menuBox.style.top = clamp(top, 8, Math.max(8, vp.h - height - 8)) + 'px';
        menuBox.style.bottom = 'auto';
        menuBox.style.transformOrigin = onLeft ? 'bottom left' : 'bottom right';
      } catch (err) {}
    }
    function setAudioBtnText(t) {
      try {
        audioGroupBtnLabel.textContent = t;
      } catch (err) {}
    }
    // ==== [角色面板与裁图确认] ====
    var AUDIO_URL = '/dsh-whale/audio.json';
    var audioGroups = [];
    var audioFragments = [];
    var audioGroupPanelOpen = false;
    function loadAudio() {
      try {
        assetClient.audio().then(function (d) {
          if (!d) return;
          if (Array.isArray(d.groups)) audioGroups = d.groups;
          if (Array.isArray(d.fragments)) audioFragments = d.fragments;
          assetWarning(d);
          var exists = false;
          for (var i = 0; i < audioGroups.length; i++) if (audioGroups[i].id === soundSet) {
            exists = true;
            break;
          }
          if (!exists) setSoundSet('duck'); else {
            setAudioBtnText(audioGroupName(soundSet));
            try {
              applySoundSet();
            } catch (err) {}
          }
          renderAudioGroupPanel();
          refreshTaskEndAfterAudio();
        }).catch(function () {});
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
        var b = audioGroupBtn.getBoundingClientRect();
        var vp = viewport();
        var availableWidth = Math.max(80, vp.w - 8);
        var panelW = Math.min(Math.max(160, Math.round(b.width)), availableWidth);
        audioGroupPanel.style.maxHeight = Math.max(80, Math.min(240, vp.h - 16)) + 'px';
        audioGroupPanel.style.maxWidth = availableWidth + 'px';
        audioGroupPanel.style.width = panelW + 'px';
        audioGroupPanel.style.left = Math.max(4, Math.min(b.left, vp.w - panelW - 4)) + 'px';
        audioGroupPanel.style.top = '4px';
        audioGroupPanel.style.display = 'block';
        var panelH = audioGroupPanel.getBoundingClientRect().height;
        var below = vp.h - b.bottom - 10;
        var above = b.top - 10;
        var panelTop = panelH <= below ? b.bottom + 6
          : panelH <= above ? b.top - panelH - 6
          : below >= above ? Math.max(4, b.bottom + 6) : Math.max(4, b.top - panelH - 6);
        audioGroupPanel.style.top = Math.max(4, Math.min(panelTop, vp.h - panelH - 4)) + 'px';
        audioGroupPanel.classList.add('dshwv-audiolist-open');
        audioGroupPanelOpen = true;
      } catch (err) {}
    }
    function closeAudioGroupPanel() {
      audioGroupPanel.classList.remove('dshwv-audiolist-open');
      audioGroupPanel.style.display = 'none';
      audioGroupPanelOpen = false;
    }

    // ==== [音频组与槽面板] ====
    var audioGroupList = createAudioGroupList({
      document: document, requestJson: requestJson, url: AUDIO_URL,
      getGroups: function () { return audioGroups; }, setGroups: function (groups) { audioGroups = groups; },
      getSoundSet: function () { return soundSet; }, setSoundSet: setSoundSet,
      getPanel: function () { return audioGroupPanel; }, closePanel: closeAudioGroupPanel,
      makeNameCell: makeNameCell, bindNameMarquee: bindNameMarquee,
      requireSaved: requireSaved, assetFailure: assetFailure, showConfirm: showConfirm,
      refreshTaskEnd: refreshTaskEndAfterAudio
    });
    var renderAudioGroupPanel = audioGroupList.render;
    var audioEditPressVal = 'ya1';
    var audioEditReleaseVal = 'ya2';
    var audioSlotPanel = createAudioSlotPanel({
      document: document, viewport: viewport,
      getFragments: function () { return audioFragments; },
      getPress: function () { return audioEditPressVal; }, setPress: function (id) { audioEditPressVal = id; },
      getRelease: function () { return audioEditReleaseVal; }, setRelease: function (id) { audioEditReleaseVal = id; },
      getPressBtn: function () { return audioEditPressBtn; }, getReleaseBtn: function () { return audioEditReleaseBtn; },
      getPressPanel: function () { return audioEditPressPanel; }, getReleasePanel: function () { return audioEditReleasePanel; },
      makeNameCell: makeNameCell, bindNameMarquee: bindNameMarquee,
      previewEnsure: audioEditPreviewEnsure, deleteFragment: audioDeleteFragmentInSlot
    });
    var toggleAudioSlotPanel = audioSlotPanel.toggle;
    var closeAudioSlotPanels = audioSlotPanel.close;
    var renderAudioSlotPanel = audioSlotPanel.render;
    var audioGroupEditorApi = createAudioGroupEditor({
      Audio: Audio, requestJson: requestJson, url: AUDIO_URL,
      elements: {
        mask: audioEditMask, card: audioEditCard, title: audioEditTitle, name: audioEditName,
        play: audioEditPlay, cancel: audioEditCancel, save: audioEditSave,
        pressImport: audioEditPressImport, releaseImport: audioEditReleaseImport
      },
      getGroups: function () { return audioGroups; }, setGroups: function (groups) { audioGroups = groups; },
      getFragments: function () { return audioFragments; }, setFragments: function (fragments) { audioFragments = fragments; },
      getPress: function () { return audioEditPressVal; }, setPress: function (id) { audioEditPressVal = id; },
      getRelease: function () { return audioEditReleaseVal; }, setRelease: function (id) { audioEditReleaseVal = id; },
      getSoundSet: function () { return soundSet; }, setSoundSet: setSoundSet,
      getVolume: function () { return soundVol; }, renderGroups: renderAudioGroupPanel,
      refreshTaskEnd: refreshTaskEndAfterAudio, applySoundSet: applySoundSet,
      slotPanel: audioSlotPanel,
      startImport: function (slot) {
        audioCropEditor.setTarget(slot);
        audioCropFileInput.value = '';
        audioCropFileInput.click();
      },
      requireSaved: requireSaved, assetFailure: assetFailure
    });
    function openAudioGroupEditor(group) { return audioGroupEditorApi.open(group); }
    function hideAudioEditor(outcome, detail) { return audioGroupEditorApi.hide(outcome, detail); }
    function openAudioEditorForFeature(options) { return audioGroupEditorApi.openForFeature(options); }
    function saveAudioGroup() { return audioGroupEditorApi.save(); }
    function audioEditPreviewDown() { return audioGroupEditorApi.previewDown(); }
    function audioEditPreviewUp() { return audioGroupEditorApi.previewUp(); }
    function audioEditPreviewEnsure(force) { return audioGroupEditorApi.ensurePreview(force); }
    var audioCropFileInput = document.createElement('input');
    audioCropFileInput.type = 'file';
    audioCropFileInput.accept = 'audio/*';
    audioCropFileInput.style.display = 'none';
    document.body.appendChild(audioCropFileInput);
    var audioCropEditor = createAudioCropEditor({
      window: window,
      elements: {
        mask: audioCropMask, canvas: audioCropCanvas, start: audioCropStart, startNum: audioCropStartNum,
        end: audioCropEnd, endNum: audioCropEndNum, dual: audioCropDual, dualFill: audioCropDualFill,
        dualStart: audioCropDualStart, dualEnd: audioCropDualEnd, zoomRange: audioCropZoomRange,
        zoomNum: audioCropZoomNum, time: audioCropTime, name: audioCropName, ok: audioCropOk,
        cancel: audioCropCancel, play: audioCropPlay
      },
      requestJson: requestJson, uploadFragment: function (name, dataUrl) { return assetClient.uploadAudioFragment(name, dataUrl); },
      getFragments: function () { return audioFragments; }, setFragments: function (value) { audioFragments = value; },
      getGroups: function () { return audioGroups; }, setGroups: function (value) { audioGroups = value; },
      applySlot: function (slot, id) { if (slot === 'press') audioEditPressVal = id; else audioEditReleaseVal = id; audioSlotPanel.refresh(); },
      renderGroups: renderAudioGroupPanel, refreshSlot: function () { audioSlotPanel.refresh(); },
      previewEnsure: audioEditPreviewEnsure, refreshTaskEnd: refreshTaskEndAfterAudio,
      requireSaved: requireSaved, assetFailure: assetFailure, assetNotice: assetNotice
    });
    function audioDeleteFragmentInSlot(slot, id) {
      if (!id) return;
      var f = null;
      for (var i = 0; i < audioFragments.length; i++) if (audioFragments[i].id === id) {
        f = audioFragments[i];
        break;
      }
      if (!f || f.preset) return;
      showConfirm('确定删除音频「' + f.name + '」吗？', function () {
        try {
          requestJson(AUDIO_URL, {
            method: 'POST',
            body: {
              action: 'delete-fragment',
              id: id
            }
          }).then(function (d) {
          requireSaved(d);
            if (d && d.ok && Array.isArray(d.fragments)) {
              audioFragments = d.fragments;
              if (Array.isArray(d.groups)) audioGroups = d.groups;
              if (slot === 'press' && audioEditPressVal === id) {
                audioEditPressVal = 'ya1';
                audioSlotPanel.refresh();
              }
              if (slot === 'release' && audioEditReleaseVal === id) {
                audioEditReleaseVal = 'ya2';
                audioSlotPanel.refresh();
              }
              audioEditPreviewEnsure(true);
              renderAudioGroupPanel();
              renderAudioSlotPanel(slot);
              refreshTaskEndAfterAudio();
            }
          }).catch(assetFailure);
        } catch (err) { assetFailure(err); }
      });
    }
    audioEditPressBtn.addEventListener('click', function (e) {
      e.stopPropagation();
      toggleAudioSlotPanel('press');
    });
    audioEditReleaseBtn.addEventListener('click', function (e) {
      e.stopPropagation();
      toggleAudioSlotPanel('release');
    });

    var characterInteraction = createCharacterInteraction({
      document: document, window: window, localStorage: localStorage, rendering: WhaleRendering,
      root: root, image: img, positioner: positioner, menuButton: menuBtn, state: state, dragStatus: drag,
      clickDistanceSq: CLICK_SQ, imageUrl: IMG_URL, viewport: viewport, rightGap: rightGap,
      clampToViewport: clampToViewport, artCenterAt: artCenterAt, snapZones: snapZones,
      restoreAnchor: restoreAnchor, express: express, settle: settle, saveConfig: saveConfig,
      refreshFlip: refreshFlip, pressDown: pressDown, pressUp: pressUp, whaleClick: whaleClick,
      refresh: refresh, closeMenu: closeMenu, toggleMenu: toggleMenu, closeRolePanel: closeRolePanel,
      closeAudioGroupPanel: closeAudioGroupPanel, hideBubble: hideBubble,
      applyBubbleConfig: applyBubbleCfgSeq, positionMenu: positionMenu,
      isMenuOpen: function () { return menuOpen; },
      isMenuButtonHidden: function () { return menuBtnHide; },
      isScrollGapEnabled: function () { return scrollGapOn; }
    });
    var setupHitTest = characterInteraction.setupHitTest;
    var whaleLayoutRect = characterInteraction.layoutRect;
    var resetMenuButtonHover = characterInteraction.resetMenuButtonHover;
    var showMenuButton = characterInteraction.showMenuButton;

    function applySoundSettingsSnapshot(snapshot) {
      snapshot = snapshot || {};
      var saved = snapshot.size || snapshot;
      soundOn = saved.sound !== false;
      soundVol = Math.max(0, Math.min(1, Number(saved.vol) || 0));
      soundSet = saved.soundSet || 'duck';
      turnCostOn = saved.turnCostOn !== false;
      turnCostCloseMs = Math.max(0, Number(saved.turnCostCloseMs) || 0);
      volInput.value = String(soundVol); volPct.textContent = Math.round(soundVol * 100) + '%';
      setAudioBtnText(audioGroupName(soundSet)); applySoundSet();
      turnCostToggle.checked = turnCostOn;turnCostCloseInput.disabled = !turnCostOn;
      turnCostCloseInput.value = String(Math.round(turnCostCloseMs / 1000));
      var settings = usagePanelApi.getUsageSet();
      if (snapshot.usage && typeof snapshot.usage === 'object') settings = snapshot.usage;
      else {
        settings = settings || {};
        settings.taskEnd = saved.taskEnd || settings.taskEnd || {};
      }
      usagePanelApi.setUsageSet(settings);
      taskEndToggle.checked = settings.taskEnd.on === true;
      taskEndSel.disabled = !taskEndToggle.checked;
      fillTaskEndOptions(settings.taskEnd);
      if (!turnCostOn) hideCostBubble();
    }
    window.addEventListener('whale-sound-settings-applied', function (event) {
      if (event.detail && event.detail.schemaVersion === 1) return;
      applySoundSettingsSnapshot(event.detail || {});
    });
    window.addEventListener('whale-edit-turn-cost', function () {
      usageAlertBudgetEditor('turnCost', function (o) {
        var settings = usagePanelApi.getUsageSet() || ({}); settings.turnCost = { lines: o.lines };
        usagePanelApi.setUsageSet(settings);
        setTurnCostOn(o.on); setTurnCostClose(o.ttlSec);
        usagePanelApi.save({ turnCost: settings.turnCost });
      });
    });
    window.addEventListener('whale-api-model-alert', function (event) {
      var detail = event.detail || ({});
      showUsagePopup('API 模型提醒', detail.lines || [{ type: 'text', text: String(detail.message || 'API 模型达到提醒条件'), size: 6, bold: true }], null, null, detail.rank === 1 ? 1 : 2, detail.config || { autoClose: false, ttlSec: 6 });
    });
    window.addEventListener('whale-edit-api-reminder', function (event) {
      var detail=event.detail || {};
      usageAlertBudgetEditor(detail.key === 'budget' ? 'budget' : 'alert', detail.save, detail.config);
    });
    window.addEventListener('whale-edit-sound-prompt', function (event) {
      var detail = event.detail || {};
      if (detail.key !== 'question' && detail.key !== 'approval') return;
      usageAlertBudgetEditor(detail.key, detail.save, detail.config);
    });
    window.addEventListener('whale-edit-sound-turn-cost', function (event) {
      var detail = event.detail || {};
      usageAlertBudgetEditor('turnCost', detail.save, detail.config);
    });
    var mountedSoundSettingsEntry = null;
    var legacySoundRows = [row2, row3, row7, rowTaskEnd];
    var legacySoundUi = Object.freeze({
      mountMenuEntry: function (node) {
        if (!node || !row2.parentNode) throw new Error('音效设置菜单尚未准备好');
        if (mountedSoundSettingsEntry && mountedSoundSettingsEntry !== node) mountedSoundSettingsEntry.remove();
        row2.parentNode.insertBefore(node, row2);
        mountedSoundSettingsEntry = node;
        for (var i = 0; i < legacySoundRows.length; i++) legacySoundRows[i].hidden = true;
        var disposed = false;
        return function () {
          if (disposed) return;
          disposed = true;
          if (mountedSoundSettingsEntry === node) {
            mountedSoundSettingsEntry = null;
            node.remove();
            for (var j = 0; j < legacySoundRows.length; j++) legacySoundRows[j].hidden = false;
          }
        };
      },
      audioEditor: Object.freeze({ open: openAudioEditorForFeature }),
      promptEditor: Object.freeze({
        open: function (options) {
          options = options || {};
          var kind = options.kind;
          if (kind !== 'turnCost' && kind !== 'question' && kind !== 'approval') return Promise.reject(new Error('提示类型无效'));
          return new Promise(function (resolve) {
            usageAlertBudgetEditor(kind, function (config) {
              resolve({ status: 'saved', config: config });
            }, options.config, function () {
              resolve({ status: 'cancelled' });
            });
          });
        }
      }),
      applySettings: applySoundSettingsSnapshot
    });
    window.WhaleLegacySoundUi = legacySoundUi;
    window.dispatchEvent(new CustomEvent('whale-legacy-sound-ready', { detail: legacySoundUi }));
    applySoundSet();
    setupHitTest(initRoleUrl);
    loadRoles();
    loadAudio();
    loadUsageSettings(function () {
      try {
        var settings = usagePanelApi.getUsageSet();
        if (settings && settings.taskEnd) {
          taskEndToggle.checked = !!settings.taskEnd.on;
          taskEndSel.disabled = !settings.taskEnd.on;
        }
        fillTaskEndOptions(settings && settings.taskEnd);
        setTimeout(function () {
          try {
            if (audioFragments && audioFragments.length) fillTaskEndOptions(usagePanelApi.getUsageSet() && usagePanelApi.getUsageSet().taskEnd);
          } catch (err) {}
        }, 1500);
      } catch (err) {}
    });
    loadBubbleCfg();
    if (window.whaleDesktop && window.whaleDesktop.testMode) {
      window.__whaleRenderTest = Object.freeze({
        refresh: refresh, usage: refreshUsageMain, next: bubbleNext, close: hideBubble,
        poll: pollLastTurn, importRole: onRoleFileChosen, importBubble: bubbleUploadImg,
        openHistory: openUsageRecordsWindow,
        showCost: showCostBubble,
        open: whaleClick,
        queue: function (items) { hideBubble(); bubbleSeq = items; },
        place: function (x, y, flip) { state.left = x; state.top = y; state.flip = !!flip; express(); },
        scale: setScale, role: applyRole,
        scene: function (modules, ttl) { bubbleSceneController.open('custom', function () { bubbleRenderModules(modules); }, ttl || 0); },
        status: function () { return { switching: bubbleFrames.switching, busy: busy, shown: bubbleSceneController.shown, scene: bubbleSceneController.scene && bubbleSceneController.scene.kind, epoch: bubbleSceneController.epoch, balance: state.balance, today: state.todayUsage, status: state.status, front: bubbleFrames.front.root.dataset.buffer, randomPicks: bubbleFrames.front.root.innerText, hitCache: Object.assign({}, WhaleRendering.hitCache.stats), scale: state.scale, flip: state.flip }; }
      });
    }
    requestJson(SETTINGS_URL).then(function (payload) {
      var d = payload && payload.ok ? payload.size : null;
      if (d && typeof d.scale === 'number' && d.scale >= MIN_SCALE - 0.1 && d.scale <= MAX_SCALE + 0.1) {
        state.scale = d.scale;
        root.style.setProperty('--dshw-scale', String(d.scale));
        scaleInput.value = String(d.scale);
        scaleNumber.value = String(scaleToDisplay(d.scale));
        settle();
      }
      if (d && typeof d.vol === 'number') {
        soundVol = d.vol;
        soundOn = d.sound !== false;
        volInput.value = String(soundVol);
        volPct.textContent = Math.round(soundVol * 100) + '%';
        try {
          if (pressAudio) pressAudio.volume = soundVol;
          if (releaseAudio) releaseAudio.volume = soundVol;
        } catch (err) {}
      }
      if (d && typeof d.soundSet === 'string' && d.soundSet) {
        soundSet = d.soundSet;
        setAudioBtnText(audioGroupName(soundSet));
        applySoundSet();
      }
      if (d && typeof d.usageMode === 'string') {
        usageMode = 'ledger';
      }
      if (d && typeof d.bubbleOn === 'boolean') {
        bubbleOn = d.bubbleOn;
        bubbleToggle.checked = bubbleOn;
      }
      if (d && typeof d.turnCostOn === 'boolean') {
        turnCostOn = d.turnCostOn;
        turnCostToggle.checked = turnCostOn;
        turnCostCloseInput.disabled = !turnCostOn;
      }
      if (d && typeof d.turnCostCloseMs === 'number') {
        turnCostCloseMs = d.turnCostCloseMs > 0 ? d.turnCostCloseMs : 0;
        turnCostCloseInput.value = String(Math.round(turnCostCloseMs / 1000));
      }
      if (d && typeof d.scrollGapOn === 'boolean') {
        scrollGapOn = d.scrollGapOn;
        scrollGapToggle.checked = scrollGapOn;
        scrollGapInput.disabled = !scrollGapOn;
      }
      if (d && typeof d.scrollGapPx === 'number') {
        scrollGapPx = d.scrollGapPx > 0 ? Math.round(d.scrollGapPx) : 0;
        scrollGapInput.value = String(scrollGapPx);
      }
      if (d && typeof d.menuBtnHide === 'boolean') {
        menuBtnHide = d.menuBtnHide;
        if (menuHideToggle) menuHideToggle.checked = menuBtnHide;
        applyMenuBtnHideUI();
      }
      try {
        var a = JSON.parse(localStorage.getItem('dshw-pos') || 'null');
        if (a && a.v === 2 && (a.hAnchor === 'left' || a.hAnchor === 'right') && Number.isFinite(a.hDist) && a.hDist >= 0 && (a.vAnchor === 'top' || a.vAnchor === 'bottom') && Number.isFinite(a.vDist) && a.vDist >= 0) {
          var vpA = viewport();
          var wA = root.offsetWidth || root.getBoundingClientRect().width || 0;
          var hA = root.offsetHeight || root.getBoundingClientRect().height || 0;
          var effectiveRightDist = a.hAnchor === 'right' ? a.hDist + (scrollGapOn ? rightGap() : 0) : a.hDist;
          var lA = a.hAnchor === 'left' ? a.hDist : vpA.w - effectiveRightDist - wA;
          var tA = a.vAnchor === 'top' ? a.vDist : vpA.h - a.vDist - hA;
          state.left = clamp(lA, 0, Math.max(0, vpA.w - wA));
          state.top = clamp(tA, 0, Math.max(0, vpA.h - hA));
          state.h = a.hAnchor;
          state.hOff = a.hDist;
          state.v = a.vAnchor;
          state.vOff = a.vDist;
          settle();
        }
      } catch (err) {}
      refresh(false);
    }).catch(function () {
      refresh(false);
    });
    setInterval(function () {
      refresh(false);
    }, REFRESH_MS);
    window.addEventListener('whale-refresh', function () {
      refresh(true);
    });
    var turnNoticePoller = createTurnNoticePoller({
      window: window, localStorage: localStorage, fetch: fetch,
      WhaleTurnNotice: WhaleTurnNotice, CustomEvent: CustomEvent,
      getCurrency: function () { return state.currency; },
      setLastTurnNotice: function (notice) { lastTurnNotice = notice; },
      playTaskEndSound: playTaskEndSound,
      getFeedbackVolume: function () { return soundOn ? soundVol : 0; },
      showCostBubble: showCostBubble
    });
    function pollLastTurn() {
      return turnNoticePoller.poll();
    }
    setInterval(pollLastTurn, 1000);
    window.__dshWhaleInit = true;
    window.__dshWhaleInitLoading = false;
    return true;
  }
  if (dshwEnabled) {
    try {
      if (!dshwInit()) throw new Error('Whale widget initialization is already in progress');
      window.__dshWhaleWidget = true;
      window.__dshWhaleWidgetLoading = false;
      window.dispatchEvent(new Event('whale-widget-ready'));
    } catch (err) {
      window.__dshWhaleWidget = false;
      window.__dshWhaleWidgetLoading = false;
      window.__dshWhaleInit = false;
      window.__dshWhaleInitLoading = false;
      window.dispatchEvent(new CustomEvent('whale-widget-failed', { detail: { message: String(err && err.message || err) } }));
      console.error('Whale widget initialization failed', err);
    }
  }
})();
