// Owns the bubble editor's open/save lifecycle and the queue rendering calls.
// The edit buffer itself stays in the entry as `bubbleEditorState` because the
// item editor and the reminder editor swap the same fields while their dialogs
// are open; this module only drives the sequence-level operations.
export function createBubbleEditorController({
  state, view, getMask, getAdvance, getMode,
  getConfig, isConfigLoaded, loadConfig, saveConfig, draftOf, draftSave, defaultQueue,
  showConfirm, assetFailure, closeRolePanel, closeAudioGroupPanel,
}) {
  const subscription = () => getMode() === 'subscription';

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

  function open() {
    try {
      if (!isConfigLoaded()) {
        loadConfig().then(ok => {
          if (ok) open(); else assetFailure(new Error('自定义泡泡配置读取失败'));
        });
        return;
      }
      closeRolePanel();
      closeAudioGroupPanel();
      const draft = draftOf(getConfig(), subscription());
      state.lib = draft.library;
      state.items = draft.items;
      state.tapAdvance = draft.tapAdvance;
      getAdvance().setValue(state.tapAdvance);
      state.editorSnap = JSON.stringify([state.items, state.lib, state.tapAdvance]);
      render();
      getMask().style.display = 'flex';
    } catch {}
  }

  function close() {
    getMask().style.display = 'none';
    getAdvance().hideHelp();
    state.editorSnap = null;
  }

  function reset() {
    showConfirm(subscription() ? '恢复为默认 Codex 订阅气泡?' : '恢复为默认序列(首次=余额内容,再次=随机语句)?', () => {
      state.items = defaultQueue();
      state.tapAdvance = false;
      getAdvance().setValue(false);
      render();
    });
  }

  function save() {
    try {
      const doSave = () => {
        saveConfig(draftSave(state.items, state.lib, getConfig(), subscription(), state.tapAdvance), ok => {
          if (ok !== false) close();
        });
      };
      if (dirty()) showConfirm('保存当前点击序列?(未逐泡编辑过的行将按默认内容保存,保存后即生效)', doSave); else doSave();
    } catch {}
  }

  return { renderFirst, renderMore, dropToEnd, addMore, render, dirty, open, close, reset, save };
}
