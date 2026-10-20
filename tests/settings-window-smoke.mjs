#!/usr/bin/env node
// 设置窗口的冒烟检查。
//
//   node tests/settings-window-smoke.mjs [输出目录]
//
// 使用隔离的临时数据目录启动真实的 Electron，不碰用户正在运行的挂件。
// 与 tests/desktop-audit-smoke.mjs 的区别：这里的 Electron 路径按平台选择，
// 在 macOS 上也能跑（原脚本把 electron.exe 写死了）。
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function electronExecutable() {
  const dataHome = process.env.WHALE_HOME || path.join(process.env.CODEX_HOME || path.join(os.homedir(), '.codex'), 'whale-widget');
  const dist = path.join(dataHome, 'desktop-runtime', 'node_modules', 'electron', 'dist');
  const candidates = process.platform === 'darwin'
    ? [path.join(dist, 'Electron.app', 'Contents', 'MacOS', 'Electron')]
    : process.platform === 'win32'
      ? [path.join(dist, 'electron.exe')]
      : [path.join(dist, 'electron')];
  const found = candidates.find(fs.existsSync);
  if (!found) {
    throw new Error('未找到 Electron 可执行文件，请先运行 npm run install:mac（会装到 ' + dataHome + '）。');
  }
  return found;
}

const output = path.resolve(process.argv[2] || fs.mkdtempSync(path.join(os.tmpdir(), 'whale-settings-shots-')));
fs.mkdirSync(output, { recursive: true });

const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'whale-settings-smoke-'));
// 隔离数据：一套已知的、非默认的基础设置，用来证明保存时其它字段不被重置。
fs.writeFileSync(path.join(dataDir, '.dshw-size.json'), JSON.stringify({
  scale: 1.5, sound: true, vol: 0.9, soundSet: 'duck', usageMode: 'ledger',
  bubbleOn: true, turnCostOn: true, turnCostCloseMs: 5000,
  scrollGapOn: true, scrollGapPx: 24, menuBtnHide: false,
}));

const env = {
  ...process.env,
  WHALE_DESKTOP_TEST: '1',
  WHALE_DESKTOP_VERIFY_DIR: output,
  WHALE_SETTINGS_FIXTURE: '1',
  // 与 tests/desktop-fixture.mjs 相同的假主机状态：attached 且存活，避免启动即退出。
  WHALE_INITIAL_HOST: JSON.stringify({ hostAlive: true, hostPid: 123456, window: '0', visible: true, attached: true }),
};
delete env.ELECTRON_RUN_AS_NODE;

const child = spawn(electronExecutable(), [path.join(ROOT, 'desktop', 'main.cjs'), '--whale-data=' + dataDir], { env, stdio: ['ignore', 'pipe', 'pipe'] });
let stderr = '';
child.stderr.on('data', chunk => { stderr += chunk; });
child.stdout.on('data', () => {});

const reportFile = path.join(output, 'settings-window.json');
const timeout = setTimeout(() => child.kill('SIGKILL'), 90000);
const exitCode = await new Promise(resolve => child.on('exit', code => resolve(code)));
clearTimeout(timeout);

let report = null;
try { report = JSON.parse(fs.readFileSync(reportFile, 'utf8')); } catch {}

if (!report) {
  process.stderr.write(`设置窗口检查没有产出报告（Electron 退出码 ${exitCode}）。\n`);
  process.stderr.write('数据目录：' + dataDir + '\n输出目录：' + output + '\n');
  const errorFile = path.join(dataDir, 'desktop-error.json');
  if (fs.existsSync(errorFile)) process.stderr.write('主进程错误：' + fs.readFileSync(errorFile, 'utf8') + '\n');
  process.stderr.write('输出目录现有内容：' + (fs.readdirSync(output).join(', ') || '（空）') + '\n');
  if (stderr.trim()) process.stderr.write(stderr.split('\n').slice(-20).join('\n') + '\n');
  process.exit(1);
}

for (const line of report.checks) process.stdout.write(line + '\n');
process.stdout.write('\n截图目录：' + report.shots + '\n');
const failed = report.checks.filter(line => line.startsWith('FAIL'));
process.stdout.write(failed.length ? `失败 ${failed.length} 项\n` : `全部 ${report.checks.length} 项通过\n`);
process.exit(failed.length || report.ok === false ? 1 : 0);
