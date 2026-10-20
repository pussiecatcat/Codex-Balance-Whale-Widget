#!/usr/bin/env node
// 把 desktop/ui/settings-catalog.js 里的字段目录写进 docs/CONFIGURATION.md。
//
// 界面控件、`!` 说明和本文件共用同一份目录，所以三者不会各写各的。
// 改完目录后运行 `node scripts/generate-config-doc.mjs` 重新生成；
// 加 --check 只校验是否过期，CI 和验收用这个模式。
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const catalogFile = path.join(root, 'desktop/ui/settings-catalog.js');
const docFile = path.join(root, 'docs/CONFIGURATION.md');

const BEGIN = '<!-- BEGIN GENERATED: settings-catalog -->';
const END = '<!-- END GENERATED: settings-catalog -->';

function loadCatalog() {
  const module = { exports: {} };
  vm.runInNewContext(fs.readFileSync(catalogFile, 'utf8'), { module, globalThis: {}, console });
  return module.exports;
}

const escape = value => String(value ?? '').replace(/\|/g, '\\|').replace(/\n/g, ' ');

function typeText(field) {
  const bits = [field.type];
  if (field.unit) bits.push(`单位 ${field.unit}`);
  if (Number.isFinite(field.min) || Number.isFinite(field.max)) {
    bits.push(`范围 ${Number.isFinite(field.min) ? field.min : '不限'} – ${Number.isFinite(field.max) ? field.max : '不限'}`);
  }
  if (Number.isFinite(field.step)) bits.push(`步长 ${field.step}`);
  if (Array.isArray(field.options) && field.options.length) {
    bits.push('选项 ' + field.options.map(option => option.label).join(' / '));
  }
  return bits.join('，');
}

function render(catalog) {
  const lines = [];
  lines.push(BEGIN);
  lines.push('');
  lines.push('> 本节由 `node scripts/generate-config-doc.mjs` 从 `desktop/ui/settings-catalog.js` 生成，');
  lines.push('> 不要手工编辑。改了目录请重新运行生成器，CI 用 `--check` 校验是否过期。');
  lines.push('');
  lines.push(`当前共 ${catalog.fields.length} 个条目，其中一级快捷菜单直接展示 ${catalog.tier1().length} 个，` +
    `需要画布、只能回到挂件里细调的有 ${catalog.bridged().length} 个。`);
  lines.push('');
  lines.push('## 索引');
  lines.push('');
  lines.push('| 配置 ID | 名称 | 分类 | 层级 | 存储域 | 存储键 |');
  lines.push('| --- | --- | --- | --- | --- | --- |');
  for (const field of catalog.fields) {
    const page = catalog.pages.find(item => item.id === field.page);
    const tier = field.tier === 1 ? '一级' : '二级';
    lines.push(`| \`${field.id}\` | ${escape(field.label)} | ${escape(page ? page.label : field.page)} | ${tier} | ${field.domain} | \`${escape(field.key)}\` |`);
  }
  lines.push('');
  lines.push('## 逐字段契约');
  lines.push('');
  for (const page of catalog.pages) {
    const fields = catalog.forPage(page.id);
    if (!fields.length) continue;
    lines.push(`### ${page.label}（\`${page.id}\`）`);
    lines.push('');
    lines.push(`${page.hint}。`);
    lines.push('');
    for (const field of fields) {
      lines.push(`#### \`${field.id}\` — ${field.label}`);
      lines.push('');
      lines.push(`- **用途**：${field.purpose}`);
      lines.push(`- **类型**：${typeText(field)}`);
      lines.push(`- **默认值**：${escape(field.defaultValue)}（来源 \`${field.defaultSource}\`）`);
      lines.push(`- **存储**：\`${escape(field.store)}\` 的 \`${escape(field.key)}\``);
      lines.push(`- **读取**：\`${field.read}\``);
      lines.push(`- **修改**：\`${field.write}\``);
      if (Array.isArray(field.dependsOn) && field.dependsOn.length) {
        lines.push(`- **依赖**：${field.dependsOn.map(id => `\`${id}\``).join('、')}`);
      }
      lines.push(`- **空值**：${field.emptyValue}`);
      lines.push(`- **生效**：${{ immediate: '立即生效', 'after-save': '保存后用于下一次', restart: '需要重载后生效' }[field.hotReload] || field.hotReload}`);
      if (field.private) lines.push('- **私密**：该字段不返回真实值，界面只显示「已配置」标记，提交时留空表示保留');
      if (field.bridged) lines.push('- **细调位置**：复杂编辑器仍在挂件自身的弹层中打开，本页只显示参数摘要与「回到挂件细调」');
      if (field.comboOf) lines.push(`- **组合字段**：由 ${field.comboOf.map(id => `\`${id}\``).join(' + ')} 共同决定`);
      for (const sub of field.subFields || []) {
        lines.push(`  - 子字段 \`${sub.key}\` — ${sub.label}${sub.hasOriginal ? '（可选「现有音效」）' : ''}`);
      }
      lines.push('');
      lines.push(`**\`.help\`**`);
      lines.push('');
      lines.push(`- 有什么用：${field.help.use}`);
      lines.push(`- 怎么调：${field.help.adjust}`);
      lines.push(`- 什么时候生效：${field.help.apply}`);
      lines.push(`- 适合怎么选：${field.help.recommend}`);
      if (field.help.example) lines.push(`- 例子：${field.help.example}`);
      lines.push('');
    }
  }
  lines.push(END);
  return lines.join('\n');
}

const catalog = loadCatalog();
const problems = catalog.validate();
if (problems.length) {
  for (const problem of problems) console.error(`设置目录不完整：${problem.id} — ${problem.problem}`);
  process.exit(1);
}

const generated = render(catalog);
const source = fs.readFileSync(docFile, 'utf8');
const start = source.indexOf(BEGIN);
const end = source.indexOf(END);

if (start < 0 || end < 0) {
  console.error(`docs/CONFIGURATION.md 缺少生成区块标记，无法写入：\n  ${BEGIN}\n  ${END}`);
  process.exit(1);
}

const next = source.slice(0, start) + generated + source.slice(end + END.length);

if (process.argv.includes('--check')) {
  if (next !== source) {
    console.error('docs/CONFIGURATION.md 的生成区块已过期，请运行：node scripts/generate-config-doc.mjs');
    process.exit(1);
  }
  console.log(`docs/CONFIGURATION.md 与设置目录一致（${catalog.fields.length} 个条目）。`);
} else {
  fs.writeFileSync(docFile, next);
  console.log(`已更新 docs/CONFIGURATION.md（${catalog.fields.length} 个条目）。`);
}
