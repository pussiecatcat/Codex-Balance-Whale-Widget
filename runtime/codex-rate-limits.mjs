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
  if (process.platform === 'darwin') {
    const executableFile = candidate => {
      try {
        fs.accessSync(candidate, fs.constants.X_OK);
        return fs.statSync(candidate).isFile();
      } catch { return false; }
    };
    // LaunchAgents have a minimal PATH, unlike an interactive terminal. Keep
    // installed CLI precedence, then use an existing app's native CLI directly
    // (npm launchers also need Node, which may be absent from that PATH).
    for (const directory of String(env.PATH || '').split(path.delimiter).filter(Boolean)) {
      const candidate = path.join(directory, 'codex');
      if (executableFile(candidate)) return candidate;
    }
    for (const applications of [path.join(os.homedir(), 'Applications'), '/Applications']) {
      for (const relative of [
        ['Codex.app', 'Contents', 'Resources', 'codex'],
        ['ChatGPT.app', 'Contents', 'Resources', 'codex-cli', 'CodexCLI.app', 'Contents', 'MacOS', 'codex'],
      ]) {
        const candidate = path.join(applications, ...relative);
        if (executableFile(candidate)) return candidate;
      }
    }
  }
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

// codex-cli 0.120.0 起 `app-server --stdio` 被移除，换成了 `--listen stdio://`
// （stdio 本身就是默认值）。旧写法会让 CLI 直接报 unexpected argument 并以
// 退出码 2 结束，表现为额度永远读不出来。这里按顺序尝试各写法，命中就记住，
// 避免每次刷新都先白起一次进程。一次性查询和常驻连接共用这一份协商缓存；
// 缓存命中但参数再次被拒（例如 codex 就地升级）时重新协商。
const APP_SERVER_ARG_FORMS = [
  ['app-server', '--listen', 'stdio://'],
  ['app-server', '--stdio'],
];
// executable -> { working: 已验证可用的写法下标, rejected: 已被拒绝的下标 }
const workingArgs = new Map();

function argsIndex(args) {
  return APP_SERVER_ARG_FORMS.findIndex(form => form === args || form.join(' ') === args.join(' '));
}

export function appServerArgsOrder(executable) {
  const state = workingArgs.get(executable);
  const all = APP_SERVER_ARG_FORMS.map((_, index) => index);
  const candidates = state == null ? all
    : (state.working == null ? all : [state.working, ...all.filter(index => index !== state.working)]);
  const remaining = candidates.filter(index => !(state?.rejected ?? []).includes(index));
  // 全部被拒（例如换了旧版本来回切换）时从默认顺序重来，保证有界可恢复。
  return remaining.length ? remaining : all;
}

export function noteAppServerArgsRejected(executable, args) {
  const index = argsIndex(args);
  if (index < 0) return;
  const state = workingArgs.get(executable) || { working: null, rejected: [] };
  if (!state.rejected.includes(index)) state.rejected.push(index);
  if (state.working === index) state.working = null;
  workingArgs.set(executable, state);
}

export function noteAppServerArgsWorking(executable, args) {
  const index = argsIndex(args);
  if (index < 0) return;
  const state = workingArgs.get(executable) || { working: null, rejected: [] };
  state.working = index;
  state.rejected = state.rejected.filter(candidate => candidate !== index);
  workingArgs.set(executable, state);
}

// 只有「CLI 拒绝了参数」才值得换写法重试。没登录、网络不通这类真实失败
// 重试只会白等一个完整超时，所以按 stderr 特征精确区分。stderr 只在这里
// 做内部判定，不向界面或日志透出原始内容。
export function looksLikeArgsRejected(stderr) {
  return /unexpected argument|unrecognized (?:option|argument)|unknown option|invalid value .* for/i.test(String(stderr || ''));
}

// 仅供测试：清掉「哪种写法可用」的缓存。
export function resetCodexRateLimitsArgsCache() { workingArgs.clear(); }

