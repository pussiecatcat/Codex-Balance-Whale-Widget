import { bubblePresetItems } from './default-content.js';

// Owns the bubble editor's open/save lifecycle and the queue rendering calls.
// The edit buffer itself stays in the entry as `bubbleEditorState` because the
// item editor and the reminder editor swap the same fields while their dialogs
// are open; this module only drives the sequence-level operations.
export function createBubbleEditorController({
  state, view, getMask, getMode,
  getConfig, isConfigLoaded, loadConfig, saveConfig, draftOf, draftSave, defaultQueue,
  showConfirm, assetFailure, closeRolePanel, closeAudioGroupPanel,
}) {
  // 编辑会话固定打开时的账号模式，中途切换模式也不会写到另一套配置里。
  let editingSubscription = false;

  function renderFirst() { view.renderFirst(); }
  function renderMore() { view.renderMore(); }
  function dropToEnd() { view.dropToEnd(); }
  function addMore() { view.add(); }

  function render() {
    if (!state.items.length) state.items = [{ kind: 'normal' }];
    renderFirst();
    renderMore();
  }

  function dirty() {
    try {
      if (state.editorSnap === null) return true;
      return state.editorSnap !== JSON.stringify([state.items, state.lib, state.tapAdvance]);
    } catch { return true; }
  }

  function openWithCache() {
    try {
      closeRolePanel();
      closeAudioGroupPanel();
      editingSubscription = getMode() === 'subscription';
      const draft = draftOf(getConfig(), editingSubscription);
      state.lib = draft.library;
      state.items = draft.items;
      state.tapAdvance = draft.tapAdvance;
      state.editorSnap = JSON.stringify([state.items, state.lib, state.tapAdvance]);
      render();
      getMask().style.display = 'flex';
    } catch {}
  }

  // 每次打开都先读最新配置：另一个实例可能刚保存过权重，旧缓存不能把它覆盖。
  function open() {
    loadConfig().then(ok => {
      if (ok || isConfigLoaded()) openWithCache();
      else assetFailure(new Error('气泡DIY配置读取失败'));
    });
  }

  function close() {
    getMask().style.display = 'none';
    state.editorSnap = null;
  }

  function reset() {
    showConfirm(editingSubscription ? '恢复为默认 Codex 订阅气泡?' : '恢复为默认序列(首次=余额内容,再次=上轮用量)?', () => {
      state.items = defaultQueue(editingSubscription);
      state.tapAdvance = false;
      render();
    });
  }

  function applyPreset(name) {
    const labels = { quota: '额度优先', 'quota-cards': '潮汐卡片', balance: '余额优先', minimal: '极简', companion: '小龙娘陪伴' };
    showConfirm('用「' + (labels[name] || name) + '」预设替换当前泡泡序列？保存前不会写入，取消可放弃。', () => {
      state.items = bubblePresetItems(name, editingSubscription);
      state.itemIdx = 0;
      state.itemSide = 0;
      render();
    });
  }

  function save() {
    try {
      const doSave = () => {
        saveConfig(draftSave(state.items, state.lib, getConfig(), editingSubscription, state.tapAdvance), ok => {
          if (ok !== false) close();
        });
      };
      if (dirty()) showConfirm('保存当前点击序列?(未逐泡编辑过的行将按默认内容保存,保存后即生效)', doSave); else doSave();
    } catch {}
  }

  return { renderFirst, renderMore, dropToEnd, addMore, render, dirty, open, close, reset, save, applyPreset };
}
