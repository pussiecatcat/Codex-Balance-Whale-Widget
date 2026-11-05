import test from 'node:test';
import assert from 'node:assert/strict';
import { createMenuControls } from '../desktop/ui/features/widget/menu-controls.js';

function element(tag = 'div') {
  return {
    tagName: tag, className: '', title: '', type: '', value: '', style: {}, dataset: {}, children: [], listeners: {},
    appendChild(child) { this.children.push(child); return child; },
    addEventListener(type, fn) { this.listeners[type] = fn; },
    fire(type) { this.listeners[type]?.({ stopPropagation() {} }); },
  };
}

test('menu controls map the size slider and wire the audio and ledger buttons', () => {
  const document = { createElement: element, body: element('body') };
  const positioner = element(), scales = [], toggles = [], imports = [], ledgers = [];
  const controls = createMenuControls({
    document, positioner, minScale: 0.5, maxScale: 2.5,
    setScale: value => scales.push(value), refreshFlip: () => {},
    toggleAudioGroupPanel: () => toggles.push('audio'),
    openAudioGroupEditor: () => imports.push('import'),
    toggleUsagePanel: () => ledgers.push('ledger'),
  });
  controls.scaleInput.value = '2';
  controls.scaleInput.fire('input');
  assert.deepEqual(scales, ['2']);
  controls.audioGroupBtn.fire('click');
  controls.audioImportBtn.fire('click');
  controls.usageRecBtn.fire('click');
  assert.deepEqual(toggles, ['audio']);
  assert.deepEqual(imports, ['import']);
  assert.deepEqual(ledgers, ['ledger']);
  assert.equal(controls.audioGroupBtnLabel.textContent, '小黄鸭');
  assert.ok(document.body.children.includes(controls.audioGroupPanel));
});
