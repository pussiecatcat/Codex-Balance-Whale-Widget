import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';

const WINDOW_LABELS = new Map([[300, '5 小时'], [10080, '周']]);

export function quotaFromAppServer(response, observedAt = Date.now()) {
  const limits = response?.rateLimitsByLimitId?.codex || response?.rateLimits;
  const windows = [];
  for (const slot of ['primary', 'secondary']) {
    const item = limits?.[slot];
    const minutes = item?.windowDurationMins;
    if (!WINDOW_LABELS.has(minutes) || typeof item.usedPercent !== 'number' ||
        !Number.isFinite(item.usedPercent) || item.usedPercent < 0 || item.usedPercent > 100) continue;
    const reset = typeof item.resetsAt === 'number' && Number.isFinite(item.resetsAt)
      ? (item.resetsAt < 1e12 ? item.resetsAt * 1000 : item.resetsAt) : null;
    windows.push({ label: WINDOW_LABELS.get(minutes), windowDurationMins: minutes,
      usedPercent: item.usedPercent, remainingPercent: 100 - item.usedPercent,
      resetsAt: reset, observedAt, stale: reset === null || reset <= observedAt });
  }
  return windows;
}

export function findCodexExecutable(env = process.env) {
  if (env.CODEX_CLI_PATH && fs.existsSync(env.CODEX_CLI_PATH)) return env.CODEX_CLI_PATH;
  if (process.platform !== 'win32') return 'codex';
  const bin = path.join(env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local'), 'OpenAI', 'Codex', 'bin');
  try {
    const dirs = fs.readdirSync(bin, { withFileTypes: true }).filter(entry => entry.isDirectory());
    dirs.sort((a, b) => fs.statSync(path.join(bin, b.name)).mtimeMs - fs.statSync(path.join(bin, a.name)).mtimeMs);
    for (const entry of dirs) {
      const candidate = path.join(bin, entry.name, 'codex.exe');
      if (fs.existsSync(candidate)) return candidate;
    }
  } catch {}
  return 'codex';
}

export function readCodexRateLimits({ codexHome, executable = findCodexExecutable(), timeoutMs = 6000, spawnImpl = spawn, signal } = {}) {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(new Error('Codex 额度查询已取消'));
    const child = spawnImpl(executable, ['app-server', '--stdio'], {
      windowsHide: true, stdio: ['pipe', 'pipe', 'ignore'],
      env: codexHome ? { ...process.env, CODEX_HOME: codexHome } : process.env,
    });
    let settled = false, buffer = '';
    const finish = (error, value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      signal?.removeEventListener('abort', onAbort);
      child.stdin.destroy();
      child.kill();
      if (error) reject(error); else resolve(value);
    };
    const send = message => { if (!settled && child.stdin.writable) child.stdin.write(JSON.stringify({ jsonrpc: '2.0', ...message }) + '\n'); };
    const onAbort = () => finish(new Error('Codex 额度查询已取消'));
    const timeout = setTimeout(() => finish(new Error('Codex 额度查询超时')), timeoutMs);
    timeout.unref?.();
    signal?.addEventListener('abort', onAbort, { once: true });
    child.once('error', error => finish(error));
    child.stdin.on('error', error => finish(error));
    child.once('close', () => finish(new Error('Codex 额度查询已结束')));
    child.stdout.setEncoding('utf8');
    child.stdout.on('data', chunk => {
      buffer += chunk;
      if (buffer.length > 2 * 1024 * 1024) return finish(new Error('Codex 额度响应过大'));
      let end;
      while ((end = buffer.indexOf('\n')) >= 0) {
        const line = buffer.slice(0, end); buffer = buffer.slice(end + 1);
        let message;
        try { message = JSON.parse(line); } catch { continue; }
        if (message.id === 1) {
          if (message.error) return finish(new Error('Codex 初始化失败'));
          send({ method: 'initialized', params: {} });
          send({ id: 2, method: 'account/rateLimits/read', params: {} });
        } else if (message.id === 2) {
          if (message.error || !message.result) return finish(new Error('Codex 额度不可用'));
          return finish(null, { windows: quotaFromAppServer(message.result), observedAt: Date.now(),
            planType: message.result.rateLimitsByLimitId?.codex?.planType || message.result.rateLimits?.planType || null });
        }
      }
    });
    send({ id: 1, method: 'initialize', params: { clientInfo: {
      name: 'codex_whale_widget', title: 'Codex Whale Widget', version: '0.3.0',
    } } });
  });
}
