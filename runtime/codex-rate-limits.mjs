import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { VERSION } from './paths.mjs';

const WINDOW_LABELS = new Map([[300, '5 小时'], [10080, '周']]);

export function windowLabel(minutes) {
  const known = WINDOW_LABELS.get(minutes);
  if (known) return known;
  if (!Number.isFinite(minutes) || minutes <= 0) return '';
  if (minutes % 10080 === 0) return (minutes / 10080) + ' 周';
  if (minutes % 1440 === 0) return (minutes / 1440) + ' 天';
  if (minutes % 60 === 0) return (minutes / 60) + ' 小时';
  return minutes + ' 分钟';
}

export function quotaFromAppServer(response, observedAt = Date.now()) {
  const limits = response?.rateLimitsByLimitId?.codex || response?.rateLimits;
  const windows = [];
  for (const slot of ['primary', 'secondary']) {
    const item = limits?.[slot];
    const minutes = item?.windowDurationMins;
    const label = windowLabel(minutes);
    if (!label || typeof item.usedPercent !== 'number' ||
        !Number.isFinite(item.usedPercent) || item.usedPercent < 0 || item.usedPercent > 100) continue;
    const reset = typeof item.resetsAt === 'number' && Number.isFinite(item.resetsAt)
      ? (item.resetsAt < 1e12 ? item.resetsAt * 1000 : item.resetsAt) : null;
    windows.push({ label, windowDurationMins: minutes,
      usedPercent: item.usedPercent, remainingPercent: 100 - item.usedPercent,
      resetsAt: reset, observedAt, stale: reset === null || reset <= observedAt });
  }
  return windows;
}

let cachedExecutable;

export function findCodexExecutable(env = process.env) {
  if (env === process.env && cachedExecutable !== undefined) return cachedExecutable;
  const found = locateCodex(env);
  if (env === process.env) cachedExecutable = found;
  return found;
}

function locateCodex(env) {
  const candidates = [];
  const add = value => { if (value && !candidates.includes(value)) candidates.push(value); };
  add(env.CODEX_CLI_PATH);
  const local = env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local');
  const roaming = env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming');
  if (process.platform === 'win32') {
    const bin = path.join(local, 'OpenAI', 'Codex', 'bin');
    try {
      const dirs = fs.readdirSync(bin, { withFileTypes: true }).filter(entry => entry.isDirectory());
      dirs.sort((a, b) => fs.statSync(path.join(bin, b.name)).mtimeMs - fs.statSync(path.join(bin, a.name)).mtimeMs);
      for (const entry of dirs) add(path.join(bin, entry.name, 'codex.exe'));
    } catch {}
    add(path.join(local, 'Programs', 'codex', 'codex.exe'));
    add(path.join(local, 'Programs', 'Codex', 'codex.exe'));
    add(path.join(env.ProgramFiles || 'C:\\Program Files', 'Codex', 'codex.exe'));
    add(path.join(roaming, 'npm', 'codex.cmd'));
  }
  for (const candidate of candidates) {
    try { if (fs.statSync(candidate).isFile()) return candidate; } catch {}
  }
  if (process.platform !== 'win32') return 'codex';
  for (const dir of String(env.PATH || '').split(path.delimiter)) {
    if (!dir) continue;
    for (const name of ['codex.exe', 'codex.cmd', 'codex.bat']) {
      const candidate = path.join(dir, name);
      try { if (fs.statSync(candidate).isFile()) return candidate; } catch {}
    }
  }
  return null;
}

// A .cmd/.bat shim has to run through the command processor; spawning it
// directly fails with ENOENT even though the file exists.
export function codexSpawnArgs(executable, args) {
  if (process.platform === 'win32' && /\.(?:cmd|bat)$/i.test(executable)) {
    return { executable: process.env.ComSpec || 'cmd.exe', args: ['/d', '/s', '/c', executable, ...args] };
  }
  return { executable, args };
}

