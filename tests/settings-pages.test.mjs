import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const catalog = (() => {
  const module = { exports: {} };
  vm.runInNewContext(fs.readFileSync(path.join(root, 'desktop/ui/settings-catalog.js'), 'utf8'),
    { module, globalThis: {}, console });
  return module.exports;
})();
const pages = (() => {
  const window = { WhaleSettingsCatalog: catalog };
  vm.runInNewContext(fs.readFileSync(path.join(root, 'desktop/ui/settings-pages.js'), 'utf8'), { window });
  return window.WhaleSettingsPages;
})();

// 直接编辑（不走编辑器）的字段才参与读写往返。
const directFields = () => catalog.fields.filter(field =>
  field.type !== 'locked' && field.type !== 'note' && field.type !== 'combo'
  && !field.private && !field.bridged && !field.editor
  && !['role', 'snap', 'position', 'group', 'message', 'action'].includes(field.type));

const plain = value => JSON.parse(JSON.stringify(value));

function storedValueFor(field) {
  return field.scale && typeof field.defaultValue === 'number' ? field.defaultValue * field.scale : field.defaultValue;
}

test('toPatch(readValue(field)) round-trips every directly edited field', () => {
  for (const field of directFields()) {
    // 没有固定默认值的字段（null）不在这里造值；它们有单独语义测试。
    if (field.defaultValue === null || field.defaultValue === undefined) continue;
    const stored = storedValueFor(field);
    const base = { [field.domain]: {} };
    for (const keyPath of field.key.split(' / ')) {
      const parts = keyPath.split('.');
      if (parts.length === 1) base[field.domain][keyPath] = stored;
      else {
        const [root, key] = parts;
        base[field.domain][root] = { ...(base[field.domain][root] || {}), [key]: key === 'volSet' ? true : stored };
      }
    }
    const read = pages.readValue(field, base);
    const patch = pages.toPatch(field, read, base);
    const merged = { ...base, [field.domain]: { ...base[field.domain], ...(patch[field.domain] || {}) } };
    const again = pages.readValue(field, merged);
    assert.deepEqual(JSON.parse(JSON.stringify(again)), JSON.parse(JSON.stringify(read)),
      `${field.id} 写入后再读不一致（${JSON.stringify(read)} → ${JSON.stringify(again)}）`);
  }
});

test('the millisecond field reads as seconds and writes back milliseconds', () => {
  const field = catalog.byId.get('size.turnCostCloseMs');
  assert.equal(field.scale, 1000);
  const stored = { size: { turnCostCloseMs: 5000 } };
  assert.equal(pages.readValue(field, stored), 5, '存储 5000 毫秒应显示 5 秒');
  const patch = pages.toPatch(field, 8, stored);
  assert.equal(patch.size.turnCostCloseMs, 8000, '填 8 秒应写入 8000 毫秒');
});

test('restoring "follow click volume" clears volSet instead of writing a fake volume', () => {
  const field = catalog.byId.get('usage.taskEndVol');
  assert.equal(field.defaultValue, null);
  const patch = pages.toPatch(field, null, { usage: { taskEnd: { on: true, vol: 0.6, volSet: true } } });
  assert.deepEqual(plain(patch.usage.taskEnd), { on: true, vol: 0.6, volSet: false });
});

test('the completion combo default is bubble-only, matching the runtime defaults', () => {
  const field = catalog.byId.get('usage.taskEndOn');
  assert.equal(field.defaultValue, 'bubble');
  const patch = pages.toPatch(field, field.defaultValue, {});
  assert.deepEqual(plain(patch), { size: { turnCostOn: true }, usage: { taskEnd: { on: false } } });
});

test('nested patches keep sibling fields that were not edited', () => {
  const field = catalog.byId.get('usage.taskEndSel');
  const base = { usage: { taskEnd: { on: true, sel: 'old', vol: 0.4, volSet: true } } };
  assert.equal(pages.readValue(field, base), 'old');
  const patch = pages.toPatch(field, 'preset:duck:press', base);
  assert.deepEqual(plain(patch.usage.taskEnd), { on: true, sel: 'preset:duck:press', vol: 0.4, volSet: true });
});
