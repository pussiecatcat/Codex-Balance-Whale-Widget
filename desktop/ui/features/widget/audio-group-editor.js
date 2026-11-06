import { sound as defaultSound } from '../../services/sound.js';
import { openOver } from '../../services/layers.js';

// The audio group editor: open/hide state, press/release preview playback and
// the save transaction. The DOM and slot panel are built by the caller; this
// module owns the values, preview players and the feature-dialog promise.
export function createAudioGroupEditor({
  sound = defaultSound, requestJson, url, elements, getGroups, setGroups, getFragments, setFragments,
  getPress, setPress, getRelease, setRelease, getSoundSet, setSoundSet,
  getVolume, renderGroups, refreshTaskEnd, applySoundSet, slotPanel,
  startImport, requireSaved, assetFailure,
}) {
  let editingId = null;
  let session = null;
  let previewEpoch = 0;
  let pressing = false;
  let pressEnded = false;
  let releasePlayed = false;

  function stopPreview() {
    previewEpoch++;
    sound.stop('audio-group-preview');
    pressing = false;
    pressEnded = false;
    releasePlayed = false;
  }

  function ensurePreview() {
    stopPreview();
    sound.warm({ kind: 'fragment', id: getPress() || '' }).catch(() => {});
    sound.warm({ kind: 'fragment', id: getRelease() || '' }).catch(() => {});
    return true;
  }

  function playRelease() {
    if (releasePlayed || !getRelease()) return;
    releasePlayed = true;
    sound.preview({ kind: 'fragment', id: getRelease() }, getVolume(), { channel: 'audio-group-preview' });
  }

  function previewDown() {
    stopPreview();
    pressing = true;
    const epoch = previewEpoch;
    if (!getPress()) { pressEnded = true; return; }
    sound.preview({ kind: 'fragment', id: getPress() }, getVolume(), {
      channel: 'audio-group-preview',
      onended: () => {
        if (epoch !== previewEpoch) return;
        pressEnded = true;
        if (!pressing) playRelease();
      },
    });
  }

  function previewUp() {
    if (!pressing) return;
    pressing = false;
    if (pressEnded || !getPress()) playRelease();
  }

  function open(group) {
    editingId = group && group.id ? group.id : null;
    elements.title.textContent = editingId ? '编辑音效组' : '新建音效组';
    elements.name.value = group && group.name ? group.name : '';
    const isNew = !(group && group.id);
    setPress(group && typeof group.press === 'string' ? group.press : isNew ? '' : 'ya1');
    setRelease(group && typeof group.release === 'string' ? group.release : isNew ? '' : 'ya2');
    slotPanel.refresh();
    ensurePreview();
    elements.mask.style.display = 'flex';
  }

  function hide(outcome, detail) {
    stopPreview();
    elements.mask.style.display = 'none';
    editingId = null;
    slotPanel.close();
    if (session) {
      const current = session;
      session = null;
      elements.mask.style.zIndex = current.zIndex;
      current.resolve(outcome === 'saved' ? Object.assign({ status: 'saved' }, detail || {}) : { status: 'cancelled' });
    }
  }

  function openForFeature(options = {}) {
    if (session) {
      const previous = session;
      session = null;
      elements.mask.style.zIndex = previous.zIndex;
      previous.resolve({ status: 'cancelled' });
    }
    const group = options.groupId ? getGroups().find(item => item.id === options.groupId) || null : null;
    return new Promise(resolve => {
      session = { resolve, zIndex: elements.mask.style.zIndex };
      openOver(options.parentElement || null, elements.mask);
      open(group);
    });
  }

  function save() {
    try {
      stopPreview();
      const name = (elements.name.value || '').trim().slice(0, 20);
      if (!name) { elements.name.focus(); return; }
      requestJson(url, { method: 'POST', body: { action: 'save-group', id: editingId || '', name,
        press: getPress() || '', release: getRelease() || '' } }).then(data => {
        requireSaved(data);
        if (!data || !data.ok || !Array.isArray(data.groups)) return;
        const openedFromFeature = !!session;
        let selectedId = editingId || '';
        setGroups(data.groups);
        if (Array.isArray(data.fragments)) setFragments(data.fragments);
        sound.reload({ catalog: { groups: getGroups(), fragments: getFragments() } });
        renderGroups();
        refreshTaskEnd();
        if (!editingId) {
          const newest = data.groups.filter(item => !item.preset)
            .sort((a, b) => (b.pinnedAt || 0) - (a.pinnedAt || 0))[0];
          if (newest) {
            selectedId = newest.id;
            if (!openedFromFeature) setSoundSet(newest.id);
          }
        } else if (!openedFromFeature && getSoundSet() === editingId) {
          try { applySoundSet(); } catch (error) { assetFailure(error); }
        }
        hide('saved', { selectedGroupId: selectedId, catalog: { groups: getGroups().slice(), fragments: getFragments().slice() } });
      }).catch(assetFailure);
    } catch (error) { assetFailure(error); }
  }

  elements.cancel.addEventListener('click', () => hide());
  elements.play.addEventListener('pointerdown', event => { event.stopPropagation(); previewDown(); });
  elements.play.addEventListener('pointerup', event => { event.stopPropagation(); previewUp(); });
  elements.play.addEventListener('pointercancel', previewUp);
  elements.play.addEventListener('pointerleave', previewUp);
  elements.save.addEventListener('click', save);
  elements.mask.addEventListener('click', event => {
    if (event.target === elements.mask || event.target === elements.card) slotPanel.close();
  });
  elements.pressImport.addEventListener('click', () => startImport('press'));
  elements.releaseImport.addEventListener('click', () => startImport('release'));

  return { open, hide, openForFeature, save, previewDown, previewUp, ensurePreview };
}
