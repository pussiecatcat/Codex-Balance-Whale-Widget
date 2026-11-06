import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { createRequire } from 'node:module';
const { createSoundSettingsDomains } = createRequire(import.meta.url)('../desktop/settings-store.cjs');
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const catalogPath = path.join(root, 'desktop/ui/settings-catalog.js');

// The catalog is a plain browser script that also assigns module.exports, so it
// is loaded the same way tests/account-view.test.mjs loads its pure helpers.
const catalogSource = fs.readFileSync(catalogPath, 'utf8');
function loadCatalog() {
  const module = { exports: {} };
  vm.runInNewContext(catalogSource, { module, globalThis: {}, console });
  return module.exports;
}

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

test('defaultSource points at a file and symbol that exist, and matches the runtime default', async () => {
  const catalog = loadCatalog();
  for (const field of catalog.fields) {
    const match = String(field.defaultSource).match(/^([^#]+)#(\S+)$/);
    assert.ok(match, `${field.id} 的 defaultSource 必须是 file#symbol，实际 ${field.defaultSource}`);
    const relative = match[1], expression = match[2];
    const file = path.join(root, relative);
    assert.ok(fs.existsSync(file), `${field.id} 的 defaultSource 指向不存在的文件 ${relative}`);
    const resolved = await resolveDefault(file, expression);
    if (resolved.kind === 'symbol') continue;
    assert.equal(resolved.kind, 'value', `${field.id} 无法解析 ${field.defaultSource}：${resolved.reason || ''}`);
    const expected = resolved.value;
    // null 表示「没有固定默认值 / 跟随其它设置」，由 help 说明，不做数值比对。
    if (field.defaultValue === null || field.defaultValue === undefined) continue;
    if (typeof expected === 'number' && field.scale) {
      assert.equal(field.defaultValue * field.scale, expected, `${field.id} 的界面默认值 × scale 与运行时常量不一致`);
      continue;
    }
    if (expected && typeof expected === 'object') {
      if (field.defaultValue && typeof field.defaultValue === 'object') {
        assert.deepEqual(JSON.parse(JSON.stringify(field.defaultValue)), JSON.parse(JSON.stringify(expected)),
          `${field.id} 的默认对象与运行时常量不一致`);
      }
      continue;
    }
    if (typeof field.defaultValue !== typeof expected) continue;
    assert.equal(field.defaultValue, expected, `${field.id} 的 defaultValue 与 ${field.defaultSource} 不一致`);
  }
});

// 解析 defaultSource：能导入的模块直接取值；IIFE 脚本在 vm 里加载；
// 无法加载的（browser ESM / Electron 主进程）只核对符号确实出现在文件里。
async function resolveDefault(file, expression) {
  const relative = path.relative(root, file).split(path.sep).join('/');
  if (relative === 'desktop/ui/preferences-v3.js') {
    const sandbox = { window: {}, localStorage: { getItem: () => null, setItem: () => {} }, console };
    vm.runInNewContext(fs.readFileSync(file, 'utf8'), sandbox);
    return { kind: 'value', value: evaluateExpression(sandbox.window, expression) };
  }
  if (relative === 'desktop/main.cjs' || relative === 'assets/whale-widget.js' || relative === 'desktop/ui/money.js') {
    return symbolExists(file, expression);
  }
  try {
    const loaded = await import(pathToFileURL(file).href);
    return { kind: 'value', value: evaluateExpression(loaded, expression) };
  } catch (error) {
    return symbolExists(file, expression, error);
  }
}

function evaluateExpression(scope, expression) {
  const called = /^(\w+)\(\)(.*)$/.exec(expression);
  const plain = /^(\w+)(.*)$/.exec(expression);
  const match = called || plain;
  if (!match) return undefined;
  let value = called ? scope[match[1]]() : scope[match[1]];
  for (const key of match[2].split('.').filter(Boolean)) value = value?.[key];
  return value;
}

function symbolExists(file, expression, reason) {
  const symbol = String(expression).split(/[.(]/)[0];
  const text = fs.readFileSync(file, 'utf8');
  assert.ok(symbol && text.includes(symbol), `${path.relative(root, file)} 中找不到符号 ${symbol}`);
  return { kind: 'symbol', reason };
}

test('dynamic entries enumerate their sub-fields instead of standing in for a whole editor', () => {
  const catalog = loadCatalog();
  for (const field of catalog.fields.filter(f => f.pattern)) {
    assert.ok(field.subFields.length >= 2, `${field.id} 是动态条目，必须列出子字段`);
    const keys = field.subFields.map(sub => sub.key);
    assert.equal(new Set(keys).size, keys.length, `${field.id} 的子字段 key 重复`);
  }
});

test('editor routes are explicit and every one exists in the widget', async () => {
  const { EDITOR_ROUTES } = await import(pathToFileURL(path.join(root, 'desktop/ui/features/widget/editor-routes.js')).href);
  const needsEditor = field => !!field.bridged || !!field.editor
    || ['role', 'snap', 'group', 'message', 'action'].includes(field.type);
  for (const field of loadCatalog().fields) {
    if (!needsEditor(field)) continue;
    assert.ok(field.editor && field.editor.name, `${field.id} 需要编辑器，但没有显式声明 editor.name`);
    assert.ok(EDITOR_ROUTES.includes(field.editor.name),
      `${field.id} 的编辑器 ${field.editor.name} 没有在挂件的 EDITOR_ROUTES 里注册`);
  }
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
  // desktop/main.cjs builds the store's domains map; the catalog must not point
  // at a domain that does not exist or the save silently has nowhere to go.
  const mainSource = fs.readFileSync(path.join(root, 'desktop/main.cjs'), 'utf8');
  const registered = new Set(
    [...mainSource.matchAll(/^        (\w+): \{/gm)].map(match => match[1]),
  );
  for (const domain of Object.keys(createSoundSettingsDomains({}))) registered.add(domain);
  assert.ok(registered.size >= 8, `未能从 main.cjs 解析出设置域，实际 ${registered.size} 个`);
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
  const window = { WhaleSettingsCatalog: loadCatalog() };
  vm.runInNewContext(fs.readFileSync(path.join(root, 'desktop/ui/settings-pages.js'), 'utf8'), { window });
  const pages = window.WhaleSettingsPages;
  const field = window.WhaleSettingsCatalog.byId.get('usage.taskEndSel');
  const values = { usage: { taskEnd: { on: true, sel: 'old', vol: .4 } } };
  assert.equal(pages.readValue(field, values), 'old');
  const patch = JSON.parse(JSON.stringify(pages.toPatch(field, 'preset:duck:press', values)));
  assert.deepEqual(patch.usage.taskEnd, { on: true, sel: 'preset:duck:press', vol: .4 });
  assert.equal(pages.editorFor(window.WhaleSettingsCatalog.byId.get('api.models')).name, 'api');
  assert.equal(pages.editorFor(window.WhaleSettingsCatalog.byId.get('media.audio')).name, 'sound');
  assert.equal(pages.editorFor(window.WhaleSettingsCatalog.byId.get('ui.pos')), null, '位置字段只提供复位按钮，不打开编辑器');
});
