import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
const { createSoundSettingsDomains } = createRequire(import.meta.url)('../desktop/settings-store.cjs');
const { createSettingsDomains } = createRequire(import.meta.url)('../desktop/settings-domains.cjs');
import { fileURLToPath, pathToFileURL } from 'node:url';
import settingsCatalog from '../desktop/ui/settings-catalog.js';
import { readValue, toPatch, editorFor } from '../desktop/ui/settings-pages.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const loadCatalog = () => settingsCatalog;

test('catalog loads and exposes pages, fields and helpers', () => {
  const catalog = loadCatalog();
  assert.ok(catalog.pages.length, 'must declare pages');
  assert.ok(catalog.fields.length, 'must declare fields');
  assert.equal(typeof catalog.forPage, 'function');
  assert.equal(typeof catalog.tier1, 'function');
  assert.equal(typeof catalog.bridged, 'function');
  assert.equal(catalog.helpKeys.join(','), 'use,adjust,apply,recommend');
});

test('every field passes the catalog self-check', () => {
  // validate() 在 vm 沙箱里返回的 Array 与本 realm 的 Array 原型不同，
  // 直接 deepEqual 会因原型不一致而误判，所以先转成普通数据再比较。
  const problems = JSON.parse(JSON.stringify(loadCatalog().validate()));
  assert.deepEqual(problems, [], '设置目录存在未完成的字段：\n' + problems.map(p => `${p.id}：${p.problem}`).join('\n'));
});

test('the generic-help matcher does not fire on ordinary Chinese words', () => {
  // 标记必须是不会出现在正常说明里的多字短语。早期版本用「略」做单字标记，
  // 结果把「策略」「忽略」全部误判成占位文案。
  const catalog = loadCatalog();
  for (const marker of catalog.genericHelpMarkers) {
    assert.ok(marker.length >= 2, `标记「${marker}」过短，容易误伤正常文案`);
  }
  assert.equal(catalog.containsGeneric('缩放策略不改变清晰度', '调整此项'), false);
  assert.equal(catalog.containsGeneric('可以忽略这一项', '调整此项'), false);
  assert.equal(catalog.containsGeneric('详见源码', '详见源码'), true);
  assert.equal(catalog.containsGeneric('调整此项即可', '调整此项'), true);
});

test('every help entry is specific, not a generic fallback', () => {
  const catalog = loadCatalog();
  for (const field of catalog.fields) {
    for (const key of catalog.helpKeys) {
      const text = String(field.help[key] || '').trim();
      assert.ok(text.length > 0, `${field.id} 的 help.${key} 不能为空`);
      // 「什么时候生效」允许一句话；用途、怎么调和推荐必须说清实质内容。
      assert.ok(
        text.length >= catalog.helpMinLength[key],
        `${field.id} 的 help.${key} 过短（${text.length} < ${catalog.helpMinLength[key]}），疑似占位`,
      );
    }
    for (const key of catalog.helpKeys) {
      for (const marker of catalog.genericHelpMarkers) {
        assert.ok(
          !catalog.containsGeneric(String(field.help[key]), marker),
          `${field.id} 的 help.${key} 含通用兜底文案「${marker}」`,
        );
      }
    }
  }
});