function readRateLimitsOnce({ codexHome, executable, timeoutMs, spawnImpl, signal }, args) {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(new Error('Codex 额度查询已取消'));
    let stderr = '';
    const child = spawnImpl(executable, args, {
      windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'],
      env: codexHome ? { ...process.env, CODEX_HOME: codexHome } : process.env,
    });
    if (child.stderr && typeof child.stderr.on === 'function') {
      child.stderr.setEncoding?.('utf8');
      child.stderr.on('data', chunk => { if (stderr.length < 4096) stderr += chunk; });
    }
    let settled = false, buffer = '';
    const finish = (error, value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      signal?.removeEventListener('abort', onAbort);
      child.stdin.destroy();
      child.kill();
      if (error) {
        if (looksLikeArgsRejected(stderr)) { noteAppServerArgsRejected(executable, args); error.argsRejected = true; }
        reject(error);
      } else { noteAppServerArgsWorking(executable, args); resolve(value); }
    };
    const send = message => { if (!settled && child.stdin.writable) child.stdin.write(JSON.stringify({ jsonrpc: '2.0', ...message }) + '\n'); };
    const onAbort = () => finish(new Error('Codex 额度查询已取消'));
    const timeout = setTimeout(() => finish(new Error('Codex 额度查询超时')), timeoutMs);
    timeout.unref?.();
    signal?.addEventListener('abort', onAbort, { once: true });
    child.once('error', error => finish(error));
    child.stdin.on('error', error => finish(error));
    child.once('close', () => {
      const rejected = looksLikeArgsRejected(stderr);
      finish(new Error(rejected ? 'Codex 额度查询参数不被当前版本支持' : 'Codex 额度查询已结束'));
    });
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

export async function readCodexRateLimits({ codexHome, executable = findCodexExecutable(), timeoutMs = 6000, spawnImpl = spawn, signal } = {}) {
  const resolved = { codexHome, executable, timeoutMs, spawnImpl, signal };
  let lastError;
  for (const args of appServerArgsOrder(executable).map(index => APP_SERVER_ARG_FORMS[index])) {
    try {
      return await readRateLimitsOnce(resolved, args);
    } catch (error) {
      if (signal?.aborted) throw error;
      // 参数被拒才换下一种写法；其它失败原样抛出，避免白等一个完整超时。
      if (!error?.argsRejected) throw error;
      lastError = error;
    }
  }
  throw lastError ?? new Error('Codex 额度不可用');
}

// One bounded, private stdio connection per widget. No credentials or raw RPC
// errors leave the reader, and a failed transport is discarded before retry.
export function createCodexRateLimitsClient({ codexHome, executable, timeoutMs = 5000,
  idleMs = 90000, spawnImpl = spawn, clock = Date.now } = {}) {
  let connection = null, nextId = 1, idleTimer = null, closed = false;
  const error = code => Object.assign(new Error('Codex 额度查询暂不可用'), { code });
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
  function connect(signal) {
    if (connection) return connection;
    const resolvedExecutable = executable || findCodexExecutable();
    const args = APP_SERVER_ARG_FORMS[appServerArgsOrder(resolvedExecutable)[0]];
    const child = spawnImpl(resolvedExecutable, args, {
      windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'],
      env: codexHome ? { ...process.env, CODEX_HOME: codexHome } : process.env,
    });
    let stderr = '';
    if (child.stderr && typeof child.stderr.on === 'function') {
      child.stderr.setEncoding?.('utf8');
      child.stderr.on('data', chunk => { if (stderr.length < 4096) stderr += chunk; });
    }
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
    child.once('close', () => {
      // 参数被当前版本拒绝时登记，下一次连接换用下一种写法；其余失败不碰缓存。
      if (!own.dead && looksLikeArgsRejected(stderr)) noteAppServerArgsRejected(resolvedExecutable, args);
      destroy(own);
    });
    child.stdin.on('error', () => destroy(own));
    own.ready = rpc(own, 'initialize', { clientInfo: {
      name: 'codex_whale_widget', title: 'Codex Whale Widget', version: '0.3.0',
    } }, signal).then(() => {
      if (own.dead) throw error('UNAVAILABLE');
      noteAppServerArgsWorking(resolvedExecutable, args);
      child.stdin.write(JSON.stringify({ jsonrpc: '2.0', method: 'initialized', params: {} }) + '\n');
    });
    return own;
  }
  async function read({ signal } = {}) {
    clearTimeout(idleTimer);
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
        if (closed || signal?.aborted || ['AUTH_REQUIRED', 'ABORTED'].includes(failure.code) || attempt === 1) throw failure;
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
