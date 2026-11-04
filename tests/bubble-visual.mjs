#!/usr/bin/env node
// 气泡内容可读性的人工目视工具。
//
//   node tests/bubble-visual.mjs [输出目录]
//
// 用隔离数据启动真实 Electron，通过 __whaleRenderTest.scene() 渲染几种真实内容，
// 逐个截图，并打印每个气泡的实际缩放比与内容盒尺寸。用来看「字太小」到底
// 是内容被 fit 压缩了，还是内容盒本身设计得太小。
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const output = path.resolve(process.argv[2] || fs.mkdtempSync(path.join(os.tmpdir(), 'whale-bubble-visual-')));
fs.mkdirSync(output, { recursive: true });

// Electron 可执行文件按平台定位；WHALE_HOME 可指向隔离的运行时目录。
function electronExecutable() {
  const dataHome = process.env.WHALE_HOME || path.join(process.env.CODEX_HOME || path.join(os.homedir(), '.codex'), 'whale-widget');
  const dist = path.join(dataHome, 'desktop-runtime', 'node_modules', 'electron', 'dist');
  const candidates = process.platform === 'darwin'
    ? [path.join(dist, 'Electron.app', 'Contents', 'MacOS', 'Electron')]
    : process.platform === 'win32'
      ? [path.join(dist, 'electron.exe')]
      : [path.join(dist, 'electron')];
  const found = candidates.find(fs.existsSync);
  if (!found) throw new Error('未找到 Electron 可执行文件，请先安装桌面运行时到 ' + dataHome);
  return found;
}

const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'whale-bubble-visual-data-'));
fs.writeFileSync(path.join(dataDir, '.dshw-size.json'), JSON.stringify({ scale: 1.5, sound: false, vol: 0, bubbleOn: true, turnCostOn: true }));

const env = { ...process.env, WHALE_DESKTOP_TEST: '1', WHALE_BUBBLE_VISUAL: '1', WHALE_DESKTOP_VERIFY_DIR: output,
  // 与 tests/desktop-fixture.mjs 相同的假主机状态：attached 且存活，避免启动即退出。
  WHALE_INITIAL_HOST: JSON.stringify({ hostAlive: true, hostPid: 123456, window: '0', visible: true, attached: true }) };
delete env.ELECTRON_RUN_AS_NODE;

const child = spawn(electronExecutable(), [path.join(ROOT, 'desktop', 'main.cjs'), '--whale-data=' + dataDir], { env, stdio: ['ignore', 'pipe', 'pipe'] });
let stderr = '';
child.stderr.on('data', c => { stderr += c; });
child.stdout.on('data', () => {});
const timeout = setTimeout(() => child.kill(), 180000);
const code = await new Promise(r => child.on('exit', r));
clearTimeout(timeout);

const reportFile = path.join(output, 'bubble-visual.json');
if (!fs.existsSync(reportFile)) {
  process.stderr.write('没有产出报告，退出码 ' + code + '\n' + stderr.split('\n').slice(-15).join('\n') + '\n');
  process.exit(1);
}
const report = JSON.parse(fs.readFileSync(reportFile, 'utf8'));
for (const row of report.rows) {
  console.log(`\n${row.name}`);
  console.log(`  缩放 fit=${row.fit}  内容盒=${row.contentW}x${row.contentH}  路径尺寸=${row.bubbleW}x${row.bubbleH}  包含=${row.contained}`);
}
if (report.ok === false) {
  process.stderr.write('存在文字溢出气泡或缺失场景的用例，见 ' + reportFile + '\n');
  process.exit(1);
}
console.log('\n截图目录：' + output);
