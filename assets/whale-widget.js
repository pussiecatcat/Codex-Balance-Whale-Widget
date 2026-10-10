import { createBubbleRowsView } from '/features/widget/bubble-rows-view.js';
import { createTurnNoticePoller } from '/features/widget/turn-notice-poller.js';
import { createTaskEndSound } from '/features/widget/task-end-sound.js';
import { createNameMarquee } from '/features/widget/name-marquee.js';
import { createRoleManager } from '/features/widget/role-manager.js';
import { createCharacterInteraction } from '/features/widget/character-interaction.js';
import { createBubbleTemplateHelp } from '/features/widget/bubble-template-help.js';
import { createBubbleContent } from '/features/widget/bubble-content.js';
import { createUsageNavigation } from '/features/widget/usage-navigation.js';
import { createFxControls } from '/features/widget/fx-controls.js';
import { createUsageOverviewView } from '/features/widget/usage-overview-view.js';
import { createUsageModelsView } from '/features/widget/usage-models-view.js';
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
import { loadBubbleEditorDraft, saveBubbleEditorDraft } from '/features/widget/bubble-editor-model.js';
import { snapBounds as calculateSnapBounds, snapZones as calculateSnapZones, artCenterAt, restoreAnchor, clampToViewport, settlePosition } from '/features/widget/anchors.js';
import { createCustomSelectController } from '/features/widget/custom-select.js';
import { bubbleIsImgMod, bubbleRowsOf, bubbleRowsFlat, bubbleRowsCanon } from '/features/widget/bubble-layout.js';
import {
  bubbleDefaultSubscriptionQueue, bubbleLegacySubscriptionDefault,
  bubbleDefaultSecondModules, bubbleDefaultQueue as buildBubbleDefaultQueue,
  bubbleModuleListLabel, bubbleEditEnsureModules,
  bubbleIsChoice, bubbleChoiceOptions, bubbleChoiceWeight,
} from '/features/widget/default-content.js';
// Adapted from MeteorNOX dsh-whale-widget (MIT). Scheduling modules removed; money display uses two decimals.
// ────────────────────────────────────────────────────────────────────────────
//  分段索引  SECTION INDEX
//
//  本文件是单体 IIFE：全部逻辑都在 dshwInit() 的闭包内，共享同一份状态。
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
//    WhaleMoney / WhaleApiModels / WhaleDashboard）。改动前先确认调用方。
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
    var SIZE_URL = '/dsh-whale/size.json';
    var IMG_URL = '/dsh-whale/image.png?v=2';
    var GIF_URL = '/dsh-whale/rua.gif';
    var ROLE_URL = '/dsh-whale/roles.json';
    var assetClient = createAssetClient();
    var assetWarnings = Object.create(null);

    // ==== [素材与媒体工具] ====
    function assetNotice(message) {
      if (window.whaleToast) window.whaleToast(String(message || '素材操作未完成，请重试'));
    }
    function assetWarning(data) {
      if (data && data.warning && !assetWarnings[data.warning]) {
        assetWarnings[data.warning] = true;
        assetNotice(data.warning);
      }
    }
    function requireSaved(data) {
      if (!data || data.ok !== true) throw new Error(data && data.error || '保存未完成，请重试');
      assetWarning(data);
      return data;
    }
    function assetFailure(error) { assetNotice(error && error.message || '保存未完成，请重试'); }
    function mediaDataUrl(blob) {
      return new Promise(function (resolve, reject) {
        var reader = new FileReader();
        reader.onload = function () { resolve(String(reader.result || '')); };
        reader.onerror = function () { reject(new Error('文件读取失败，请重新选择')); };
        reader.readAsDataURL(blob);
      });
    }
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
    var scaleInput = document.createElement('input');
    scaleInput.type = 'range';
    scaleInput.min = String(MIN_SCALE);
    scaleInput.max = String(MAX_SCALE);
    scaleInput.step = '0.1';
    scaleInput.className = 'dshwv-range';
    scaleInput.value = '1.5';
    var scaleNumber = document.createElement('input');
    scaleNumber.type = 'number';
    scaleNumber.min = '1';
    scaleNumber.max = '20';
    scaleNumber.step = '1';
    scaleNumber.className = 'dshwv-number';
    scaleNumber.value = '10';
    scaleInput.addEventListener('pointerdown', function () {
      positioner.style.transition = 'none';
    });
    scaleInput.addEventListener('input', function () {
      setScale(scaleInput.value);
    });
    scaleInput.addEventListener('change', function () {
      positioner.style.transition = '';
      try {
        refreshFlip();
      } catch (err) {}
    });
    scaleNumber.addEventListener('focus', function () {
      positioner.style.transition = 'none';
    });
    scaleNumber.addEventListener('blur', function () {
      positioner.style.transition = '';
    });
    scaleNumber.addEventListener('input', function () {
      var v = Math.round(Number(scaleNumber.value));
      var s = MIN_SCALE + Math.max(0, Math.min(20, v) - 1) * (MAX_SCALE - MIN_SCALE) / 19;
      setScale(s);
    });
    scaleNumber.addEventListener('change', function () {
      var v = Math.round(Number(scaleNumber.value));
      var s = MIN_SCALE + Math.max(0, Math.min(20, v) - 1) * (MAX_SCALE - MIN_SCALE) / 19;
      setScale(s);
      positioner.style.transition = '';
      try {
        refreshFlip();
      } catch (err) {}
    });
    var audioGroupBtn = document.createElement('button');
    audioGroupBtn.type = 'button';
    audioGroupBtn.className = 'dshwv-audiobtn';
    audioGroupBtn.title = '选择音效组';
    var audioGroupBtnLabel = document.createElement('span');
    audioGroupBtnLabel.className = 'dshwv-btnlabel';
    audioGroupBtnLabel.textContent = '小黄鸭';
    audioGroupBtn.appendChild(audioGroupBtnLabel);
    var audioGroupPanel = document.createElement('div');
    audioGroupPanel.className = 'dshwv-audiolist';
    var audioImportBtn = document.createElement('button');
    audioImportBtn.type = 'button';
    audioImportBtn.className = 'dshwv-audioimport';
    audioImportBtn.textContent = '导入';
    audioImportBtn.title = '新建/编辑音效组';
    audioGroupBtn.addEventListener('click', function (e) {
      e.stopPropagation();
      toggleAudioGroupPanel();
    });
    audioImportBtn.addEventListener('click', function (e) {
      e.stopPropagation();
      openAudioGroupEditor(null);
    });
    document.body.appendChild(audioGroupPanel);
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
      usageSet = usageSet || ({});
      usageSet.taskEnd = usageSet.taskEnd || ({
        on: false,
        sel: ''
      });
      usageSet.taskEnd.on = taskEndToggle.checked;
      taskEndSel.disabled = !taskEndToggle.checked;
      if (taskEndDrop) taskEndDrop.refresh();
      saveUsageSettings({
        taskEnd: usageSet.taskEnd
      });
    });
    var taskEndSel = document.createElement('select');
    var taskEndDrop = null;
    taskEndSel.className = 'dshwv-sound';
    taskEndSel.disabled = true;
    taskEndSel.title = '选择任务结束音:音效组(点按整组)/单个音频(与按下/松开同库)';
    taskEndSel.addEventListener('change', function () {
      usageSet = usageSet || ({});
      usageSet.taskEnd = usageSet.taskEnd || ({
        on: false,
        sel: ''
      });
      usageSet.taskEnd.sel = taskEndSel.value;
      saveUsageSettings({
        taskEnd: usageSet.taskEnd
      });
    });

    // ==== [任务结束音效] ====
    var taskEndSound = createTaskEndSound({
      document: document, window: window, Audio: Audio, taskEndSelect: taskEndSel,
      getTaskEndDrop: function () { return taskEndDrop; },
      getUsageSettings: function () { return usageSet; },
      setUsageSettings: function (settings) { usageSet = settings; },
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
        usageSet = usageSet || ({}); usageSet.turnCost = { lines: o.lines };
        setTurnCostOn(o.on); setTurnCostClose(o.ttlSec);
        saveUsageSettings({ turnCost: usageSet.turnCost });
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
    var USAGE_REC_URL = '/dsh-whale/usage-records.json';
    var usageSet = null;
    var USAGE_SET_URL = '/dsh-whale/usage-settings.json';

    // ==== [用量面板与设置] ====
    function loadUsageSettings(cb) {
      try {
        fetch(USAGE_SET_URL, {
          cache: 'no-store'
        }).then(function (r) {
          return r.json();
        }).then(function (d) {
          if (d && d.ok && d.settings) usageSet = d.settings;
          if (cb) cb();
        }).catch(function () {
          if (cb) cb();
        });
      } catch (err) {
        if (cb) cb();
      }
    }
    function saveUsageSettings(patch) {
      try {
        fetch(USAGE_SET_URL, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(patch || ({}))
        }).then(function (r) {
          return r.json();
        }).then(function (d) {
          requireSaved(d);
          if (d && d.ok && d.settings) usageSet = d.settings;
        }).catch(assetFailure);
      } catch (err) { assetFailure(err); }
    }
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
    var usageOverviewView = createUsageOverviewView({
      document: document, WhaleMoney: WhaleMoney,
      getCurrency: function () { return state.currency || 'USD'; },
      getMain: function () { return usageMainEl; }, getPanel: function () { return usagePanel; },
      openRecords: openUsageRecordsWindow
    });
    var whaleCurrencySymbol = usageOverviewView.currencySymbol;
    var usageMoney = usageOverviewView.money;
    var usageMoneyText = usageOverviewView.moneyText;
    var bindUsageMoney = usageOverviewView.bindMoney;
    var uSectionTitle = usageOverviewView.sectionTitle;
    var fillUsagePanel = usageOverviewView.fill;
    function renderUsagePanel() {
      if (usageMainEl && usageNavigation.isOpen() && usageSet !== null) {
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
    function usageAlertBudgetEditor(key, onSave, customConfig, onCancel) {
      try {
        var isCost = key === 'turnCost';
        var isAlert = key === 'alert';
        var isWait = key === 'question' || key === 'approval';
        var cfg = customConfig || (isWait ? ((usageSet || {}).events || {})[key] : (usageSet || ({}))[isCost ? 'turnCost' : isAlert ? 'alert' : 'budget']) || ({});
        var numDef = isAlert ? 50 : 20;
        var numInit = isAlert ? cfg.below != null ? cfg.below : numDef : cfg.amount != null ? cfg.amount : numDef;
        var nativeCurrency = cfg.currency || state.currency || 'USD';
        var nativeDraft = Number(numInit);
        var step = {
          kind: 'custom',
          modules: JSON.parse(JSON.stringify(isCost ? (customConfig && Array.isArray(customConfig.lines) ? customConfig.lines : usageTurnCostLines()) : isWait ? usageWaitLinesOf(cfg, key) : usageRemindLinesOf(cfg, isAlert)))
        };
        var bkEditItems = bubbleEditItems;
        var bkEditorSnap = bubbleEditorSnap;
        var bkItemSnap = bubbleItemSnap;
        var bkEditIdx = bubbleEditItemIdx;
        var bkSide = bubbleEditSide;
        var bkPal = bubblePalEl;
        var bkPv = bubblePvEl;
        var bkPrev = bubblePvPrevEl;
        var bkRenderPv = renderBubblePv;
        var bkQeditEnsure = qeditEnsure;
        var bkModMaskZ = moduleMask ? moduleMask.style.zIndex : '';
        bubbleEditItems = [step];
        bubbleEditItemIdx = 0;
        bubbleEditSide = -1;
        bubbleItemSnap = JSON.parse(JSON.stringify(step));
        bubbleEditorSnap = null;
        var mask = document.createElement('div');
        mask.className = 'dshwv-bubmask';
        mask.style.zIndex = '26000';
        var card = document.createElement('div');
        card.className = 'dshwv-bubcard';
        card.style.maxHeight = '88vh';
        card.style.overflow = 'hidden auto';
        var title = document.createElement('div');
        title.className = 'dshwv-bubtitle';
        title.textContent = '编辑 ' + (isCost ? '每轮消耗' : isWait ? (key === 'approval' ? '授权' : '提问') : isAlert ? '余额预警' : '今日预算') + '提示内容(可拖动下方模块入框)';
        card.appendChild(title);
        var secCond = document.createElement('div');
        secCond.className = 'dshwv-bubsec dshwv-bubsec-first';
        secCond.textContent = isCost ? '显示条件与关闭时间' : isWait ? '' : isAlert ? '触发条件(余额低于该值时提醒)' : '触发条件(今日已观测达到该值时提醒)';
        card.appendChild(secCond);
        var chk = document.createElement('input');
        chk.type = 'checkbox';
        chk.className = 'dshwv-check';
        chk.checked = isCost ? turnCostOn : !!cfg.on;
        var numInp = document.createElement('input');
        numInp.type = 'number';
        numInp.min = '0';
        numInp.step = '0.01';
        numInp.className = 'dshwv-number';
        numInp.style.width = '80px';
        numInp.dataset.moneyInput = key;
        WhaleMoney.bind(numInp, function () { return WhaleMoney.formatNumber(nativeDraft, nativeCurrency); }, function (value) { numInp.value = value; });
        var condBox = document.createElement('div');
        condBox.style.padding = '2px 0';
        condBox.style.display = 'flex';
        condBox.style.flexWrap = 'wrap';
        condBox.style.alignItems = 'center';
        condBox.style.gap = '6px 14px';
        condBox.style.textAlign = 'left';
        condBox.style.fontSize = '12px';
        condBox.style.color = '#203170';
        function segCond() {
          var s = document.createElement('span');
          s.style.display = 'inline-flex';
          s.style.alignItems = 'center';
          s.style.gap = '5px';
          s.style.whiteSpace = 'nowrap';
          return s;
        }
        var gOn = segCond();
        gOn.appendChild(chk);
        gOn.appendChild(qLabel(isCost ? '启用每轮提示' : '启用提醒'));
        condBox.appendChild(gOn);
        var gNum = segCond();
        if (!isCost) {
          gNum.appendChild(qLabel(isAlert ? '余额 ≤ ' : '今日已观测 ≥ '));
          gNum.appendChild(numInp);
          var currencyUnit = qLabel('');
          WhaleMoney.bind(currencyUnit, function () { return ' ' + WhaleMoney.unit() + '时提醒'; });
          gNum.appendChild(currencyUnit);
          condBox.appendChild(gNum);
        }
        var condBrk = document.createElement('span');
        condBrk.style.flex = '1 0 100%';
        condBrk.style.height = '0';
        condBrk.style.margin = '0';
        condBox.appendChild(condBrk);
        var acChk = document.createElement('input');
        acChk.type = 'checkbox';
        acChk.className = 'dshwv-check';
        acChk.checked = isCost ? turnCostCloseMs > 0 : cfg.autoClose !== false;
        var defSec = Number(cfg.ttlSec);
        if (isCost) defSec = Math.max(0, Math.round(turnCostCloseMs / 1000));
        else if (!isFinite(defSec) || defSec <= 0) defSec = 6;
        var secInp = document.createElement('input');
        secInp.type = 'number';
        secInp.min = '0';
        secInp.step = '1';
        secInp.className = 'dshwv-number';
        secInp.style.width = '56px';
        secInp.value = String(defSec);
        var gAc = segCond();
        gAc.appendChild(acChk);
        gAc.appendChild(qLabel('自动关闭'));
        condBox.appendChild(gAc);
        var gSec = segCond();
        gSec.appendChild(secInp);
        var lSec = qLabel('秒(0=不自动关闭)');
        lSec.style.opacity = '.75';
        lSec.style.fontSize = '11px';
        gSec.appendChild(lSec);
        condBox.appendChild(gSec);
        card.appendChild(condBox);
        if (isWait || customConfig && customConfig.layoutOnly) { condBox.style.display = 'none'; secCond.style.display = 'none'; }
        var secPal = document.createElement('div');
        secPal.className = 'dshwv-bubsec dshwv-bubsec-first';
        secPal.textContent = '可选模块(点击或拖入下方内容框)';
        card.appendChild(secPal);
        bubblePalEl = document.createElement('div');
        bubblePalEl.className = 'dshwv-bubpal';
        card.appendChild(bubblePalEl);
        var secPv = document.createElement('div');
        secPv.className = 'dshwv-bubsec';
        secPv.textContent = isCost ? '提示内容(支持 {turn_title} {turn_primary} {turn_detail} {cost} 和 token 占位符)' : isWait ? '提示内容(支持 {session} 表示当前对话；模块可点击或拖入下方内容框)' : '提醒内容(同一行模块并排 ≤6;拖模块到行边缘=并排、上/下=拆行、拖 ⠿ 整行排序;{below} / {amount} 触发时替换)';
        card.appendChild(secPv);
        bubblePvEl = document.createElement('div');
        bubblePvEl.className = 'dshwv-bubpvbox';
        card.appendChild(bubblePvEl);
        bubblePvPrevEl = document.createElement('div');
        bubblePvPrevEl.className = 'dshwv-bubprev';
        card.appendChild(bubblePvPrevEl);
        bubblePvEl.addEventListener('dragover', function (e) {
          try {
            if (e.target && e.target.closest && e.target.closest('.dshwv-pvrow')) return;
            e.preventDefault();
          } catch (err) {}
        });
        bubblePvEl.addEventListener('drop', function (e) {
          try {
            if (e.target && e.target.closest && e.target.closest('.dshwv-pvrow')) return;
            e.preventDefault();
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
        var btns = document.createElement('div');
        btns.className = 'dshwv-bubbtns';
        var editorCompleted = false;
        function cleanup(outcome) {
          try {
            WhaleMoney.clearBindings(mask);
            document.body.removeChild(mask);
            bubbleEditItems = bkEditItems;
            bubbleEditorSnap = bkEditorSnap;
            bubbleItemSnap = bkItemSnap;
            bubbleEditItemIdx = bkEditIdx;
            bubbleEditSide = bkSide;
            bubblePalEl = bkPal;
            bubblePvEl = bkPv;
            bubblePvPrevEl = bkPrev;
            renderBubblePv = bkRenderPv;
            qeditEnsure = bkQeditEnsure;
            if (moduleMask) moduleMask.style.zIndex = bkModMaskZ;
            var zsEl = document.getElementById('dshw-remind-overlay-z');
            if (zsEl) {
              try {
                document.head.removeChild(zsEl);
              } catch (err) {}
            }
            window.__dshwRemindMask = null;
          } catch (err) {}
          if (!editorCompleted) {
            editorCompleted = true;
            if (outcome !== 'saved' && onCancel) onCancel();
          }
        }
        var noBtn = document.createElement('button');
        noBtn.type = 'button';
        noBtn.className = 'dshwv-bubbtn dshwv-bubbtn-no';
        noBtn.textContent = '取消';
        noBtn.addEventListener('click', cleanup);
        btns.appendChild(noBtn);
        var resBtn = document.createElement('button');
        resBtn.type = 'button';
        resBtn.className = 'dshwv-bubbtn dshwv-bubbtn-no';
        resBtn.textContent = '恢复默认';
        resBtn.title = '恢复为默认提醒内容(触发条件保持不变)';
        resBtn.addEventListener('click', function () {
          step.modules = JSON.parse(JSON.stringify(isCost ? usageTurnCostDefaultLines() : isWait ? usageWaitDefaultLines(key) : usageRemindDefaultLines(isAlert)));
          renderBubblePv();
        });
        btns.appendChild(resBtn);
        var okBtn = document.createElement('button');
        okBtn.type = 'button';
        okBtn.className = 'dshwv-bubbtn dshwv-bubbtn-ok';
        okBtn.textContent = '保存';
        okBtn.addEventListener('click', function () {
          if (!isCost && !isWait && !numInp.reportValidity()) return;
          try {
            bubbleRowsCanon(step.modules);
          } catch (err) {}
          var o = {
            on: chk.checked,
            lines: JSON.parse(JSON.stringify(step.modules)),
            autoClose: isCost ? Number(secInp.value) > 0 : acChk.checked,
            ttlSec: isCost && !acChk.checked ? 0 : Math.max(0, Number(secInp.value) || 0)
          };
          if (!isCost && !isWait) { if (isAlert) o.below = nativeDraft; else o.amount = nativeDraft; }
          cleanup('saved');
          if (onSave) onSave(o);
        });
        btns.appendChild(okBtn);
        card.appendChild(btns);
        try {
          if (moduleMask) moduleMask.style.zIndex = '27000';
        } catch (err) {}
        var remindZStyle = document.createElement('style');
        remindZStyle.id = 'dshw-remind-overlay-z';
        remindZStyle.textContent = '.dshwv-confirmmask,.dshwv-cropmask,.dshwv-audiomask,.dshwv-snapmask,.dshwv-usage-mask{z-index:28500!important}';
        document.head.appendChild(remindZStyle);
        var qeditEnsureSuper = bkQeditEnsure;
        qeditEnsure = function () {
          var el = qeditEnsureSuper();
          try {
            if (el) el.style.zIndex = '28000';
          } catch (err) {}
          return el;
        };
        try {
          if (qeditEl) qeditEl.style.zIndex = '28000';
        } catch (err) {}
        var renderPvSuper = bkRenderPv;
        renderBubblePv = function () {
          try {
            renderPvSuper();
          } catch (err) {}
          try {
            var it = bubbleEditTarget();
            var below = isAlert ? nativeDraft : null;
            var amount = isAlert || isCost || isWait ? null : nativeDraft;
            var previewNotice = WhaleTurnNotice.snapshot({ ok: true, amount: 0.08, costState: 'estimated', tokens: 12840, sessionLabel: '当前对话', byModel: { preview: { input_tokens: 10240, output_tokens: 2600, cached_input_tokens: 6000, reasoning_output_tokens: 800 } } }, state.currency);
            if (customConfig && customConfig.previewNotice) previewNotice = customConfig.previewNotice;
            if (it && Array.isArray(it.modules) && bubblePvPrevEl) bubblePreviewInto(bubblePvPrevEl, usageAlertModsResolved(it.modules, below, amount, isCost || customConfig ? previewNotice : null));
          } catch (err) {}
        };
        function editNativeAmount() {
          try {
            var inputValue = Number(numInp.value);
            if (!isFinite(inputValue) || inputValue < 0 || numInp.value === '') throw new Error('请输入有效金额');
            nativeDraft = WhaleMoney.fromDisplay(inputValue, nativeCurrency);
            numInp.setCustomValidity(''); renderBubblePv();
          } catch (err) { numInp.setCustomValidity(err.message); }
        }
        if (!isCost && !isWait) numInp.addEventListener('input', editNativeAmount);
        chk.addEventListener('change', renderBubblePv);
        mask.appendChild(card);
        mask.addEventListener('click', function (e) {
          if (e.target === mask) cleanup();
        });
        window.__dshwRemindMask = mask;
        document.body.appendChild(mask);
        renderBubblePal();
        renderBubblePv();
      } catch (err) {}
    }
    function usageReconcileEditor() {
      fetch('/api/reconcile', { cache: 'no-store' }).then(function (r) { return r.json(); }).then(function (data) {
        if (!data || data.ok === false) throw new Error(data && data.error || '账本读取失败');
        var mask = document.createElement('div'); mask.className = 'dshwv-bubmask'; mask.style.zIndex = '28000';
        var card = document.createElement('div'); card.className = 'dshwv-bubcard'; mask.appendChild(card);
        var title = document.createElement('div'); title.className = 'dshwv-bubtitle'; title.textContent = '校正今日 API 消耗'; card.appendChild(title);
        var tip = document.createElement('p'); tip.className = 'dshwv-usage-hint'; tip.textContent = '期初 + 充值 − 其他支出 − 期末 = 今日消耗。保存时会检查账本版本，避免覆盖另一处修改。'; card.appendChild(tip);
        var fields = {}, current = typeof state.balance === 'number' ? state.balance : 0, today = Number(data.today && data.today.total) || 0;
        [['opening','期初余额',current + today],['credits','今日充值',0],['otherDebits','其他支出',0],['last','期末余额',current]].forEach(function (spec) {
          var row = document.createElement('label'); row.className = 'whale-sound-row'; row.textContent = spec[1];
          var input = document.createElement('input'); input.type = 'number'; input.min = '0'; input.step = '0.00000001'; input.className = 'dshwv-number'; input.value = String(Math.max(0, spec[2]));
          row.appendChild(input); card.appendChild(row); fields[spec[0]] = input;
        });
        var status = document.createElement('p'); status.className = 'whale-sound-error'; status.hidden = true; card.appendChild(status);
        var actions = document.createElement('div'); actions.className = 'dshwv-bubbtns'; card.appendChild(actions);
        function button(label, cls, fn) { var b = document.createElement('button'); b.type = 'button'; b.className = 'dshwv-bubbtn ' + cls; b.textContent = label; b.addEventListener('click', fn); actions.appendChild(b); return b; }
        button('取消', 'dshwv-bubbtn-no', function () { mask.remove(); });
        var save = button('保存校正', 'dshwv-bubbtn-ok', function () {
          var payload = { revision: Number(data.revision || 0), date: usageTodayKeyStr() };
          for (var key in fields) { payload[key] = Number(fields[key].value); if (!isFinite(payload[key]) || payload[key] < 0) { fields[key].focus(); return; } }
          save.disabled = true; status.hidden = true;
          fetch('/api/reconcile', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }).then(function (r) { return r.json().then(function (body) { return { ok: r.ok, body: body }; }); }).then(function (result) {
            if (!result.ok || result.body.ok === false) throw new Error(result.body.error || '余额校正失败');
            mask.remove(); refreshUsageMain(); refresh(true);
          }).catch(function (error) { status.textContent = error.message || '余额校正失败'; status.hidden = false; save.disabled = false; });
        });
        mask.addEventListener('click', function (event) { if (event.target === mask) mask.remove(); }); document.body.appendChild(mask);
      }).catch(function (error) { assetFailure(error); });
    }
    function refreshUsageMain() {
      if (!usageMainEl) return;
      usageMainEl.innerHTML = '';
      var body = document.createElement('div');
      body.textContent = '加载中…';
      usageMainEl.appendChild(body);
      fetch(USAGE_REC_URL, {
        cache: 'no-store'
      }).then(function (r) {
        return r.json();
      }).then(function (d) {
        if (d && d.ok && d.settings) usageSet = d.settings;
        WhaleMoney.refreshBindings(usagePanel);
        fillUsagePanel(d);
        if (d && d.ok && d.today && isFinite(Number(d.today.total))) {
          var recTotal = Number(d.today.total);
          if (state.todayUsage === null || recTotal >= state.todayUsage) {
            state.todayUsage = recTotal;

          }
        }
      }).catch(function () {
        usageMainEl.textContent = '记录加载失败';
      });
    }
    window.addEventListener('whale-api-model-changed', function () {
      if (usageNavigation.isOpen() && usageModelsView.hasList()) renderUsageModels(true);
    });
    window.addEventListener('whale-open-balance-reconcile', function () {
      usageReconcileEditor();
    });
    var usageMoreMask = document.createElement('div');
    usageMoreMask.className = 'dshwv-usage-mask';
    usageMoreMask.style.display = 'none';
    var usageMoreCard = document.createElement('div');
    usageMoreCard.className = 'dshwv-usage-card';
    usageMoreMask.appendChild(usageMoreCard);
    usageMoreMask.addEventListener('click', function (e) {
      if (e.target === usageMoreMask) closeUsageRecordsWindow();
    });
    document.body.appendChild(usageMoreMask);
    function openUsageRecordsWindow() {
      usageMoreCard.innerHTML = '<div style="padding:10px;color:#203170">加载中…</div>';
      usageMoreMask.style.display = 'flex';
      fetch(USAGE_REC_URL, {
        cache: 'no-store'
      }).then(function (r) {
        return r.json();
      }).then(function (d) {
        usageRecordsView.fill(d);
      }).catch(function () {
        usageMoreCard.innerHTML = '<div style="padding:10px;color:#203170">加载失败</div>';
      });
    }
    function closeUsageRecordsWindow() {
      usageMoreMask.style.display = 'none';
    }
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
      whaleCurrencySymbol: whaleCurrencySymbol, getUsageSet: function () { return usageSet; },
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
      document: document, card: usageMoreCard, close: closeUsageRecordsWindow,
      bindUsageMoney: bindUsageMoney, usageMoney: usageMoney, usageMoneyText: usageMoneyText,
      usageAggModels: usageAggModels, usageRatioRows: usageRatioRows,
      usageDrawBarChart: usageDrawBarChart, usageTodayKeyStr: usageTodayKeyStr,
      WhaleMoney: WhaleMoney, getCurrency: function () { return state.currency || 'USD'; }
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
    var bubbleEditItems = [];
    var bubbleMoreListEl = null;
    var bubbleFirstChipEl = null;
    function bubbleDefaultQueue() {
      return buildBubbleDefaultQueue(window.WhaleAccountView?.mode === 'subscription');
    }
    // ==== [气泡编辑器] ====
    var bubbleEditorView = createBubbleEditorView({
      document: document,
      getItems: function () { return bubbleEditItems; },
      getFirstChip: function () { return bubbleFirstChipEl; },
      getMoreList: function () { return bubbleMoreListEl; },
      openItem: openBubbleItem, confirm: showConfirm
    });
    function renderBubbleFirst() { bubbleEditorView.renderFirst(); }
    function renderBubbleMore() { bubbleEditorView.renderMore(); }
    function bubbleDropToEnd() { bubbleEditorView.dropToEnd(); }
    function renderBubbleEditor() {
      if (!bubbleEditItems.length) bubbleEditItems = [{ kind: 'normal' }];
      renderBubbleFirst();
      renderBubbleMore();
    }
    function bubbleAddMore() { bubbleEditorView.add(); }
    var bubbleEditorSnap = null;
    function bubbleEditorDirty() {
      try {
        if (bubbleEditorSnap === null) return true;
        return bubbleEditorSnap !== JSON.stringify([bubbleEditItems, bubbleLib]);
      } catch (err) {
        return true;
      }
    }
    function openBubbleEditor() {
      try {
        if (!bubbleCfgLoaded) {
          loadBubbleCfg().then(function (ok) {
            if (ok) openBubbleEditor(); else assetFailure(new Error('自定义泡泡配置读取失败'));
          });
          return;
        }
        closeRolePanel();
        closeAudioGroupPanel();
        var draft = loadBubbleEditorDraft(bubbleCfg, window.WhaleAccountView?.mode === 'subscription');
        bubbleLib = draft.library;
        bubbleEditItems = draft.items;
        bubbleEditorSnap = JSON.stringify([bubbleEditItems, bubbleLib]);
        renderBubbleEditor();
        bubbleMask.style.display = 'flex';
      } catch (err) {}
    }
    function closeBubbleEditor() {
      bubbleMask.style.display = 'none';
      bubbleEditorSnap = null;
    }
    function bubbleEditorReset() {
      showConfirm(window.WhaleAccountView?.mode === 'subscription' ? '恢复为默认 Codex 额度气泡?' : '恢复为默认序列(首次=余额内容,再次=随机语句)?', function () {
        bubbleEditItems = bubbleDefaultQueue();
        renderBubbleEditor();
      });
    }
    function bubbleEditorSave() {
      try {
        var doSave = function () {
          var subscriptionMode = window.WhaleAccountView?.mode === 'subscription';
          saveBubbleCfg(saveBubbleEditorDraft(bubbleEditItems, bubbleLib, bubbleCfg, subscriptionMode), function (ok) {
            if (ok !== false) closeBubbleEditor();
          });
        };
        if (bubbleEditorDirty()) showConfirm('保存当前点击序列?(未逐泡编辑过的行将按默认内容保存,保存后即生效)', doSave); else doSave();
      } catch (err) {}
    }
    var bubbleItemMask = null;
    var bubbleEditItemIdx = -1;
    var bubbleEditSide = -1;
    var bubbleItemSnap = null;
    var bubbleItemTitleEl = null;
    var bubbleItemSideEl = null;
    var bubblePalEl = null;
    var bubblePvEl = null;
    function bubbleEditTarget() {
      var step = bubbleEditItems[bubbleEditItemIdx];
      if (!step) return null;
      if (bubbleIsChoice(step)) {
        var o = bubbleChoiceOptions(step)[bubbleEditSide === 0 || bubbleEditSide === 1 ? bubbleEditSide : 0];
        return o ? o.item : null;
      }
      return step;
    }
    function bubbleEditStepLabel(step, idx) {
      var base = '第' + (idx + 1) + '次点击';
      if (bubbleIsChoice(step)) return base + ' · ' + (bubbleEditSide === 1 ? 'B泡' : 'A泡');
      return base;
    }
    function openBubbleItem(idx, side) {
      try {
        whaleZClean();
        var step = bubbleEditItems[idx];
        if (!step) return;
        bubbleEditItemIdx = idx;
        if (!bubbleIsChoice(step)) {
          bubbleEditSide = -1;
        } else {
          var want = side === 0 || side === 1 ? side : 0;
          if (!bubbleChoiceOptions(step)[want]) want = 0;
          bubbleEditSide = want;
        }
        bubbleItemSnap = JSON.parse(JSON.stringify(step));
        var it = bubbleEditTarget();
        if (!it) return;
        bubbleEditEnsureModules(it);
        bubbleRowsCanon(it.modules);
        bubbleItemTitleEl.textContent = '编辑 ' + bubbleEditStepLabel(step, idx) + '内容(可拖动下方模块入框)';
        renderBubbleItemSideSwitch(step);
        bubbleItemMask.style.display = 'flex';
        renderBubblePal();
        renderBubblePv();
      } catch (err) {}
    }
    function renderBubbleItemSideSwitch(step) {
      if (!bubbleItemSideEl) return;
      bubbleItemSideEl.innerHTML = '';
      if (!bubbleIsChoice(step)) {
        bubbleItemSideEl.style.display = 'none';
        return;
      }
      bubbleItemSideEl.style.display = '';
      var opts = bubbleChoiceOptions(step);
      for (var s = 0; s < opts.length && s < 2; s++) {
        (function (si) {
          var b = document.createElement('button');
          b.type = 'button';
          b.className = 'dshwv-bubchip dshwv-bubchip-btn' + (si === bubbleEditSide ? ' dshwv-bubchip-cur' : '');
          b.textContent = (si === 0 ? 'A' : 'B') + ' 泡(权重 ' + bubbleChoiceWeight(opts[si]) + ')';
          b.title = '切换到编辑 ' + (si === 0 ? 'A' : 'B') + ' 泡';
          b.addEventListener('click', function (e) {
            e.stopPropagation();
            openBubbleItem(bubbleEditItemIdx, si);
          });
          bubbleItemSideEl.appendChild(b);
        })(s);
      }
    }
    function closeBubbleItem() {
      bubbleItemMask.style.display = 'none';
      bubbleEditItemIdx = -1;
      bubbleEditSide = -1;
      if (bubbleItemSideEl) bubbleItemSideEl.innerHTML = '';
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
      document: document, window: window, qeditClose: qeditClose, qeditEnsure: qeditEnsure,
      qRow: qRow, qLabel: qLabel, bubbleFontEditRow: bubbleFontEditRow,
      qColorSelectBuild: qColorSelectBuild, renderBubblePv: renderBubblePv,
      qeditPlace: qeditPlace, getPreviewElement: function () { return bubblePvPrevEl; },
      bubbleTplHelpToggle: function (m, anchor) { return bubbleTplHelpToggle(m, anchor); }
    });
    var openQuickTextEditor = bubbleQuickEditors.openText;
    var openQuickModuleEditor = bubbleQuickEditors.openModule;
    var openQuickSentenceEditor = bubbleQuickEditors.openSentence;
    var bubblePalette = createBubblePalette({
      document: document, getPaletteElement: function () { return bubblePalEl; },
      getLibrary: function () { return bubbleLib; },
      setDragKey: function (key) { bubbleDragKey = key; },
      bubbleModuleAdd: bubbleModuleAdd, bubbleModuleNew: bubbleModuleNew,
      bubblePickImageToAdd: bubblePickImageToAdd, bubblePaletteModule: bubblePaletteModule,
      bubbleCloneModule: bubbleCloneModule, bubbleDefaultSecondModules: bubbleDefaultSecondModules,
      showConfirm: showConfirm, bubbleLibDel: bubbleLibDel
    });
    var renderBubblePal = bubblePalette.render;
    function bubbleLibById(id) {
      for (var i = 0; i < bubbleLib.length; i++) if (bubbleLib[i].id === id) return bubbleLib[i];
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
        if (m && (m.type === 'balance' || m.type === 'today' || m.type === 'quota' || m.type === 'turn')) {
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
        var lb = bubbleLibById(key.slice(4));
        return lb ? bubbleCloneModule(lb.module) : null;
      }
      return null;
    }

    // ==== [气泡预览与样式] ====
    function renderBubblePv() {
      bubblePvEl.innerHTML = '';
      var it = bubbleEditTarget();
      if (!it) return;
      var rows = bubbleRowsOf(it.modules || []);
      for (var r = 0; r < rows.length; r++) {
        (function (ri, rowMods) {
          var isImgRow = bubbleIsImgMod(rowMods[0]);
          var bar = document.createElement('div');
          bar.className = 'dshwv-pvrow dshwv-pvrowline';
          bar.title = isImgRow ? '图片独占一行:拖 ⠿ 可整行排序' : '同一行模块并排(≤6):拖 ⠿ 整行排序;拖模块块到某行左/右边缘=并入该行,上/下=另起一行';
          var grip = document.createElement('span');
          grip.className = 'dshwv-pvdrag';
          grip.textContent = '⠿';
          grip.title = '按住拖动整行排序';
          grip.draggable = true;
          grip.addEventListener('dragstart', function (e) {
            e.stopPropagation();
            try {
              e.dataTransfer.setData('text/plain', 'prow:' + ri);
            } catch (err) {}
            bubbleRowDragIdx = ri;
            bubbleModDrag = null;
            bubblePvZone = '';
          });
          grip.addEventListener('dragend', function () {
            bubbleRowDragIdx = null;
            bubblePvZone = '';
          });
          bar.appendChild(grip);
          for (var mi = 0; mi < rowMods.length; mi++) {
            (function (m, mIdx) {
              var blk = document.createElement('div');
              blk.className = 'dshwv-pvmod' + (bubbleIsImgMod(m) ? ' dshwv-pvimg' : '');
              blk.draggable = true;
              blk.title = isImgRow ? '图片/动图(独占一行,可整行排序)' : '拖动到某行:左/右边缘=并入该行首/尾,上/下=另起一行';
              blk.addEventListener('dragstart', function (e) {
                e.stopPropagation();
                try {
                  e.dataTransfer.setData('text/plain', 'mod:' + ri + ':' + mIdx);
                } catch (err) {}
                bubbleRowDragIdx = null;
                bubbleModDrag = {
                  ri: ri,
                  mi: mIdx
                };
                bubblePvZone = '';
              });
              blk.addEventListener('dragend', function () {
                bubbleModDrag = null;
                bubblePvZone = '';
              });
              var lab = document.createElement('span');
              lab.className = 'dshwv-pvlab';
              lab.textContent = bubbleModuleListLabel(m);
              lab.title = '点击编辑该模块(内容/样式)';
              lab.addEventListener('click', function (e) {
                e.stopPropagation();
                bubbleModuleEdit(m);
              });
              blk.appendChild(lab);
              var ed = document.createElement('button');
              ed.type = 'button';
              ed.className = 'dshwv-bubmini';
              ed.textContent = '✎';
              ed.title = '编辑该模块(内容/样式)';
              ed.addEventListener('click', function (e) {
                e.stopPropagation();
                bubbleModuleEdit(m);
              });
              blk.appendChild(ed);
              var del = document.createElement('button');
              del.type = 'button';
              del.className = 'dshwv-bubmini';
              del.textContent = '✕';
              del.title = '删除该模块';
              del.addEventListener('click', function (e) {
                e.stopPropagation();
                bubblePvDelBlock(ri, mIdx);
              });
              blk.appendChild(del);
              bar.appendChild(blk);
            })(rowMods[mi], mi);
          }
          if (!isImgRow) {
            var add = document.createElement('button');
            add.type = 'button';
            add.className = 'dshwv-pvadd';
            add.textContent = '+';
            add.title = '把模块加入同一行(默认文本,并排显示;其余类型可把上方色板拖进本行)';
            add.addEventListener('click', function (e) {
              e.stopPropagation();
              bubblePvAddToRow(ri);
            });
            bar.appendChild(add);
          }
          function highlight(zone) {
            bubblePvZone = zone;
            bar.style.boxShadow = '';
            bar.style.outline = '';
            if (zone === 'join') bar.style.outline = '2px solid rgba(32,49,112,.55)'; else {
              var sh = bubbleDropShadow(zone);
              if (sh) bar.style.boxShadow = sh;
            }
          }
          bar.addEventListener('dragover', function (e) {
            try {
              var isMod = !!bubbleModDrag;
              var isRow = bubbleRowDragIdx !== null && bubbleRowDragIdx !== undefined;
              var isPal = !isMod && !isRow && !!bubbleDragKey;
              if (!isMod && !isRow && !isPal) return;
              e.preventDefault();
              e.dataTransfer.dropEffect = 'move';
              var rc = bar.getBoundingClientRect();
              if (!rc.width) return;
              if (isPal) {
                highlight('join');
                return;
              }
              var x = e.clientX - rc.left;
              if (isMod && x < rc.width * 0.2) {
                highlight('pairL');
                return;
              }
              if (isMod && x > rc.width * 0.8) {
                highlight('pairR');
                return;
              }
              highlight(e.clientY - rc.top < rc.height / 2 ? 'before' : 'after');
            } catch (err) {}
          });
          bar.addEventListener('dragleave', function () {
            bubblePvZone = '';
            bar.style.boxShadow = '';
            bar.style.outline = '';
          });
          bar.addEventListener('drop', function (e) {
            try {
              e.preventDefault();
              e.stopPropagation();
              var zone = bubblePvZone;
              bubblePvZone = '';
              bar.style.boxShadow = '';
              bar.style.outline = '';
              if (bubbleRowDragIdx !== null && bubbleRowDragIdx !== undefined) {
                var fromRow = bubbleRowDragIdx;
                bubbleRowDragIdx = null;
                if (fromRow !== ri) bubblePvMoveRow(fromRow, ri, zone);
                return;
              }
              if (bubbleModDrag) {
                var md = bubbleModDrag;
                bubbleModDrag = null;
                if (zone === 'join') zone = 'after';
                bubblePvDropBlock(md.ri, md.mi, ri, zone);
                return;
              }
              if (bubbleDragKey) {
                var key = bubbleDragKey;
                bubbleDragKey = null;
                bubblePvPaletteToRow(key, ri);
                return;
              }
            } catch (err) {}
          });
          bubblePvEl.appendChild(bar);
        })(r, rows[r]);
      }
      try {
        var rw = root && (root.offsetWidth || root.getBoundingClientRect().width) || 280;
        bubblePreviewInto(bubblePvPrevEl, it.modules || [], Math.min(rw, 408));
      } catch (err) {}
    }
    var bubbleRowDragIdx = null;
    function bubbleItemDiscard() {
      try {
        var idx = bubbleEditItemIdx;
        var snap = bubbleItemSnap;
        bubbleItemSnap = null;
        if (idx >= 0 && idx < bubbleEditItems.length && snap) bubbleEditItems[idx] = snap;
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
        bubbleItemSnap = null;
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
    var bubbleSecFirst = document.createElement('div');
    bubbleSecFirst.className = 'dshwv-bubsec dshwv-bubsec-first';
    bubbleSecFirst.textContent = '首次点击桌宠弹出内容';
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
    bubbleSecMore.textContent = '点击泡泡后的内容';
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
    var bubbleInteractionHint = document.createElement('div');
    bubbleInteractionHint.className = 'dshwv-bubsec';
    bubbleInteractionHint.textContent = '点桌宠只互动；点泡泡切换，最后一泡再点收起';
    bubbleInteractionHint.title = '第一次点桌宠打开泡泡。泡泡打开后可继续按压桌宠，当前内容不会切换或消失。';
    bubbleCard.appendChild(bubbleInteractionHint);
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
    bubblePalEl = document.createElement('div');
    bubblePalEl.className = 'dshwv-bubpal';
    bubbleItemCard.appendChild(bubblePalEl);
    var bubbleSecPv = document.createElement('div');
    bubbleSecPv.className = 'dshwv-bubsec';
    bubbleSecPv.textContent = '泡泡内容预览(同一行模块并排显示,≤6 个;拖模块块到行左/右边缘=并入该行、上/下=另起一行;拖 ⠿ 整行排序)';
    bubbleItemCard.appendChild(bubbleSecPv);
    bubblePvEl = document.createElement('div');
    bubblePvEl.className = 'dshwv-bubpvbox';
    bubblePvEl.addEventListener('dragover', function (e) {
      try {
        if (e.target && e.target.closest && e.target.closest('.dshwv-pvrow')) return;
        e.preventDefault();
      } catch (err) {}
    });
    bubblePvEl.addEventListener('drop', function (e) {
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
    bubbleItemCard.appendChild(bubblePvEl);
    var bubblePvPrevEl = document.createElement('div');
    bubblePvPrevEl.className = 'dshwv-bubprev';
    bubbleItemCard.appendChild(bubblePvPrevEl);
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
    var moduleColorEl = null;
    var moduleSizeEl = null;
    var moduleImgSelect = null;
    var moduleImgDrop = null;
    var moduleImgPreviewEl = null;
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
      var cand = [bubbleMask, bubbleItemMask, moduleMask, usageMoreMask, qeditEl, window.__dshwRemindMask];
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
      return '文本模块';
    }

    // ==== [模块编辑器] ====
    function renderModuleEditor() {
      var m = moduleEditRef;
      if (moduleEditNew && m.type === 'text' && m.bold === undefined) m.bold = true;
      moduleColorEl = null;
      moduleSizeEl = null;
      moduleBodyEl.innerHTML = '';
      moduleTitleEl.textContent = (moduleEditNew ? '新增模块: ' : '编辑模块: ') + moduleTypeName(m.type, m);
      function moduleTplRow() {
        var row = document.createElement('div');
        row.className = 'dshwv-audiorow';
        var lab = document.createElement('span');
        lab.textContent = '内容';
        lab.style.flex = '0 0 auto';
        row.appendChild(lab);
        var inp = document.createElement('input');
        inp.type = 'text';
        inp.style.flex = '1';
        inp.style.minWidth = '0';
        inp.style.boxSizing = 'border-box';
        inp.style.border = '1px solid rgba(32,49,112,.4)';
        inp.style.borderRadius = '6px';
        inp.style.padding = '3px 6px';
        inp.style.fontSize = '12px';
        inp.style.color = '#203170';
        inp.style.background = '#fff';
        inp.value = m.tpl || '';
        function hintOf() {
          if (m.type === 'balance') return '例: {balance_api}';
          if (m.type === 'today') return '例: 今日已观测 {expense_api}';
          if (m.type === 'quota') return '例: 剩余 {quota_left_round} · {quota_reset_short}';
          if (m.type === 'turn') return '例: 上轮使用 {turn_tokens} tokens';
          return '例: 当前 {status}';
        }
        var hp = hintOf();
        inp.placeholder = hp;
        inp.title = '输入内容;右侧 ? 查看可用占位符';
        inp.addEventListener('input', function () {
          m.tpl = inp.value;
        });
        row.appendChild(inp);
        var qb = document.createElement('button');
        qb.type = 'button';
        qb.className = 'dshwv-tplq';
        qb.textContent = '?';
        qb.title = '可用占位符用法';
        qb.addEventListener('click', function (e) {
          e.stopPropagation();
          bubbleTplHelpToggle(m, qb);
        });
        row.appendChild(qb);
        moduleBodyEl.appendChild(row);
      }
      if (moduleEditNew) {
        var tr = document.createElement('div');
        tr.className = 'dshwv-audiorow';
        var tl = document.createElement('span');
        tl.textContent = '类型';
        tr.appendChild(tl);
        var tsel = document.createElement('select');
        tsel.className = 'dshwv-sound';
        var topts = [['text', '文本'], ['random', '随机语句模块'], ['image', '图片/动图'], ['randimg', '随机图片']];
        for (var ti2 = 0; ti2 < topts.length; ti2++) {
          var o2 = document.createElement('option');
          o2.value = topts[ti2][0];
          o2.textContent = topts[ti2][1];
          tsel.appendChild(o2);
        }
        tsel.value = m.type;
        tsel.addEventListener('change', function () {
          m.type = tsel.value;
          if (m.type === 'random' && !Array.isArray(m.lines)) m.lines = [];
          if (m.type === 'random' && m.bold === undefined) m.bold = true;
          if (m.type === 'text' && m.bold === undefined) m.bold = true;
          if (m.type === 'image' && !m.imgId) m.imgId = '';
          if (m.type === 'randimg' && !Array.isArray(m.imgs)) m.imgs = [];
          renderModuleEditor();
        });
        tr.appendChild(tsel);
        dshwCustSel(tsel);
        moduleBodyEl.appendChild(tr);
      }
      if (bubbleLib.length) {
        var lr2 = document.createElement('div');
        lr2.className = 'dshwv-bubsec';
        lr2.textContent = '从模块库载入';
        moduleBodyEl.appendChild(lr2);
        for (var li3 = 0; li3 < bubbleLib.length; li3++) {
          (function (lb) {
            var lrow = document.createElement('div');
            lrow.className = 'dshwv-bublibrow';
            var lbtn = document.createElement('button');
            lbtn.type = 'button';
            lbtn.className = 'dshwv-bubnewbtn';
            lbtn.textContent = lb.name;
            lbtn.title = '将该模块配置载入当前编辑';
            lbtn.addEventListener('click', function () {
              var c = bubbleCloneModule(lb.module);
              var oldKeys = Object.keys(m);
              for (var kk = 0; kk < oldKeys.length; kk++) {
                try {
                  delete m[oldKeys[kk]];
                } catch (err) {}
              }
              var nk = Object.keys(c);
              for (var j2 = 0; j2 < nk.length; j2++) m[nk[j2]] = c[nk[j2]];
              moduleColorEl = null;
              moduleSizeEl = null;
              renderModuleEditor();
            });
            lrow.appendChild(lbtn);
            var ldel = document.createElement('button');
            ldel.type = 'button';
            ldel.className = 'dshwv-bubmini';
            ldel.textContent = '✕';
            ldel.title = '从模块库删除';
            ldel.addEventListener('click', function () {
              showConfirm('从模块库删除「' + lb.name + '」?', function () {
                bubbleLibDel(lb.id);
                renderModuleEditor();
                if (bubblePalEl) renderBubblePal();
              });
            });
            lrow.appendChild(ldel);
            moduleBodyEl.appendChild(lrow);
          })(bubbleLib[li3]);
        }
      }
      if (m.type === 'text') {
        var ti = document.createElement('input');
        ti.type = 'text';
        ti.className = 'dshwv-cropname';
        ti.maxLength = 60;
        ti.value = m.text || '';
        ti.placeholder = '文本内容';
        ti.addEventListener('input', function () {
          m.text = ti.value || ' ';
        });
        moduleBodyEl.appendChild(ti);
      } else if (m.type === 'random') {
        var hint = document.createElement('div');
        hint.className = 'dshwv-linehead';
        var hw = document.createElement('span');
        hw.className = 'dshwv-lhw';
        hw.textContent = '权重';
        hint.appendChild(hw);
        var hc = document.createElement('span');
        hc.className = 'dshwv-lhc';
        hc.textContent = '内容';
        hint.appendChild(hc);
        var ho = document.createElement('span');
        ho.className = 'dshwv-lho';
        ho.textContent = '操作';
        hint.appendChild(ho);
        moduleBodyEl.appendChild(hint);
        if (!Array.isArray(m.lines)) m.lines = [];
        var listEl = document.createElement('div');
        listEl.className = 'dshwv-listbox';
        listEl.style.maxHeight = '240px';
        listEl.style.overflowY = 'auto';
        listEl.style.paddingRight = '2px';
        moduleBodyEl.appendChild(listEl);
        function renderLines() {
          listEl.innerHTML = '';
          for (var i = 0; i < m.lines.length; i++) {
            (function (idx) {
              var l = m.lines[idx];
              if (!l) return;
              var wrap = document.createElement('div');
              wrap.className = 'dshwv-linerow';
              var lr = document.createElement('div');
              lr.className = 'dshwv-audiorow';
              var wt = document.createElement('input');
              wt.type = 'number';
              wt.min = '1';
              wt.max = '99';
              wt.className = 'dshwv-linew';
              wt.value = String(l.w || 1);
              wt.title = '权重';
              wt.addEventListener('input', function () {
                l.w = Math.max(1, Math.round(Number(wt.value) || 1));
              });
              lr.appendChild(wt);
              var tx = document.createElement('input');
              tx.type = 'text';
              tx.className = 'dshwv-linetx';
              tx.value = l.t;
              tx.placeholder = '句子';
              tx.addEventListener('input', function () {
                l.t = tx.value || ' ';
              });
              lr.appendChild(tx);
              var ed = document.createElement('button');
              ed.type = 'button';
              ed.className = 'dshwv-bubmini';
              ed.textContent = '✎';
              ed.title = '该句悬浮样式编辑(句子/字号/字体/颜色/字形)';
              ed.addEventListener('click', function (e) {
                e.stopPropagation();
                openQuickSentenceEditor(l, m, tx, ed);
              });
              lr.appendChild(ed);
              var cp = document.createElement('button');
              cp.type = 'button';
              cp.className = 'dshwv-bubmini';
              cp.textContent = '⧉';
              cp.title = '复制该行(含样式)';
              cp.addEventListener('click', function () {
                m.lines.splice(idx + 1, 0, JSON.parse(JSON.stringify(l)));
                renderLines();
              });
              lr.appendChild(cp);
              var del = document.createElement('button');
              del.type = 'button';
              del.className = 'dshwv-linedel';
              del.textContent = '✕';
              del.title = '删除该句';
              del.addEventListener('click', function () {
                m.lines.splice(idx, 1);
                renderLines();
              });
              lr.appendChild(del);
              wrap.appendChild(lr);
              listEl.appendChild(wrap);
            })(i);
          }
        }
        renderLines();
        var addL = document.createElement('button');
        addL.type = 'button';
        addL.className = 'dshwv-addline';
        addL.textContent = '+ 添加语句';
        addL.addEventListener('click', function () {
          m.lines.push({
            t: '新句子',
            w: 1
          });
          renderLines();
        });
        moduleBodyEl.appendChild(addL);
      } else if (m.type === 'randimg') {
        if (!Array.isArray(m.imgs)) m.imgs = [];
        var randomImageHint = document.createElement('div'); randomImageHint.className = 'dshwv-bubhint';
        randomImageHint.textContent = '每次打开泡泡时按权重随机抽取一张图片。图片可先在资源管理中导入。'; moduleBodyEl.appendChild(randomImageHint);
        var randomImageList = document.createElement('div'); randomImageList.className = 'dshwv-listbox';
        randomImageList.style.maxHeight = '230px'; randomImageList.style.overflowY = 'auto'; moduleBodyEl.appendChild(randomImageList);
        function renderRandomImages() {
          randomImageList.innerHTML = '';
          for (var ri = 0; ri < m.imgs.length; ri++) (function (index) {
            var item = m.imgs[index] || (m.imgs[index] = { imgId: '', w: 1 });
            var row = document.createElement('div'); row.className = 'dshwv-audiorow';
            var weight = document.createElement('input'); weight.type = 'number'; weight.min = '1'; weight.max = '99';
            weight.className = 'dshwv-linew'; weight.value = String(item.w || 1); weight.title = '抽取权重';
            weight.addEventListener('input', function () { item.w = Math.max(1, Math.round(Number(weight.value) || 1)); }); row.appendChild(weight);
            var select = document.createElement('select'); select.className = 'dshwv-sound'; select.style.minWidth = '0';
            var empty = document.createElement('option'); empty.value = ''; empty.textContent = '— 选择图片 —'; select.appendChild(empty);
            for (var bi = 0; bi < bubbleImgList.length; bi++) { var option = document.createElement('option'); option.value = bubbleImgList[bi].id; option.textContent = bubbleImgList[bi].name; select.appendChild(option); }
            select.value = item.imgId || ''; select.addEventListener('change', function () { item.imgId = select.value; }); row.appendChild(select); dshwCustSel(select);
            var del = document.createElement('button'); del.type = 'button'; del.className = 'dshwv-linedel'; del.textContent = '✕'; del.title = '移除这张图片';
            del.addEventListener('click', function () { m.imgs.splice(index, 1); renderRandomImages(); }); row.appendChild(del);
            randomImageList.appendChild(row);
          })(ri);
        }
        var addRandomImage = document.createElement('button'); addRandomImage.type = 'button'; addRandomImage.className = 'dshwv-addline'; addRandomImage.textContent = '+ 添加图片';
        addRandomImage.addEventListener('click', function () { m.imgs.push({ imgId: bubbleImgList[0] && bubbleImgList[0].id || '', w: 1 }); renderRandomImages(); }); moduleBodyEl.appendChild(addRandomImage);
        var randomScaleRow = document.createElement('div'); randomScaleRow.className = 'dshwv-audiorow';
        var randomScaleLabel = document.createElement('span'); randomScaleLabel.textContent = '显示大小'; randomScaleRow.appendChild(randomScaleLabel);
        var randomScale = document.createElement('input'); randomScale.type = 'range'; randomScale.min = '10'; randomScale.max = '100'; randomScale.step = '5'; randomScale.className = 'dshwv-cropzoom';
        randomScale.value = String(Math.round(Math.max(.1, Math.min(1, Number(m.imgScale) || 1)) * 100)); randomScaleRow.appendChild(randomScale);
        var randomScaleValue = document.createElement('span'); randomScaleValue.className = 'dshwv-volpct'; randomScaleValue.textContent = randomScale.value + '%'; randomScaleRow.appendChild(randomScaleValue);
        randomScale.addEventListener('input', function () { m.imgScale = Number(randomScale.value) / 100; randomScaleValue.textContent = randomScale.value + '%'; }); moduleBodyEl.appendChild(randomScaleRow);
        if (!bubbleImgList.length) loadBubbleImgs(renderRandomImages); else renderRandomImages();
      } else if (m.type === 'image') {
        moduleImgSelect = document.createElement('select');
        moduleImgSelect.className = 'dshwv-sound';
        moduleBodyEl.appendChild(moduleImgSelect);
        moduleImgDrop = dshwCustSel(moduleImgSelect);
        moduleImgPreviewEl = document.createElement('img');
        moduleImgPreviewEl.className = 'dshwv-bubimgprev';
        moduleImgPreviewEl.alt = '';
        moduleBodyEl.appendChild(moduleImgPreviewEl);
        function fillImgSel() {
          moduleImgSelect.innerHTML = '';
          var opt0 = document.createElement('option');
          opt0.value = '';
          opt0.textContent = '— 选择泡泡图库图片 —';
          moduleImgSelect.appendChild(opt0);
          for (var i = 0; i < bubbleImgList.length; i++) {
            var o = document.createElement('option');
            o.value = bubbleImgList[i].id;
            o.textContent = bubbleImgList[i].name;
            moduleImgSelect.appendChild(o);
          }
          if (m.imgId) moduleImgSelect.value = m.imgId;
          moduleImgSelect.dispatchEvent(new Event('change'));
          if (moduleImgDrop) moduleImgDrop.refresh();
        }
        moduleImgSelect.addEventListener('change', function () {
          m.imgId = moduleImgSelect.value;
          if (m.imgId) {
            moduleImgPreviewEl.src = '/dsh-whale/bubble-img.png?id=' + encodeURIComponent(m.imgId);
            moduleImgPreviewEl.style.display = 'block';
          } else moduleImgPreviewEl.style.display = 'none';
        });
        var fileInput = document.createElement('input');
        fileInput.type = 'file';
        fileInput.accept = 'image/png,image/gif';
        fileInput.style.display = 'none';
        var upBtn = document.createElement('button');
        upBtn.type = 'button';
        upBtn.className = 'dshwv-snapbtn dshwv-snapbtn-no';
        upBtn.textContent = '上传图片(png/gif)';
        upBtn.addEventListener('click', function () {
          fileInput.click();
        });
        fileInput.addEventListener('change', function () {
          var f = fileInput.files && fileInput.files[0];
          if (!f) return;
          bubbleUploadImg(f, function (ok) {
            if (ok) fillImgSel();
            fileInput.value = '';
          });
        });
        moduleBodyEl.appendChild(upBtn);
        moduleBodyEl.appendChild(fileInput);
        var scRow = document.createElement('div');
        scRow.className = 'dshwv-audiorow';
        var scL = document.createElement('span');
        scL.textContent = '显示大小';
        scRow.appendChild(scL);
        var scInit = Number(m.imgScale);
        if (!isFinite(scInit) || scInit <= 0) scInit = 1;
        var scInp = document.createElement('input');
        scInp.type = 'range';
        scInp.min = '10';
        scInp.max = '100';
        scInp.step = '5';
        scInp.className = 'dshwv-cropzoom';
        scInp.style.flex = '1';
        scInp.value = String(Math.round(scInit * 100));
        scInp.addEventListener('input', function () {
          m.imgScale = Math.max(0.1, Math.min(1, Number(scInp.value) / 100));
          scVal.textContent = scInp.value + '%';
          try {
            if (moduleImgPreviewEl) moduleImgPreviewEl.style.maxWidth = Math.round(120 * m.imgScale) + 'px';
          } catch (err) {}
        });
        scRow.appendChild(scInp);
        var scVal = document.createElement('span');
        scVal.className = 'dshwv-volpct';
        scVal.textContent = scInp.value + '%';
        scRow.appendChild(scVal);
        moduleBodyEl.appendChild(scRow);
        try {
          if (moduleImgPreviewEl) moduleImgPreviewEl.style.maxWidth = Math.round(120 * scInit) + 'px';
        } catch (err) {}
        if (!bubbleImgList.length) loadBubbleImgs(fillImgSel); else fillImgSel();
      } else {
        {
          var note = document.createElement('div');
          note.className = 'dshwv-bubhint';
          note.textContent = '该模块为内置数值,内容自动获取,可调下方颜色/字号';
          moduleBodyEl.appendChild(note);
          moduleTplRow();
        }
      }
      if (m.type !== 'image' && m.type !== 'randimg' && m.type !== 'random') {
        var sec = document.createElement('div');
        sec.className = 'dshwv-bubsec';
        sec.textContent = '样式';
        moduleBodyEl.appendChild(sec);
        moduleBodyEl.appendChild(bubbleFontEditRow(function () {
          return m.fontFamily || '';
        }, function (v) {
          m.fontFamily = v || '';
        }));
        var sizeRow = document.createElement('div');
        sizeRow.className = 'dshwv-audiorow';
        var sl = document.createElement('span');
        sl.textContent = '字号';
        sizeRow.appendChild(sl);
        moduleSizeEl = document.createElement('input');
        moduleSizeEl.type = 'range';
        moduleSizeEl.min = '1';
        moduleSizeEl.max = '50';
        moduleSizeEl.step = '1';
        moduleSizeEl.className = 'dshwv-cropzoom';
        moduleSizeEl.value = String(m.size || 6);
        sizeRow.appendChild(moduleSizeEl);
        var sizeNum = document.createElement('span');
        sizeNum.className = 'dshwv-volpct';
        sizeNum.textContent = String(m.size || 6);
        moduleSizeEl.addEventListener('input', function () {
          sizeNum.textContent = moduleSizeEl.value;
        });
        sizeRow.appendChild(sizeNum);
        moduleBodyEl.appendChild(sizeRow);
        var glyphRow = document.createElement('div');
        glyphRow.className = 'dshwv-audiorow';
        function glyphBox(label, key) {
          var lab = document.createElement('label');
          lab.style.display = 'inline-flex';
          lab.style.alignItems = 'center';
          lab.style.gap = '3px';
          lab.style.marginRight = '10px';
          var cb = document.createElement('input');
          cb.type = 'checkbox';
          cb.checked = !!m[key];
          cb.addEventListener('change', function () {
            m[key] = cb.checked;
          });
          var tx = document.createElement('span');
          tx.textContent = label;
          lab.appendChild(cb);
          lab.appendChild(tx);
          return lab;
        }
        glyphRow.appendChild(glyphBox('加粗', 'bold'));
        glyphRow.appendChild(glyphBox('斜体', 'italic'));
        glyphRow.appendChild(glyphBox('下划线', 'ul'));
        moduleBodyEl.appendChild(glyphRow);
        {
          var w3cc = qColorSelectBuild(m.rgb ? m.rgb : 'solid', function (v) {
            if (v === 'solid') {
              m.rgb = '';
              if (!m.color) m.color = '#203170';
            } else {
              m.rgb = v;
              m.color = '';
            }
            var mode2 = v === 'solid' ? 'solid' : v;
            w3cc.sync(mode2, m.color, function (hex) {
              m.color = hex;
            });
          });
          moduleBodyEl.appendChild(w3cc.row);
          w3cc.sync(m.rgb ? m.rgb : 'solid', m.color || '#203170', function (hex) {
            m.color = hex;
          });
        }
        {
          var bgCur = m.bgRgb ? m.bgRgb : m.bg ? 'solid' : 'none';
          var bgcc = qColorSelectBuild(bgCur, function (v) {
            if (v === 'none') {
              m.bgRgb = '';
              m.bg = '';
            } else if (v === 'solid') {
              m.bgRgb = '';
              if (!m.bg) m.bg = '#dbe4f5';
            } else {
              m.bgRgb = v;
              m.bg = '';
            }
            bgcc.sync(v === 'none' ? 'none' : v, m.bg, function (hex) {
              m.bg = hex;
            });
          }, {
            label: '底色',
            defaultHex: '#dbe4f5',
            defaultText: '默认',
            allowNone: true
          });
          moduleBodyEl.appendChild(bgcc.row);
          bgcc.sync(bgCur, m.bg || '#dbe4f5', function (hex) {
            m.bg = hex;
          });
        }
      }
    }
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
      bubbleLibAdd(moduleNameInput.value, m);
      moduleNameInput.value = '';
      closeModuleNamePrompt();
      if (bubblePalEl) renderBubblePal();
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
          if (moduleColorEl) moduleEditRef.color = moduleColorEl.value === '#203170' && !moduleEditRef.color ? '' : moduleColorEl.value;
          if (moduleSizeEl) moduleEditRef.size = Math.max(1, Math.min(50, Math.round(Number(moduleSizeEl.value) || 6)));
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
    var CROP_BOX = 260;
    var cropMask = document.createElement('div');
    cropMask.className = 'dshwv-cropmask';
    cropMask.style.display = 'none';
    var cropCard = document.createElement('div');
    cropCard.className = 'dshwv-cropwin';
    var cropTitle = document.createElement('div');
    cropTitle.className = 'dshwv-croptitle';
    cropTitle.textContent = '裁剪角色图片';
    var cropBox = document.createElement('div');
    cropBox.className = 'dshwv-cropbox';
    var cropCanvas = document.createElement('canvas');
    cropCanvas.width = CROP_BOX;
    cropCanvas.height = CROP_BOX;
    cropBox.appendChild(cropCanvas);
    var cropZoom = document.createElement('input');
    cropZoom.type = 'range';
    cropZoom.min = '0.3';
    cropZoom.max = '3';
    cropZoom.step = '0.01';
    cropZoom.value = '1';
    cropZoom.className = 'dshwv-cropzoom';
    var cropZoomWrap = document.createElement('div');
    cropZoomWrap.className = 'dshwv-cropctrl';
    var cropZoomLabel = document.createElement('span');
    cropZoomLabel.className = 'dshwv-croplabel';
    cropZoomLabel.textContent = '缩放';
    var cropZoomNum = document.createElement('input');
    cropZoomNum.type = 'number';
    cropZoomNum.min = '30';
    cropZoomNum.max = '300';
    cropZoomNum.step = '1';
    cropZoomNum.value = '100';
    cropZoomNum.className = 'dshwv-cropnum';
    cropZoomWrap.appendChild(cropZoomLabel);
    cropZoomWrap.appendChild(cropZoom);
    cropZoomWrap.appendChild(cropZoomNum);
    var cropNameInput = document.createElement('input');
    cropNameInput.type = 'text';
    cropNameInput.className = 'dshwv-cropname';
    cropNameInput.maxLength = 16;
    cropNameInput.placeholder = '角色名称';
    var cropAngleWrap = document.createElement('div');
    cropAngleWrap.className = 'dshwv-cropctrl';
    var cropAngleLabel = document.createElement('span');
    cropAngleLabel.className = 'dshwv-croplabel';
    cropAngleLabel.textContent = '旋转';
    var cropFlipHBtn = document.createElement('button');
    cropFlipHBtn.type = 'button';
    cropFlipHBtn.className = 'dshwv-cropflip';
    cropFlipHBtn.textContent = '⇋';
    cropFlipHBtn.title = '水平翻转';
    var cropFlipVBtn = document.createElement('button');
    cropFlipVBtn.type = 'button';
    cropFlipVBtn.className = 'dshwv-cropflip';
    cropFlipVBtn.textContent = '⇅';
    cropFlipVBtn.title = '垂直翻转';
    var cropAngle = document.createElement('input');
    cropAngle.type = 'range';
    cropAngle.min = '-360';
    cropAngle.max = '360';
    cropAngle.step = '1';
    cropAngle.value = '0';
    cropAngle.className = 'dshwv-cropzoom';
    var cropAngleNum = document.createElement('input');
    cropAngleNum.type = 'number';
    cropAngleNum.min = '-360';
    cropAngleNum.max = '360';
    cropAngleNum.step = '1';
    cropAngleNum.value = '0';
    cropAngleNum.className = 'dshwv-cropnum';
    cropAngleWrap.appendChild(cropAngleLabel);
    cropAngleWrap.appendChild(cropFlipHBtn);
    cropAngleWrap.appendChild(cropFlipVBtn);
    cropAngleWrap.appendChild(cropAngle);
    cropAngleWrap.appendChild(cropAngleNum);
    var cropBtns = document.createElement('div');
    cropBtns.className = 'dshwv-cropbtns';
    var cropCancelBtn = document.createElement('button');
    cropCancelBtn.type = 'button';
    cropCancelBtn.className = 'dshwv-cropbtn dshwv-cropbtn-no';
    cropCancelBtn.textContent = '取消';
    var cropResetBtn = document.createElement('button');
    cropResetBtn.type = 'button';
    cropResetBtn.className = 'dshwv-cropbtn dshwv-cropbtn-no';
    cropResetBtn.textContent = '重置';
    cropResetBtn.title = '重置缩放、旋转和位置';
    var cropOkBtn = document.createElement('button');
    cropOkBtn.type = 'button';
    cropOkBtn.className = 'dshwv-cropbtn dshwv-cropbtn-ok';
    cropOkBtn.textContent = '确认';
    cropBtns.appendChild(cropCancelBtn);
    cropBtns.appendChild(cropResetBtn);
    cropBtns.appendChild(cropOkBtn);
    cropCard.appendChild(cropTitle);
    cropCard.appendChild(cropBox);
    cropCard.appendChild(cropNameInput);
    cropCard.appendChild(cropZoomWrap);
    cropCard.appendChild(cropAngleWrap);
    cropCard.appendChild(cropBtns);
    cropMask.appendChild(cropCard);
    document.body.appendChild(cropMask);
    cropBox.addEventListener('pointerdown', onCropDown);
    cropBox.addEventListener('pointermove', onCropMove);
    cropBox.addEventListener('pointerup', onCropUp);
    cropBox.addEventListener('pointercancel', onCropUp);
    cropBox.addEventListener('pointerleave', onCropUp);
    cropBox.addEventListener('wheel', onCropWheel, {
      passive: false
    });
    cropAngle.addEventListener('input', function () {
      if (cropState) {
        cropState.rotation = clampAngle(Number(cropAngle.value));
        cropAngleNum.value = String(cropState.rotation);
        positionCrop();
      }
    });
    cropAngleNum.addEventListener('input', function () {
      if (cropState) {
        var v = Math.round(Number(cropAngleNum.value));
        if (!isFinite(v)) v = 0;
        cropState.rotation = clampAngle(v);
        cropAngle.value = String(cropState.rotation);
        positionCrop();
      }
    });
    cropAngleNum.addEventListener('change', function () {
      if (cropState) cropAngleNum.value = String(cropState.rotation);
    });
    cropZoom.addEventListener('input', function () {
      if (cropState) {
        cropState.zoom = Number(cropZoom.value);
        cropZoomNum.value = String(Math.round(cropState.zoom * 100));
        positionCrop();
      }
    });
    cropZoomNum.addEventListener('input', function () {
      if (cropState) {
        var pct = Number(cropZoomNum.value);
        if (!isFinite(pct)) pct = 100;
        cropState.zoom = Math.min(3, Math.max(0.3, pct / 100));
        cropZoom.value = String(cropState.zoom);
        positionCrop();
      }
    });
    cropZoomNum.addEventListener('change', function () {
      if (cropState) cropZoomNum.value = String(Math.round(cropState.zoom * 100));
    });
    cropCancelBtn.addEventListener('click', function () {
      hideCropModal();
    });
    cropResetBtn.addEventListener('click', function () {
      resetCrop();
    });
    cropOkBtn.addEventListener('click', function () {
      confirmCrop();
    });
    cropFlipHBtn.addEventListener('click', function (e) {
      e.stopPropagation();
      flipCrop('H');
    });
    cropFlipVBtn.addEventListener('click', function (e) {
      e.stopPropagation();
      flipCrop('V');
    });
    var gifMask = document.createElement('div');
    gifMask.className = 'dshwv-gifmask';
    gifMask.style.display = 'none';
    var gifCard = document.createElement('div');
    gifCard.className = 'dshwv-gifwin';
    var gifTitle = document.createElement('div');
    gifTitle.className = 'dshwv-giftitle';
    gifTitle.textContent = '导入动图角色';
    var gifPreviewBox = document.createElement('div');
    gifPreviewBox.className = 'dshwv-gifpreview';
    var gifPreviewImg = document.createElement('img');
    gifPreviewImg.className = 'dshwv-gifpreviewimg';
    gifPreviewImg.alt = '动图预览';
    gifPreviewImg.draggable = false;
    gifPreviewBox.appendChild(gifPreviewImg);
    var gifHint = document.createElement('div');
    gifHint.className = 'dshwv-gifhint';
    gifHint.textContent = 'GIF 动图不支持裁剪，将按原始尺寸原样导入';
    var gifNameInput = document.createElement('input');
    gifNameInput.type = 'text';
    gifNameInput.className = 'dshwv-gifname';
    gifNameInput.maxLength = 16;
    gifNameInput.placeholder = '角色名称';
    var gifBtns = document.createElement('div');
    gifBtns.className = 'dshwv-cropbtns';
    var gifCancelBtn = document.createElement('button');
    gifCancelBtn.type = 'button';
    gifCancelBtn.className = 'dshwv-cropbtn dshwv-cropbtn-no';
    gifCancelBtn.textContent = '取消';
    var gifOkBtn = document.createElement('button');
    gifOkBtn.type = 'button';
    gifOkBtn.className = 'dshwv-cropbtn dshwv-cropbtn-ok';
    gifOkBtn.textContent = '确认';
    gifBtns.appendChild(gifCancelBtn);
    gifBtns.appendChild(gifOkBtn);
    gifCard.appendChild(gifTitle);
    gifCard.appendChild(gifPreviewBox);
    gifCard.appendChild(gifHint);
    gifCard.appendChild(gifNameInput);
    gifCard.appendChild(gifBtns);
    gifMask.appendChild(gifCard);
    document.body.appendChild(gifMask);
    gifCancelBtn.addEventListener('click', hideGifRoleModal);
    gifOkBtn.addEventListener('click', confirmGifRole);
    var gifRoleDataUrl = null;
    var gifRoleAnimType = 'gif';
    function openGifRoleModal(dataUrl, fileName, animType) {
      gifRoleDataUrl = dataUrl;
      gifRoleAnimType = animType === 'apng' ? 'apng' : 'gif';
      if (gifRoleAnimType === 'apng') {
        gifTitle.textContent = '导入 APNG 动图角色';
        gifHint.textContent = 'APNG 动图不支持裁剪，将按原始尺寸原样导入';
      } else {
        gifTitle.textContent = '导入 GIF 动图角色';
        gifHint.textContent = 'GIF 动图不支持裁剪，将按原始尺寸原样导入';
      }
      gifNameInput.value = '';
      gifPreviewImg.src = dataUrl;
      gifMask.style.display = 'flex';
    }
    function hideGifRoleModal() {
      gifMask.style.display = 'none';
      gifRoleDataUrl = null;
      gifRoleAnimType = 'gif';
      gifPreviewImg.src = '';
    }

    // ==== [GIF 角色确认] ====
    function confirmGifRole() {
      try {
        var name = (gifNameInput.value || '').trim().slice(0, 16) || '新角色';
        if (!gifRoleDataUrl) {
          hideGifRoleModal();
          return;
        }
        fetch(ROLE_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            name: name,
            image: gifRoleDataUrl,
            format: gifRoleAnimType
          })
        }).then(function (r) {
          return r.json();
        }).then(function (d) {
          requireSaved(d);
          if (d && d.ok && Array.isArray(d.roles)) {
            roleManager.useImported(d.roles);
            hideGifRoleModal();
          }
        }).catch(assetFailure);
      } catch (err) { assetFailure(err); }
    }
    var confirmMask = document.createElement('div');
    confirmMask.className = 'dshwv-confirmmask';
    confirmMask.style.display = 'none';
    var confirmCard = document.createElement('div');
    confirmCard.className = 'dshwv-confirmwin';
    var confirmText = document.createElement('div');
    confirmText.className = 'dshwv-confirmtext';
    var confirmBtns = document.createElement('div');
    confirmBtns.className = 'dshwv-confirmbtns';
    var confirmNoBtn = document.createElement('button');
    confirmNoBtn.type = 'button';
    confirmNoBtn.className = 'dshwv-cropbtn dshwv-cropbtn-no';
    confirmNoBtn.textContent = '取消';
    var confirmYesBtn = document.createElement('button');
    confirmYesBtn.type = 'button';
    confirmYesBtn.className = 'dshwv-cropbtn dshwv-cropbtn-ok';
    confirmYesBtn.textContent = '删除';
    confirmBtns.appendChild(confirmNoBtn);
    confirmBtns.appendChild(confirmYesBtn);
    confirmCard.appendChild(confirmText);
    confirmCard.appendChild(confirmBtns);
    confirmMask.appendChild(confirmCard);
    document.body.appendChild(confirmMask);
    confirmNoBtn.addEventListener('click', hideConfirm);
    confirmYesBtn.addEventListener('click', function () {
      var cb = confirmCb;
      hideConfirm();
      if (cb) cb();
    });
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
    audioCropCancel.addEventListener('click', hideAudioCrop);
    audioCropOk.addEventListener('click', confirmAudioCrop);
    audioCropPlay.addEventListener('click', previewAudioCrop);
    audioCropStart.addEventListener('input', onAudioCropStartInput);
    audioCropEnd.addEventListener('input', onAudioCropEndInput);
    audioCropStartNum.addEventListener('input', onAudioCropStartNumInput);
    audioCropStartNum.addEventListener('change', onAudioCropStartNumChange);
    audioCropEndNum.addEventListener('input', onAudioCropEndNumInput);
    audioCropEndNum.addEventListener('change', onAudioCropEndNumChange);
    audioCropZoomRange.addEventListener('input', onAudioCropZoomInput);
    audioCropZoomNum.addEventListener('input', onAudioCropZoomNumInput);
    audioCropZoomNum.addEventListener('change', onAudioCropZoomNumChange);
    audioCropCanvas.addEventListener('wheel', onAudioCropWheel, {
      passive: false
    });
    audioCropCanvas.addEventListener('pointerdown', onAudioCropSelDown);
    audioCropCanvas.addEventListener('pointermove', onAudioCropSelMove);
    audioCropCanvas.addEventListener('pointerup', onAudioCropSelUp);
    audioCropCanvas.addEventListener('pointercancel', onAudioCropSelUp);
    audioCropDual.addEventListener('pointerdown', onAudioCropDualDown);
    audioCropDual.addEventListener('pointermove', onAudioCropDualMove);
    audioCropDual.addEventListener('pointerup', onAudioCropDualUp);
    audioCropDual.addEventListener('pointercancel', onAudioCropDualUp);
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
    var bubbleBox = document.createElement('div');
    bubbleBox.className = 'dshwv-pop';
    bubbleBox.innerHTML = '<svg viewBox="0 0 1026 700" preserveAspectRatio="xMidYMid meet" xmlns="http://www.w3.org/2000/svg">' + '<path class="dshwv-bshape" fill="#FFFFFF" stroke="#203170" stroke-width="18" stroke-linejoin="round" stroke-linecap="round" d="M 827 248 A 373 232 0 1 0 81 246 A 373 232 0 0 0 301 465 A 57 32 10 0 0 413 484 A 373 232 0 0 0 827 248 Z"/>' + '<ellipse class="dshwv-b1" cx="352" cy="561" rx="37.5" ry="26" fill="#FFFFFF" stroke="#203170" stroke-width="18"/>' + '<ellipse class="dshwv-b2" cx="442" cy="646" rx="24.5" ry="18" fill="#FFFFFF" stroke="#203170" stroke-width="18"/>' + '</svg>';
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
    var bubbleLib = [];
    var lastTurnNotice = null;
    function bubbleCloneModule(m) {
      var copy = JSON.parse(JSON.stringify(m || ({})));
      if (m && whaleMoneyTemplates.has(m)) whaleMoneyTemplates.set(copy, whaleMoneyTemplates.get(m));
      return copy;
    }
    function bubbleLibAdd(name, module) {
      try {
        if (!module) return null;
        var id = 'bmod_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 6);
        var it = {
          id: id,
          name: String(name || '').trim().slice(0, 20) || '模块' + (bubbleLib.length + 1),
          module: bubbleCloneModule(module)
        };
        bubbleLib.push(it);
        return it;
      } catch (err) {
        return null;
      }
    }
    function bubbleLibDel(id) {
      bubbleLib = bubbleLib.filter(function (x) {
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
        bubbleLib = bubbleCfg && Array.isArray(bubbleCfg.lib) ? JSON.parse(JSON.stringify(bubbleCfg.lib)) : [];
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
      var opts = bubbleChoiceOptions(step);
      if (!opts.length) return null;
      var total = 0;
      for (var i = 0; i < opts.length; i++) total += bubbleChoiceWeight(opts[i]);
      var r = Math.random() * total;
      var acc = 0;
      for (var j = 0; j < opts.length; j++) {
        acc += bubbleChoiceWeight(opts[j]);
        if (r < acc) return opts[j] && opts[j].item || null;
      }
      var last = opts[opts.length - 1];
      return last && last.item || null;
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
      fetch(BALANCE_URL + (manual ? '?refresh=1' : ''), {
        cache: 'no-store',
        signal: ctrl ? ctrl.signal : undefined
      }).then(function (r) {
        return r.json();
      }).then(function (data) {
        if (data && data.ok) {
          var nb = data.unlimited ? Infinity : Number(data.totalBalance);
          var nc = String(data.currency || 'USD');
          state.balance = nb;
          state.currency = nc;
          WhaleMoney.setNativeCurrency(nc);
          state.message = '';
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
          state.message = data && data.error ? String(data.error) : '获取失败';
          window.dispatchEvent(new CustomEvent('whale-balance', {
            detail: data || ({
              ok: false
            })
          }));
        }
      }).catch(function () {
        state.status = 'error';
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
        fetch(SIZE_URL, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
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
          })
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
    function pressDown() {
      if (window.WhaleGesture) window.WhaleGesture.apply(body, true, window.WhaleFeedback && window.WhaleFeedback.feel);
      else { body.style.transitionDuration = '75ms'; body.style.transform = SQUISH; }
      playPress();
    }
    function pressUp() {
      if (window.WhaleGesture) window.WhaleGesture.apply(body, false, window.WhaleFeedback && window.WhaleFeedback.feel);
      else { body.style.transitionDuration = '140ms'; body.style.transform = 'scaleY(1) scaleX(1)'; }
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
    var confirmCb = null;
    function showConfirm(text, cb, okLabel) {
      confirmCb = cb || null;
      confirmText.textContent = text;
      try {
        if (!okLabel) okLabel = String(text || '').indexOf('删除') !== -1 ? '删除' : '确定';
        confirmYesBtn.textContent = okLabel;
      } catch (err) {}
      confirmMask.style.display = 'flex';
    }
    function hideConfirm() {
      confirmMask.style.display = 'none';
      confirmCb = null;
    }
    var cropState = null;
    async function onRoleFileChosen(input) {
      try {
        var f = input && input.files && input.files[0];
        input.value = '';
        if (!f) return;
        WhaleMediaGuard.checkFile(f, 'role');
        var bytes = await f.arrayBuffer();
        var media = WhaleMediaGuard.inspectImage(bytes, 'role');
        var dataUrl = await mediaDataUrl(new Blob([bytes], { type: media.mime }));
        if (media.animated && (media.format === 'gif' || media.format === 'apng')) openGifRoleModal(dataUrl, f.name, media.format);
        else if (media.animated) throw new Error('动态角色请选择 GIF 或 APNG，避免导入后丢失动画');
        else openCropModal(dataUrl, f.name);
      } catch (err) { assetNotice(err.message); }
    }
    function openCropModal(dataUrl, fileName) {
      try {
        var imgEl = new Image();
        imgEl.onload = function () {
          cropState = {
            img: imgEl,
            zoom: 1,
            ox: 0,
            oy: 0,
            rotation: 0,
            flipH: false,
            flipV: false,
            baseScale: Math.max(CROP_BOX / imgEl.width, CROP_BOX / imgEl.height)
          };
          cropNameInput.value = '';
          cropZoom.value = '1';
          cropZoomNum.value = '100';
          cropAngle.value = '0';
          cropAngleNum.value = '0';
          positionCrop();
          cropMask.style.display = 'flex';
        };
        imgEl.onerror = function () { assetNotice('图片解码失败，请选择其他图片'); };
        imgEl.src = dataUrl;
      } catch (err) {}
    }
    function clampAngle(v) {
      var n = Number(v);
      if (!isFinite(n)) return 0;
      return Math.min(360, Math.max(-360, Math.round(n)));
    }
    function cropDisplaySize() {
      var s = cropState.baseScale * cropState.zoom;
      var w = cropState.img.width * s;
      var h = cropState.img.height * s;
      var rad = cropState.rotation * Math.PI / 180;
      var c = Math.abs(Math.cos(rad));
      var sn = Math.abs(Math.sin(rad));
      return {
        w: w * c + h * sn,
        h: w * sn + h * c,
        s: s
      };
    }
    function positionCrop() {
      if (!cropState) return;
      var d = cropDisplaySize();
      var maxOx = Math.max(0, (d.w - CROP_BOX) / 2);
      var maxOy = Math.max(0, (d.h - CROP_BOX) / 2);
      cropState.ox = Math.min(maxOx, Math.max(-maxOx, cropState.ox));
      cropState.oy = Math.min(maxOy, Math.max(-maxOy, cropState.oy));
      drawCrop();
    }
    function drawCrop() {
      try {
        if (!cropState) return;
        var ctx = cropCanvas.getContext('2d');
        var s = cropState.baseScale * cropState.zoom;
        var rad = cropState.rotation * Math.PI / 180;
        var w = cropState.img.width * s;
        var h = cropState.img.height * s;
        ctx.clearRect(0, 0, CROP_BOX, CROP_BOX);
        ctx.save();
        ctx.translate(CROP_BOX / 2 + cropState.ox, CROP_BOX / 2 + cropState.oy);
        ctx.rotate(rad);
        ctx.scale(cropState.flipH ? -1 : 1, cropState.flipV ? -1 : 1);
        ctx.drawImage(cropState.img, -w / 2, -h / 2, w, h);
        ctx.restore();
      } catch (err) {}
    }
    var cropDrag = null;
    function onCropDown(e) {
      if (!cropState) return;
      try {
        e.preventDefault();
        e.stopPropagation();
      } catch (err) {}
      cropDrag = {
        x: e.clientX,
        y: e.clientY,
        ox: cropState.ox,
        oy: cropState.oy
      };
    }
    function onCropMove(e) {
      if (!cropDrag || !cropState) return;
      cropState.ox = cropDrag.ox + (e.clientX - cropDrag.x);
      cropState.oy = cropDrag.oy + (e.clientY - cropDrag.y);
      positionCrop();
    }
    function onCropUp() {
      cropDrag = null;
    }
    function onCropWheel(e) {
      if (!cropState) return;
      try {
        e.preventDefault();
        e.stopPropagation();
      } catch (err) {}
      var delta = (e.deltaY > 0 ? -1 : 1) * 0.05;
      cropState.zoom = Math.min(3, Math.max(0.3, cropState.zoom + delta));
      cropZoom.value = String(Math.round(cropState.zoom * 100) / 100);
      cropZoomNum.value = String(Math.round(cropState.zoom * 100));
      positionCrop();
    }
    function resetCrop() {
      if (!cropState) return;
      cropState.zoom = 1;
      cropState.ox = 0;
      cropState.oy = 0;
      cropState.rotation = 0;
      cropState.flipH = false;
      cropState.flipV = false;
      cropZoom.value = '1';
      cropZoomNum.value = '100';
      cropAngle.value = '0';
      cropAngleNum.value = '0';
      cropFlipHBtn.classList.remove('dshwv-cropflip-on');
      cropFlipVBtn.classList.remove('dshwv-cropflip-on');
      positionCrop();
    }
    var cropFlipTimer = null;
    function flipCrop(axis) {
      if (!cropState) return;
      try {
        if (cropFlipTimer) {
          clearTimeout(cropFlipTimer);
          cropFlipTimer = null;
        }
      } catch (err) {}
      var flipTarget = axis === 'H' ? 'scaleX(-1)' : 'scaleY(-1)';
      cropCanvas.style.transition = 'transform .3s ease';
      cropCanvas.style.transform = flipTarget;
      cropFlipTimer = setTimeout(function () {
        cropFlipTimer = null;
        try {
          if (axis === 'H') {
            cropState.flipH = !cropState.flipH;
            cropFlipHBtn.classList.toggle('dshwv-cropflip-on', cropState.flipH);
          } else {
            cropState.flipV = !cropState.flipV;
            cropFlipVBtn.classList.toggle('dshwv-cropflip-on', cropState.flipV);
          }
          positionCrop();
          requestAnimationFrame(function () {
            cropCanvas.style.transition = '';
            cropCanvas.style.transform = '';
          });
        } catch (err) {}
      }, 300);
    }
    function confirmCrop() {
      try {
        if (!cropState) return;
        var name = (cropNameInput.value || '').trim().slice(0, 16) || '新角色';
        var s = cropState.baseScale * cropState.zoom;
        var k = 610 / CROP_BOX;
        var rad = cropState.rotation * Math.PI / 180;
        var w = cropState.img.width * s * k;
        var h = cropState.img.height * s * k;
        var out = document.createElement('canvas');
        out.width = 610;
        out.height = 610;
        var octx = out.getContext('2d');
        octx.translate(305 + cropState.ox * k, 305 + cropState.oy * k);
        octx.rotate(rad);
        octx.scale(cropState.flipH ? -1 : 1, cropState.flipV ? -1 : 1);
        octx.drawImage(cropState.img, -w / 2, -h / 2, w, h);
        var dataUrl = out.toDataURL('image/png');
        fetch(ROLE_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            name: name,
            image: dataUrl
          })
        }).then(function (r) {
          return r.json();
        }).then(function (d) {
          requireSaved(d);
          if (d && d.ok && Array.isArray(d.roles)) {
            roleManager.useImported(d.roles);
            hideCropModal();
          }
        }).catch(assetFailure);
      } catch (err) { assetFailure(err); }
    }
    function hideCropModal() {
      cropMask.style.display = 'none';
      cropState = null;
      cropDrag = null;
    }
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
    function renderAudioGroupPanel() {
      try {
        audioGroupPanel.innerHTML = '';
        audioGroups.forEach(function (g) {
          var item = document.createElement('div');
          item.className = 'dshwv-audioitem' + (soundSet === g.id ? ' dshwv-audioitem-cur' : '');
          var thumb = document.createElement('span');
          thumb.className = 'dshwv-audiothumb';
          thumb.setAttribute('aria-hidden', 'true');
          item.appendChild(thumb);
          var name = makeNameCell('dshwv-audioname', g.name);
          item.appendChild(name);
          if (g.preset) {
            var tag = document.createElement('span');
            tag.className = 'dshwv-audiopreset';
            tag.textContent = '预设';
            item.appendChild(tag);
          } else {
            var pin = document.createElement('button');
            pin.type = 'button';
            pin.className = 'dshwv-audiopin' + (g.pinned ? ' on' : '');
            pin.textContent = '📌';
            pin.title = g.pinned ? '取消置顶' : '置顶';
            pin.addEventListener('click', function (e) {
              e.stopPropagation();
              audioPinGroup(g.id, !g.pinned);
            });
            item.appendChild(pin);
            var del = document.createElement('button');
            del.type = 'button';
            del.className = 'dshwv-audiodel';
            del.textContent = '✕';
            del.title = '删除音效组';
            del.addEventListener('click', function (e) {
              e.stopPropagation();
              audioDeleteGroup(g.id);
            });
            item.appendChild(del);
          }
          item.addEventListener('click', function () {
            setSoundSet(g.id);
            closeAudioGroupPanel();
          });
          bindNameMarquee(item, name);
          audioGroupPanel.appendChild(item);
        });
      } catch (err) {}
    }
    function audioPinGroup(id, pinned) {
      try {
        fetch(AUDIO_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            action: 'pin-group',
            id: id,
            pinned: pinned
          })
        }).then(function (r) {
          return r.json();
        }).then(function (d) {
          requireSaved(d);
          if (d && d.ok && Array.isArray(d.groups)) {
            audioGroups = d.groups;
            renderAudioGroupPanel();
            refreshTaskEndAfterAudio();
          }
        }).catch(assetFailure);
      } catch (err) { assetFailure(err); }
    }
    function audioDeleteGroup(id) {
      var g = null;
      for (var i = 0; i < audioGroups.length; i++) if (audioGroups[i].id === id) {
        g = audioGroups[i];
        break;
      }
      showConfirm('确定删除音效组「' + (g ? g.name : id) + '」吗？', function () {
        try {
          fetch(AUDIO_URL, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              action: 'delete-group',
              id: id
            })
          }).then(function (r) {
            return r.json();
          }).then(function (d) {
          requireSaved(d);
            if (d && d.ok && Array.isArray(d.groups)) {
              audioGroups = d.groups;
              renderAudioGroupPanel();
              refreshTaskEndAfterAudio();
              if (soundSet === id) setSoundSet('duck');
            }
          }).catch(assetFailure);
        } catch (err) { assetFailure(err); }
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
        var vp = viewport();
        var panelW = Math.max(120, Math.round(b.width));
        panel.style.width = panelW + 'px';
        panel.style.left = Math.max(4, Math.min(b.left, vp.w - panelW - 4)) + 'px';
        panel.style.top = b.bottom + 4 + 'px';
        panel.style.display = 'block';
      } catch (err) {}
    }
    function closeAudioSlotPanels() {
      if (audioEditPressPanel) audioEditPressPanel.style.display = 'none';
      if (audioEditReleasePanel) audioEditReleasePanel.style.display = 'none';
      activeSlotPanel = null;
    }
    function renderAudioSlotPanel(slot) {
      try {
        var panel = slot === 'press' ? audioEditPressPanel : audioEditReleasePanel;
        var current = slot === 'press' ? audioEditPressVal : audioEditReleaseVal;
        panel.innerHTML = '';
        var emptyItem = document.createElement('div');
        emptyItem.className = 'dshwv-audioitem' + (!current ? ' dshwv-audioitem-cur' : '');
        var emptyIcon = document.createElement('span');
        emptyIcon.className = 'dshwv-audiothumb dshwv-audiothumb-empty';
        emptyIcon.setAttribute('aria-hidden', 'true');
        emptyItem.appendChild(emptyIcon);
        var emptyName = makeNameCell('dshwv-audioname', '留空（不发声）');
        emptyItem.appendChild(emptyName);
        emptyItem.addEventListener('click', function () {
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
        bindNameMarquee(emptyItem, emptyName);
        panel.appendChild(emptyItem);
        audioFragments.forEach(function (f) {
          var item = document.createElement('div');
          item.className = 'dshwv-audioitem' + (current === f.id ? ' dshwv-audioitem-cur' : '');
          var thumb = document.createElement('span');
          thumb.className = 'dshwv-audiothumb';
          thumb.setAttribute('aria-hidden', 'true');
          item.appendChild(thumb);
          var name = makeNameCell('dshwv-audioname', f.name);
          item.appendChild(name);
          if (f.preset) {
            var tag = document.createElement('span');
            tag.className = 'dshwv-audiopreset';
            tag.textContent = '预设';
            item.appendChild(tag);
          } else {
            var del = document.createElement('button');
            del.type = 'button';
            del.className = 'dshwv-audiodel';
            del.textContent = '✕';
            del.title = '删除该音频';
            del.addEventListener('click', function (e) {
              e.stopPropagation();
              audioDeleteFragmentInSlot(slot, f.id);
            });
            item.appendChild(del);
          }
          item.addEventListener('click', function () {
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
          bindNameMarquee(item, name);
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
          audioEditPreviewEl.volume = soundVol;
        }
        if (releaseId) {
          audioEditPreviewRelease = new Audio('/dsh-whale/audio-fragment.wav?id=' + encodeURIComponent(releaseId));
          audioEditPreviewRelease.preload = 'auto';
          audioEditPreviewRelease.volume = soundVol;
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
        audioEditPreviewEl.onended = function () {
          audioEditPreviewPressEnded = true;
          if (!audioEditPreviewPressing && !audioEditPreviewReleasePlayed) audioEditPreviewUp();
        };
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
          audioEditPreviewTimer = setTimeout(function () {
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
        fetch(AUDIO_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            action: 'save-group',
            id: editingAudioGroupId || '',
            name: name,
            press: audioEditPressVal || '',
            release: audioEditReleaseVal || ''
          })
        }).then(function (r) {
          return r.json();
        }).then(function (d) {
          requireSaved(d);
          if (d && d.ok && Array.isArray(d.groups)) {
            var openedFromFeature = !!audioEditorSession;
            var selectedGroupId = editingAudioGroupId || '';
            audioGroups = d.groups;
            if (Array.isArray(d.fragments)) audioFragments = d.fragments;
            renderAudioGroupPanel();
            refreshTaskEndAfterAudio();
            if (!editingAudioGroupId) {
              var newest = d.groups.filter(function (x) {
                return !x.preset;
              }).sort(function (a, b) {
                return (b.pinnedAt || 0) - (a.pinnedAt || 0);
              })[0];
              if (newest) {
                selectedGroupId = newest.id;
                if (!openedFromFeature) setSoundSet(newest.id);
              }
            } else if (!openedFromFeature && soundSet === editingAudioGroupId) {
              try {
                applySoundSet();
              } catch (err) { assetFailure(err); }
            }
            hideAudioEditor('saved', {
              selectedGroupId: selectedGroupId,
              catalog: { groups: audioGroups.slice(), fragments: audioFragments.slice() }
            });
          }
        }).catch(assetFailure);
      } catch (err) { assetFailure(err); }
    }
    var audioCropFileInput = document.createElement('input');
    audioCropFileInput.type = 'file';
    audioCropFileInput.accept = 'audio/*';
    audioCropFileInput.style.display = 'none';
    document.body.appendChild(audioCropFileInput);
    var audioCropTarget = null;
    var audioCropCtx = null;
    var audioCropBuffer = null;
    var audioCropZoom = 1;
    var audioCropOffset = 0;
    audioEditPressImport.addEventListener('click', function () {
      audioCropTarget = 'press';
      audioCropFileInput.click();
    });
    audioEditReleaseImport.addEventListener('click', function () {
      audioCropTarget = 'release';
      audioCropFileInput.click();
    });
    audioCropFileInput.addEventListener('change', async function () {
      var f = audioCropFileInput.files && audioCropFileInput.files[0];
      audioCropFileInput.value = '';
      if (!f) return;
      try {
        await WhaleMediaGuard.validateAudioFile(f);
        openAudioCrop(await f.arrayBuffer(), f.name);
      } catch (err) { assetNotice(err.message); }
    });
    function openAudioCrop(arrayBuf, fileName) {
      try {
        audioCropZoom = 1;
        audioCropOffset = 0;
        stopAudioCropPreview();
        if (!audioCropCtx) {
          try {
            audioCropCtx = new (window.AudioContext || window.webkitAudioContext)();
          } catch (err) {
            audioCropCtx = null;
          }
        }
        if (!audioCropCtx) {
          assetNotice('当前环境不支持音频解码');
          return;
        }
        audioCropCtx.decodeAudioData(arrayBuf, function (buf) {
          var policy = WhaleMediaGuard.getPolicy();
          if (!isFinite(buf.duration) || buf.duration <= 0 || buf.duration > policy.maxAudioSeconds ||
              buf.numberOfChannels > policy.maxAudioChannels || buf.sampleRate > policy.maxAudioSampleRate) {
            assetNotice('音频超出时长、声道或采样率限制，请选择较短的音频');
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
        }, function () {
          assetNotice('音频解码失败');
        });
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
        srcNode.onended = function () {
          if (audioCropPreviewNode === srcNode) audioCropPreviewNode = null;
        };
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
            setTimeout(function () {
              audioCropName.style.borderColor = 'rgba(32,49,112,.4)';
              audioCropName.style.boxShadow = 'none';
            }, 1200);
          } catch (err) {}
          return;
        }
        var r = audioCropRange();
        var len = Math.floor((r.end - r.start) * audioCropBuffer.sampleRate);
        if (len < 1) {
          assetNotice('所选片段为空');
          return;
        }
        if (44 + len * audioCropBuffer.numberOfChannels * 2 > WhaleMediaGuard.getPolicy().audioBytes) {
          assetNotice('所选音频片段过大，请缩短后再保存');
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
        WhaleMediaGuard.checkFile(blob, 'wav');
        var reader = new FileReader();
        reader.onload = function () {
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
        };
        reader.onerror = function () { assetNotice('音频读取失败，请重试'); };
        reader.readAsDataURL(blob);
      } catch (err) { assetNotice(err.message); }
    }
    var lastUploadedFragmentId = null;
    function uploadAudioFragment(dataUrl, name, cb) {
      try {
        assetClient.uploadAudioFragment(name, dataUrl).then(function (d) {
          requireSaved(d);
          if (d && d.ok && Array.isArray(d.fragments)) {
            audioFragments = d.fragments;
            lastUploadedFragmentId = d.id || null;
            refreshTaskEndAfterAudio();
            if (cb) cb(true);
          } else {
            if (cb) cb(false);
          }
        }).catch(function (error) {
          assetFailure(error);
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
      showConfirm('确定删除音频「' + f.name + '」吗？', function () {
        try {
          fetch(AUDIO_URL, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              action: 'delete-fragment',
              id: id
            })
          }).then(function (r) {
            return r.json();
          }).then(function (d) {
          requireSaved(d);
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
      if (snapshot.usage && typeof snapshot.usage === 'object') usageSet = snapshot.usage;
      else {
        usageSet = usageSet || {};
        usageSet.taskEnd = saved.taskEnd || usageSet.taskEnd || {};
      }
      taskEndToggle.checked = usageSet.taskEnd.on === true;
      taskEndSel.disabled = !taskEndToggle.checked;
      fillTaskEndOptions(usageSet.taskEnd);
      if (!turnCostOn) hideCostBubble();
    }
    window.addEventListener('whale-sound-settings-applied', function (event) {
      if (event.detail && event.detail.schemaVersion === 1) return;
      applySoundSettingsSnapshot(event.detail || {});
    });
    window.addEventListener('whale-edit-turn-cost', function () {
      usageAlertBudgetEditor('turnCost', function (o) {
        usageSet = usageSet || ({}); usageSet.turnCost = { lines: o.lines };
        setTurnCostOn(o.on); setTurnCostClose(o.ttlSec);
        saveUsageSettings({ turnCost: usageSet.turnCost });
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
        if (usageSet && usageSet.taskEnd) {
          taskEndToggle.checked = !!usageSet.taskEnd.on;
          taskEndSel.disabled = !usageSet.taskEnd.on;
        }
        fillTaskEndOptions(usageSet && usageSet.taskEnd);
        setTimeout(function () {
          try {
            if (audioFragments && audioFragments.length) fillTaskEndOptions(usageSet && usageSet.taskEnd);
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
    fetch(SIZE_URL, {
      cache: 'no-store'
    }).then(function (r) {
      return r.json();
    }).then(function (d) {
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