async function resolveDefaultSource(reference) {
  const match = String(reference).match(/^([^#]+)#([A-Za-z_$][\w$]*)(\(\))?((?:\.[A-Za-z_$][\w$]*)*)$/);
  assert.ok(match, `defaultSource 必须是 file#export.path：${reference}`);
  const file = path.resolve(root, match[1]);
  assert.ok(file.startsWith(root + path.sep) && fs.existsSync(file), `defaultSource 文件不存在：${reference}`);
  const module = await import(pathToFileURL(file).href);
  assert.ok(Object.hasOwn(module, match[2]), `defaultSource 导出不存在：${reference}`);
  let value = module[match[2]];
  if (match[3]) {
    assert.equal(typeof value, 'function', reference);
    value = value();
  }
  for (const key of match[4].split('.').filter(Boolean)) {
    assert.ok(value != null && Object.hasOwn(value, key), `defaultSource 字段不存在：${reference}`);
    value = value[key];
  }
  return value;
}

test('defaultSource resolves a real exported default or its factory', async () => {
  for (const field of loadCatalog().fields) await resolveDefaultSource(field.defaultSource);
  await assert.rejects(resolveDefaultSource('runtime/size-settings.mjs#MISSING_DEFAULT'), /导出不存在/);
  await assert.rejects(resolveDefaultSource('runtime/size-settings.mjs#SIZE_SETTINGS_DEFAULTS.missing'), /字段不存在/);
});

test('provider settings describe the merged provider store', () => {
  for (const field of loadCatalog().fields.filter(field => ['api', 'apiModels'].includes(field.domain))) {
    assert.match(field.store, /^providers\.json → (codexApi|diyModels)$/);
  }
});

// 只对「值控件」逐字段比对：组、编辑器入口、位置等条目的 defaultValue 是给人看的摘要
// 或 null（由编辑器/模板决定），对不上运行时对象是预期的。
const VALUE_TYPES = new Set(['number', 'range', 'boolean', 'select', 'text']);
test('value controls default to exactly what the runtime source exports', async () => {
  for (const field of loadCatalog().fields) {
    const expected = await resolveDefaultSource(field.defaultSource);
    if (!VALUE_TYPES.has(field.type) || field.defaultValue === null || field.defaultValue === undefined) continue;
    if (typeof expected === 'number' && field.scale) {
      const stored = Math.round((field.defaultValue * field.scale + (field.offset || 0)) * 1e9) / 1e9;
      assert.equal(stored, expected, `${field.id} 的界面默认值换算后与 ${field.defaultSource} 不一致`);
      continue;
    }
    if (typeof field.defaultValue !== typeof expected) continue;
    assert.equal(field.defaultValue, expected, `${field.id} 的 defaultValue 与 ${field.defaultSource} 不一致`);
  }
});

test('dynamic entries enumerate their sub-fields instead of standing in for a whole editor', () => {
  const catalog = loadCatalog();
  for (const field of catalog.fields.filter(f => f.pattern)) {
    assert.ok(field.subFields.length >= 2, `${field.id} 是动态条目，必须列出子字段`);
    const keys = field.subFields.map(sub => sub.key);
    assert.equal(new Set(keys).size, keys.length, `${field.id} 的子字段 key 重复`);
  }
});

test('editor routes are explicit and every one exists in the widget', async () => {
  const { EDITOR_ROUTES } = await import(pathToFileURL(path.join(root, 'desktop/ui/shared/editor-routes.js')).href);
  const needsEditor = field => !!field.bridged || !!field.editor
    || ['role', 'snap', 'group', 'message', 'action'].includes(field.type);
  for (const field of loadCatalog().fields) {
    if (!needsEditor(field)) continue;
    assert.ok(field.editor && field.editor.name, `${field.id} 需要编辑器，但没有显式声明 editor.name`);
    assert.ok(EDITOR_ROUTES.includes(field.editor.name),
      `${field.id} 的编辑器 ${field.editor.name} 没有在挂件的 EDITOR_ROUTES 里注册`);
  }
});

test('API and Codex subscription task-end templates have separate settings editors', () => {
  const api = settingsCatalog.byId.get('usage.reminderModules');
  const subscription = settingsCatalog.byId.get('usage.subscriptionReminderModules');
  assert.equal(api.editor.args.templateMode, 'api');
  assert.equal(subscription.editor.args.templateMode, 'subscription');
  assert.notEqual(api.subFields[0].key, subscription.subFields[0].key);
});

test('default values use the type the control expects', () => {
  for (const field of loadCatalog().fields) {
    if (field.defaultValue === null || field.defaultValue === undefined) continue;
    if (field.type === 'number' || field.type === 'range') {
      assert.equal(typeof field.defaultValue, 'number', `${field.id} 是数字控件，默认值必须是数字`);
      if (field.min !== undefined) assert.ok(field.defaultValue >= field.min, `${field.id} 默认值低于 min`);
      if (field.max !== undefined) assert.ok(field.defaultValue <= field.max, `${field.id} 默认值高于 max`);
    }
    if (field.type === 'boolean') assert.equal(typeof field.defaultValue, 'boolean', `${field.id} 是勾选框，默认值必须是布尔值`);
    if (field.type === 'select' && !field.optionsSource && Array.isArray(field.options)) {
      const values = field.options.map(option => option.value);
      assert.ok(values.includes(field.defaultValue), `${field.id} 的默认值不在选项里（${field.defaultValue}）`);
    }
    if (field.type === 'combo') {
      assert.ok(['off', 'bubble', 'both'].includes(field.defaultValue), `${field.id} 的组合默认值非法（${field.defaultValue}）`);
    }
  }
});
test('the level-1 tier exposes the everyday controls the UX plan requires', () => {
  const ids = loadCatalog().tier1().map(field => field.id);
  for (const required of [
    'ui.accountView',   // 查看数据
    'ui.role',          // 角色
    'size.scale',       // 大小
    'size.sound',       // 点击音效
    'usage.taskEndOn',  // 完成提醒
    'size.bubbleOn',    // 气泡
  ]) {
    assert.ok(ids.includes(required), `一级菜单缺少 ${required}`);
  }
});

test('the level-2 pages cover all six categories', () => {
  const catalog = loadCatalog();
  for (const page of catalog.pages) {
    assert.ok(page.custom || catalog.forPage(page.id).length > 0, `分类 ${page.id} 没有任何字段`);
  }
});

test('each field names where it is stored and how it is read and written', () => {
  for (const field of loadCatalog().fields) {
    assert.ok(field.store, `${field.id} 缺少 store`);
    assert.ok(field.read, `${field.id} 缺少 read`);
    assert.ok(field.write, `${field.id} 缺少 write`);
    assert.ok(['immediate', 'after-save', 'restart'].includes(field.hotReload), `${field.id} 的 hotReload 取值非法`);
    assert.ok(field.key, `${field.id} 缺少 key`);
  }
});

test('every field belongs to a storage domain the settings store actually registers', () => {
  // desktop/settings-domains.cjs builds the store's domain map; the catalog must
  // not point at a domain that does not exist or the save silently has nowhere
  // to go.
  const domains = createSettingsDomains({
    dispatcher: { soundSettings: {} }, values: () => ({}),
    uiStore: { setKeys() {}, flush() {} }, read: () => ({}), save() {}, dataDir: '/',
    createSoundSettingsDomains,
  });
  const registered = new Set(Object.keys(domains));
  assert.ok(registered.size >= 8, `未能构建设置域，实际 ${registered.size} 个`);
  for (const field of loadCatalog().fields) {
    assert.ok(registered.has(field.domain), `${field.id} 的 domain ${field.domain} 没有在主进程注册`);
  }
});

test('fields that claim to be editable declare a write path', () => {
  for (const field of loadCatalog().fields) {
    if (field.type === 'locked') continue;
    assert.ok(field.write && field.write !== '—', `${field.id} 是可编辑字段，必须声明修改入口`);
  }
});


test('nested settings preserve sibling fields and editor destinations are explicit', () => {
  const pages = { readValue, toPatch, editorFor };
  const field = settingsCatalog.byId.get('usage.taskEndSel');
  const values = { usage: { taskEnd: { on: true, sel: 'old', vol: .4 } } };
  assert.equal(pages.readValue(field, values), 'old');
  const patch = JSON.parse(JSON.stringify(pages.toPatch(field, 'preset:duck:press', values)));
  assert.deepEqual(patch.usage.taskEnd, { on: true, sel: 'preset:duck:press', vol: .4 });
  assert.equal(pages.editorFor(settingsCatalog.byId.get('api.models')).name, 'api');
  assert.equal(pages.editorFor(settingsCatalog.byId.get('media.audio')).name, 'sound');
  for (const id of ['media.roles', 'media.bubbleImgs']) assert.equal(pages.editorFor(settingsCatalog.byId.get(id)).name, 'resources');
  assert.equal(pages.editorFor(settingsCatalog.byId.get('media.workshop')).name, 'workshop');
  assert.equal(pages.editorFor(settingsCatalog.byId.get('ui.pos')), null, '位置字段只提供复位按钮，不打开编辑器');
});
