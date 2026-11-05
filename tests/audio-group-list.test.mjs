import test from 'node:test';
import assert from 'node:assert/strict';
import { createAudioGroupList } from '../desktop/ui/features/widget/audio-group-list.js';

function element(tag = 'div') {
  const node = {
    tagName: tag, className: '', textContent: '', title: '', type: '', children: [], listeners: {},
    set innerHTML(value) { if (value === '') this.children = []; },
    appendChild(child) { this.children.push(child); return child; },
    setAttribute() {}, addEventListener(type, fn) { this.listeners[type] = fn; },
    click() { this.listeners.click?.({ stopPropagation() {} }); },
  };
  return node;
}

test('the audio list renders groups, selects a group and sends pin requests', async () => {
  let groups = [{ id: 'duck', name: '小黄鸭', preset: true }, { id: 'custom', name: '自定义', pinned: false }];
  let selected = 'duck', closed = 0, refreshed = 0;
  const requests = [];
  const panel = element();
  const list = createAudioGroupList({
    document: { createElement: element }, requestJson: async (url, options) => {
      requests.push(options.body);
      groups = groups.map(group => group.id === options.body.id ? { ...group, pinned: options.body.pinned } : group);
      return { ok: true, groups };
    }, url: '/audio',
    getGroups: () => groups, setGroups: value => { groups = value; },
    getSoundSet: () => selected, setSoundSet: value => { selected = value; },
    getPanel: () => panel, closePanel: () => { closed += 1; },
    makeNameCell: () => element(), bindNameMarquee: () => {},
    requireSaved: value => value, assetFailure: () => {}, showConfirm: (message, run) => run(),
    refreshTaskEnd: () => { refreshed += 1; },
  });
  list.render();
  assert.equal(panel.children.length, 2);
  panel.children[1].click();
  assert.equal(selected, 'custom');
  assert.equal(closed, 1);

  await panel.children[1].children.find(child => child.className.startsWith('dshwv-audiopin')).click();
  await new Promise(resolve => setTimeout(resolve, 0));
  assert.deepEqual(requests.at(-1), { action: 'pin-group', id: 'custom', pinned: true });
  assert.equal(refreshed, 1);
});