// One bounded, private stdio connection per widget. No credentials or raw RPC
// errors leave the reader, and a failed transport is discarded before retry.
export function createCodexRateLimitsClient({ codexHome, executable, timeoutMs = 5000,
  idleMs = 90000, spawnImpl = spawn, clock = Date.now } = {}) {
  let connection = null, nextId = 1, idleTimer = null, closed = false;
  const error = (code, message = 'Codex 额度查询暂不可用') => Object.assign(new Error(message), { code });
  function destroy(own, reason = error('UNAVAILABLE')) {
    if (!own || own.dead) return;
    own.dead = true;
    if (connection === own) connection = null;
    for (const job of own.jobs.values()) job.reject(reason);
    own.jobs.clear();
    own.child.stdin.destroy();
    own.child.kill();
  }
  function rpc(own, method, params, signal) {
    return new Promise((resolve, reject) => {
      if (own.dead || signal?.aborted) return reject(error('ABORTED'));
      const id = nextId++;
      const finish = (failure, value) => {
        clearTimeout(timer); signal?.removeEventListener('abort', abort);
        own.jobs.delete(id); failure ? reject(failure) : resolve(value);
      };
      const abort = () => destroy(own, error('ABORTED'));
      const timer = setTimeout(() => destroy(own, error('TIMEOUT')), timeoutMs);
      timer.unref?.();
      signal?.addEventListener('abort', abort, { once: true });
      own.jobs.set(id, { resolve: value => finish(null, value), reject: failure => finish(failure) });
      try { own.child.stdin.write(JSON.stringify({ jsonrpc: '2.0', id, method, params }) + '\n'); }
      catch { destroy(own); }
    });
  }
  function resolvedExecutable() { return executable === '' ? null : (executable || findCodexExecutable()); }
  function connect(signal) {
    if (connection) return connection;
    const launch = codexSpawnArgs(resolvedExecutable(), ['app-server', '--stdio']);
    const child = spawnImpl(launch.executable, launch.args, {
      windowsHide: true, stdio: ['pipe', 'pipe', 'ignore'],
      env: codexHome ? { ...process.env, CODEX_HOME: codexHome } : process.env,
    });
    const own = { child, jobs: new Map(), dead: false, ready: null };
    connection = own;
    let buffer = '';
    child.stdout.setEncoding('utf8');
    child.stdout.on('data', chunk => {
      if (own.dead) return;
      buffer += chunk;
      if (buffer.length > 2 * 1024 * 1024) return destroy(own);
      let end;
      while ((end = buffer.indexOf('\n')) >= 0) {
        const line = buffer.slice(0, end); buffer = buffer.slice(end + 1);
        let message; try { message = JSON.parse(line); } catch { continue; }
        // A server-initiated request or notification carries `method`; only
        // replies are matched by id, so a colliding id cannot resolve a job.
        if (message.method !== undefined) continue;
        const job = own.jobs.get(message.id);
        if (!job) continue;
        if (message.error) {
          const authError = message.error.code === 401 || /unauthori[sz]ed|not authenticated|not logged in|requires.*login|authentication.*required|401\b/i.test(message.error.message || '');
          job.reject(error(authError ? 'AUTH_REQUIRED' : 'UNAVAILABLE'));
        } else if (message.result == null) job.reject(error('UNAVAILABLE'));
        else job.resolve(message.result);
      }
    });
    child.once('error', () => destroy(own));
    child.once('close', () => destroy(own));
    child.stdin.on('error', () => destroy(own));
    own.ready = rpc(own, 'initialize', { clientInfo: {
      name: 'codex_whale_widget', title: 'Codex Whale Widget', version: VERSION,
    } }, signal).then(() => {
      if (own.dead) throw error('UNAVAILABLE');
      child.stdin.write(JSON.stringify({ jsonrpc: '2.0', method: 'initialized', params: {} }) + '\n');
    });
    return own;
  }
  async function read({ signal } = {}) {
    clearTimeout(idleTimer);
    if (!resolvedExecutable()) throw error('CODEX_NOT_FOUND', '未找到 Codex 可执行文件，请确认 Codex 已安装或设置 CODEX_CLI_PATH');
    for (let attempt = 0; attempt < 2; attempt++) {
      if (closed || signal?.aborted) throw error('ABORTED');
      let own;
      try {
        own = connect(signal); await own.ready;
        const result = await rpc(own, 'account/rateLimits/read', {}, signal);
        if (closed || own.dead || signal?.aborted) throw error('ABORTED');
        const observedAt = clock();
        return { windows: quotaFromAppServer(result, observedAt), observedAt,
          planType: result.rateLimitsByLimitId?.codex?.planType || result.rateLimits?.planType || null };
      } catch (failure) {
        destroy(own);
        if (closed || signal?.aborted || ['AUTH_REQUIRED', 'ABORTED', 'CODEX_NOT_FOUND'].includes(failure.code) || attempt === 1) throw failure;
      } finally {
        clearTimeout(idleTimer);
        if (!closed && connection) {
          const current = connection;
          idleTimer = setTimeout(() => { if (!current.jobs.size) destroy(current); }, idleMs);
          idleTimer.unref?.();
        }
      }
    }
  }
  return { read, reset() { clearTimeout(idleTimer); destroy(connection, error('ABORTED')); },
    close() { closed = true; clearTimeout(idleTimer); destroy(connection, error('ABORTED')); } };
}
