import { createBubbleEditor } from '/features/bubble/bubble-editor.js';
import { createRoleImport } from '/features/roles/role-import.js';
import { createAudioEditor } from '/features/audio/audio-editor.js';
import { settingsClient } from '/services/settings-client.js';
import { createBubbleRowsView } from '/features/bubble/bubble-rows-view.js';
import { createTurnNoticePoller } from '/features/usage/turn-notice-poller.js';
import { createTaskEndSound } from '/features/audio/task-end-sound.js';
import { createNameMarquee } from '/components/name-marquee.js';
import { createRoleManager } from '/features/roles/role-manager.js';
import { createCharacterInteraction } from '/features/character/character-interaction.js';
import { createBubbleTemplateHelp } from '/features/bubble/bubble-template-help.js';
import { createBubbleContent } from '/features/bubble/bubble-content.js';
import { createUsageNavigation } from '/features/usage/usage-navigation.js';
import { createFxControls } from '/features/usage/fx-controls.js';
import { createUsageOverviewView } from '/features/usage/usage-overview-view.js';
import { createUsageModelsView } from '/features/usage/usage-models-view.js';

import { createSnapEditor } from '/features/character/snap-editor.js';
import { createUsageAlerts } from '/features/usage/usage-alerts.js';
import { createUsageRecordsView } from '/features/usage/usage-records-view.js';
import { aggregateUsageModels, createUsageCharts } from '/features/usage/usage-charts.js';
import { createBubbleSceneController } from '/features/bubble/bubble-scene.js';
import { createBubbleNoticeQueue } from '/features/bubble/bubble-notice-queue.js';
import { createBubbleInteraction } from '/features/bubble/bubble-interaction.js';
import { createAssetClient } from '/services/asset-client.js';
import { createResourceManager } from '/features/resources/resource-manager.js';

