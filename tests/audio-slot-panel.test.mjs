import test from 'node:test';
import assert from 'node:assert/strict';
import { createAudioSlotPanel } from '../desktop/ui/features/widget/audio-slot-panel.js';

function element(tag = 'div') {
  const node = {
    tagName: tag, className: '', textContent: '', title: '', type: '', style: {}, children: [], listeners: {},
    set innerHTML(value) { if (value === '') this.children = []; },
    appendChild(child) { this.children.push(child); return child; },
    setAttribute() {}, addEventListener(type, fn) { this.listeners[type] = fn; },
    click() { this.listeners.click?.({ stopPropagation() {} }); },
    getBoundingClientRect() { return { left: 20, bottom: 40, width: 120 }; },
  };
  return node;
}

test('the slot panel lists fragments, applies one and deletes only custom fragments', () => {
  let press = 'ya1', release = '', previews = 0;
  const deleted = [];
  const pressBtn = element(), releaseBtn = element();
  const pressPanel = element(), releasePanel = element();
  const panel = createAudioSlotPanel({
    document: { createElement: element },
    viewport: () => ({ w: 400, h: 300 }),
    getFragments: () => [{ id: 'ya1', name: '鸭1', preset: true }, { id: 'f1', name: '自定义' }],
    getPress: () => press, setPress: value => { press = value; },
    getRelease: () => release, setRelease: value => { release = value; },
    getPressBtn: () => pressBtn, getReleaseBtn: () => releaseBtn,
    getPressPanel: () => pressPanel, getReleasePanel: () => releasePanel,
    makeNameCell: () => element(), bindNameMarquee: () => {},
    previewEnsure: () => { previews += 1; },
    deleteFragment: (slot, id) => deleted.push([slot, id]),
  });
  panel.refresh();
  assert.equal(pressBtn.textContent, '鸭1');
  assert.equal(releaseBtn.textContent, '留空·不发声');

  panel.toggle('press');
  assert.equal(pressPanel.style.display, 'block');
  assert.equal(pressPanel.children.length, 3);
  pressPanel.children[2].click();
  assert.equal(press, 'f1');
  assert.equal(pressPanel.style.display, 'none');
  assert.equal(previews, 1);

  panel.toggle('press');
  const custom = pressPanel.children[2];
  custom.children.find(child => child.className === 'dshwv-audiodel').click();
  assert.deepEqual(deleted, [['press', 'f1']]);
});