import { snapBounds as calculateSnapBounds, snapZones as calculateSnapZones, artCenterAt, restoreAnchor, clampToViewport, settlePosition } from '/features/character/anchors.js';
import { createCustomSelectController } from '/components/custom-select.js';
import { bubbleIsImgMod, bubbleRowsOf } from '/features/bubble/bubble-layout.js';
import { bubbleDefaultSubscriptionQueue, bubbleLegacySubscriptionDefault, bubbleIsChoice, bubbleChoiceOptions, bubbleChoiceWeight } from '/features/bubble/default-content.js';
// Adapted from MeteorNOX dsh-whale-widget (MIT). Scheduling modules removed; money display uses two decimals.
// ────────────────────────────────────────────────────────────────────────────
//  分段索引  SECTION INDEX
//
//  本文件是装配入口：DOM 装配与兼容适配留在这里，实现已迁到
//  /features/* 与 /services/* 的模块。分段索引标的是还留在本文件里的区段。
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
      document: document, Audio: Audio, taskEndSelect: taskEndSel,
      playFeedback: function (kind, url, volume) {
        if (!window.WhaleFeedback) return false;
        window.WhaleFeedback.play(kind, url, volume); return true;
      },
      rememberSuccessSource: function (url) {
        if (!window.WhaleFeedback) return;
        window.WhaleFeedbackSources ||= {}; window.WhaleFeedbackSources.success = url;
      },
      getTaskEndDrop: function () { return taskEndDrop; },
      getUsageSettings: function () { return usageSet; },
      setUsageSettings: function (settings) { usageSet = settings; },
      getAudioGroups: function () { return audioEditor.audioGroups; },
      getAudioFragments: function () { return audioEditor.audioFragments; },
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

    // ==== [用量面板与设置] ====
    function loadUsageSettings(cb) {
      try {
        fetch(SETTINGS_URL, {
          cache: 'no-store'
        }).then(function (r) {
          return r.json();
        }).then(function (d) {
          if (d && d.ok && d.usage) usageSet = d.usage;
          if (cb) cb();
        }).catch(function () {
          if (cb) cb();
        });
      } catch (err) {
        if (cb) cb();
      }
    }
    function saveUsageSettings(patch) {
      return settingsClient.update({ usage: patch || {} }).then(function (saved) {
        if (saved && saved.usage) usageSet = saved.usage;
        return saved;
      }).catch(assetFailure);
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
      document: document, WhaleMoney: WhaleMoney,
      loadModels: async function (force) {
        if (!window.WhaleApiModels?.load) throw new Error('API 模型模块未加载');
        return window.WhaleApiModels.load(force);
      },
      refreshModel: async function (id, force) { return window.WhaleApiModels.refresh(id, force); },
      editModel: function (id) { window.dispatchEvent(new CustomEvent('whale-api-model-edit', { detail: { id: id } })); },
      getPanel: function () { return usagePanel; }
    });
    var renderUsageModels = usageModelsView.render;
    var buildUsageModelArea = usageModelsView.build;
    function usageAlertBudgetEditor(...args) { return bubbleEditor.usageAlertBudgetEditor(...args); }
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
      onBubbleImageDelete: function (id, data) { bubbleEditor.replaceImages(data.images); },
      onAudioGroupDelete: function (id, data) {
        audioEditor.audioGroups = data.groups;
        renderAudioGroupPanel();
        refreshTaskEndAfterAudio();
        if (soundSet === id) setSoundSet('duck');
      },
      onAudioFragmentDelete: function (id, data) {
        audioEditor.audioFragments = data.fragments;
        if (Array.isArray(data.groups)) audioEditor.audioGroups = data.groups;
        renderAudioGroupPanel();
        refreshTaskEndAfterAudio();
      }
    });
    function openResManager() { resourceManager.open().catch(assetFailure); }
    // Bubble and usage views call the same alert controller, including its day-level dedupe.
    var usageAlerts = createUsageAlerts({
      document: document, WhaleMoney: WhaleMoney,
      isSubscription: function () { return window.WhaleAccountView?.mode === 'subscription'; },
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
    var bubbleEditor = createBubbleEditor({
      modelOptions: function (...args) { return window.WhaleApiModels?.options(...args); },
      isSubscription: function () { return window.WhaleAccountView?.mode === 'subscription'; },

      get document() { return document; },
      get showConfirm() { return showConfirm; },
      get window() { return window; },
      get bubbleCloneModule() { return bubbleCloneModule; },
      get bubbleCfgLoaded() { return bubbleCfgLoaded; },
      get closeRolePanel() { return closeRolePanel; },
      get closeAudioGroupPanel() { return closeAudioGroupPanel; },
      get bubbleCfg() { return bubbleCfg; },
      get loadBubbleCfg() { return loadBubbleCfg; },
      get assetFailure() { return assetFailure; },
      get saveBubbleCfg() { return saveBubbleCfg; },
      get viewport() { return viewport; },
      get bubbleTplHelpToggle() { return bubbleTplHelpToggle; },
      get root() { return root; },
      get bubblePreviewInto() { return bubblePreviewInto; },
      get assetClient() { return assetClient; },
      get assetWarning() { return assetWarning; },
      get WhaleMediaGuard() { return WhaleMediaGuard; },
      get mediaDataUrl() { return mediaDataUrl; },
      get assetNotice() { return assetNotice; },
      get usageMoreMask() { return usageMoreMask; },
      get dshwCustSel() { return dshwCustSel; },
      getCurrency: function () { return state.currency || 'USD'; },
      getNoticeConfig: function (key) { return key === 'question' || key === 'approval' ? usageSet?.events?.[key] : usageSet?.[key]; },
      get usageTurnCostLines() { return usageTurnCostLines; },
      get usageWaitLinesOf() { return usageWaitLinesOf; },
      get usageRemindLinesOf() { return usageRemindLinesOf; },
      get turnCostOn() { return turnCostOn; },
      get WhaleMoney() { return WhaleMoney; },
      get turnCostCloseMs() { return turnCostCloseMs; },
      get usageTurnCostDefaultLines() { return usageTurnCostDefaultLines; },
      get usageWaitDefaultLines() { return usageWaitDefaultLines; },
      get usageRemindDefaultLines() { return usageRemindDefaultLines; },
      get WhaleTurnNotice() { return WhaleTurnNotice; },
      get usageAlertModsResolved() { return usageAlertModsResolved; },
    });
    function bubbleDefaultQueue(...args) { return bubbleEditor.bubbleDefaultQueue(...args); }
    function openBubbleEditor(...args) { return bubbleEditor.openBubbleEditor(...args); }
    function bubbleUploadImg(...args) { return bubbleEditor.bubbleUploadImg(...args); }
    function dshwDropOpen(...args) { return bubbleEditor.dshwDropOpen(...args); }

// ==== [气泡编辑器] ====

// ==== [快速编辑器与调色板] ====

// ==== [气泡预览与样式] ====

// ==== [模块编辑器] ====

var roleImport = createRoleImport({
      get document() { return document; },
      get ROLE_URL() { return ROLE_URL; },
      get assetFailure() { return assetFailure; },
      get requireSaved() { return requireSaved; },
      get roleManager() { return roleManager; },
      get WhaleMediaGuard() { return WhaleMediaGuard; },
      get mediaDataUrl() { return mediaDataUrl; },
      get assetNotice() { return assetNotice; }
    });
    function onRoleFileChosen(...args) { return roleImport.onRoleFileChosen(...args); }

// ==== [GIF 角色确认] ====

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
    var audioEditor = createAudioEditor({
      get document() { return document; },
      get assetClient() { return assetClient; },
      get assetWarning() { return assetWarning; },
      get soundSet() { return soundSet; },
      get setSoundSet() { return setSoundSet; },
      get refreshTaskEndAfterAudio() { return refreshTaskEndAfterAudio; },
      get setAudioBtnText() { return setAudioBtnText; },
      get applySoundSet() { return applySoundSet; },
      get audioGroupBtn() { return audioGroupBtn; },
      get viewport() { return viewport; },
      get audioGroupPanel() { return audioGroupPanel; },
      get makeNameCell() { return makeNameCell; },
      get bindNameMarquee() { return bindNameMarquee; },
      get assetFailure() { return assetFailure; },
      get requireSaved() { return requireSaved; },
      get showConfirm() { return showConfirm; },
      get soundVol() { return soundVol; },
      get WhaleMediaGuard() { return WhaleMediaGuard; },
      get assetNotice() { return assetNotice; },
      get window() { return window; }
    });
    function loadAudio(...args) { return audioEditor.loadAudio(...args); }
    function audioGroupName(...args) { return audioEditor.audioGroupName(...args); }
    function audioGroupSlotEmpty(...args) { return audioEditor.audioGroupSlotEmpty(...args); }
    function toggleAudioGroupPanel(...args) { return audioEditor.toggleAudioGroupPanel(...args); }
    function closeAudioGroupPanel(...args) { return audioEditor.closeAudioGroupPanel(...args); }
    function renderAudioGroupPanel(...args) { return audioEditor.renderAudioGroupPanel(...args); }
    function openAudioGroupEditor(...args) { return audioEditor.openAudioGroupEditor(...args); }
    function openAudioEditorForFeature(...args) { return audioEditor.openAudioEditorForFeature(...args); }

// ==== [音频裁剪与气泡测量] ====

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

    var lastTurnNotice = null;
    function bubbleCloneModule(m) {
      var copy = JSON.parse(JSON.stringify(m || ({})));
      if (m && whaleMoneyTemplates.has(m)) whaleMoneyTemplates.set(copy, whaleMoneyTemplates.get(m));
      return copy;
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
        bubbleEditor.replaceLibrary(bubbleCfg && Array.isArray(bubbleCfg.lib) ? JSON.parse(JSON.stringify(bubbleCfg.lib)) : []);
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
      modelText: function (mod) { return window.WhaleApiModels?.text(mod); },
      quotaText: function (mod) { return window.WhaleQuota?.text(mod); },
      getState: function () { return state; },
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
      clearQuotaBindings: function (node) { window.WhaleQuota?.clearBindings(node); },
      clearModelBindings: function (node) { window.WhaleApiModels?.clearBindings(node); },
      bindQuota: function (node, mod) { return window.WhaleQuota?.bind(node, mod); },
      bindModel: function (node, mod) { return window.WhaleApiModels?.bind(node, mod); },
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
    var bubbleOn = true;
    var turnCostOn = true;
    var turnCostCloseMs = 5000;
    var costBubbleActive = false;
    var scrollGapOn = false;
    var scrollGapPx = 17;
    var menuBtnHide = false;
    function savePosition() {
      try {
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
      settingsClient.update({ size: { bubbleOn } }).catch(assetFailure);
      if (!bubbleOn) hideCostBubble();
    }
    function setTurnCostOn(v) {
      turnCostOn = !!v;
      turnCostToggle.checked = turnCostOn;
      turnCostCloseInput.disabled = !turnCostOn;
      settingsClient.update({ size: { turnCostOn } }).catch(assetFailure);
      if (!turnCostOn) hideCostBubble();
    }
    function setTurnCostClose(v) {
      if (!turnCostOn) return;
      var n = Math.max(0, Math.round(Number(v) || 0));
      turnCostCloseMs = n * 1000;
      turnCostCloseInput.value = String(n);
      settingsClient.update({ size: { turnCostCloseMs } }).catch(assetFailure);
    }
    function setScrollGapOn(v) {
      scrollGapOn = !!v;
      scrollGapToggle.checked = scrollGapOn;
      scrollGapInput.disabled = !scrollGapOn;
      settingsClient.update({ size: { scrollGapOn } }).catch(assetFailure);
      settle();
    }
    function setScrollGapPx(v) {
      if (!scrollGapOn) return;
      var n = Math.max(0, Math.round(Number(v) || 0));
      scrollGapPx = n;
      scrollGapInput.value = String(n);
      settingsClient.update({ size: { scrollGapPx } }).catch(assetFailure);
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
      settingsClient.update({ size: { menuBtnHide } }).catch(assetFailure);
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
      settingsClient.update({ size: { scale: state.scale } }).catch(assetFailure);
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
      settingsClient.update({ size: { vol: soundVol } }).catch(assetFailure);
    }
    function setSoundSet(v) {
      soundSet = typeof v === 'string' && v ? v : 'duck';
      setAudioBtnText(audioGroupName(soundSet));
      applySoundSet();
      settingsClient.update({ size: { soundSet } }).catch(assetFailure);
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

// ==== [音频组与槽面板] ====

var characterInteraction = createCharacterInteraction({
      document: document, window: window, localStorage: localStorage, rendering: WhaleRendering,
      root: root, image: img, positioner: positioner, menuButton: menuBtn, state: state, dragStatus: drag,
      clickDistanceSq: CLICK_SQ, imageUrl: IMG_URL, viewport: viewport, rightGap: rightGap,
      clampToViewport: clampToViewport, artCenterAt: artCenterAt, snapZones: snapZones,
      restoreAnchor: restoreAnchor, express: express, settle: settle, savePosition: savePosition,
      refreshFlip: refreshFlip, pressDown: pressDown, pressUp: pressUp, whaleClick: whaleClick,
      refresh: refresh, closeMenu: closeMenu, toggleMenu: toggleMenu, closeRolePanel: closeRolePanel,
      closeAudioGroupPanel: closeAudioGroupPanel, hideBubble: hideBubble,
      applyBubbleConfig: applyBubbleCfgSeq, positionMenu: positionMenu,
      isMenuOpen: function () { return menuOpen; },
      isMenuButtonHidden: function () { return menuBtnHide; },
      isScrollGapEnabled: function () { return scrollGapOn; }
    });
    window.addEventListener('beforeunload', function () {
      bubbleEditor.dispose(); roleImport.dispose(); audioEditor.dispose(); roleManager.dispose();
      customSelect.dispose(); characterInteraction.dispose(); taskEndSound.dispose();
      clearInterval(turnNoticeInterval); turnNoticePoller?.dispose();
    }, { once: true });
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
      if (event.detail && event.detail.schemaVersion >= 1) return;
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
            if (audioEditor.audioFragments && audioEditor.audioFragments.length) fillTaskEndOptions(usageSet && usageSet.taskEnd);
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
    fetch(SETTINGS_URL, {
      cache: 'no-store'
    }).then(function (r) {
      return r.json();
    }).then(function (payload) {
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
      playFeedback: function (...args) { window.WhaleFeedback?.play(...args); },
      isSubscription: function () { return window.WhaleAccountView?.mode === 'subscription'; },
      showSubscriptionNotice: function (notice) { window.WhaleAccountView?.notice(notice); },
      notifyQuotaSettled: function () { window.WhaleQuota?.settled(); },
      getFeedbackVolume: function () { return soundOn ? soundVol : 0; },
      showCostBubble: showCostBubble
    });
    function pollLastTurn() {
      return turnNoticePoller.poll();
    }
    var turnNoticeInterval = setInterval(pollLastTurn, 1000);
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
