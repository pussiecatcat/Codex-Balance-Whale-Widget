import fs from 'node:fs';
import path from 'node:path';
import { StringDecoder } from 'node:string_decoder';
import { Worker } from 'node:worker_threads';
import { SessionParser } from './session-parser.mjs';

export { SessionParser } from './session-parser.mjs';

function sessionFiles(root, recoverIds = []) {
  const files = [];
  function walk(dir, depth = 0) {
    if (depth > 4) return;
    let entries;
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
    for (const entry of entries) {
      const file = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(file, depth + 1);
      else if (entry.isFile() && entry.name.endsWith('.jsonl')) {
        try { const stat = fs.statSync(file); files.push({ file, mtime: stat.mtimeMs, size: stat.size }); } catch {}
      }
    }
  }
  walk(root);
  const sorted = files.sort((a, b) => b.mtime - a.mtime), sessions = recoverIds.map(id => id.slice(0, id.lastIndexOf(':'))).filter(Boolean);
  return sorted.filter((item, index) => index < 64 || sessions.some(id => path.basename(item.file).includes(id)));
}

// Synchronous scanning is confined to the worker or isolated replay tests.
export class SessionReader {
  constructor({ root, defaultModel = '', onStart = () => {}, onEnd = () => {}, onUpdate = () => {}, onWait = () => {}, discoverMs = 3000, recoverIds = [] }) {
    Object.assign(this, { root, defaultModel, onStart, onEnd, onUpdate, onWait, discoverMs, recoverIds });
    this.files = new Map(); this.lastDiscovery = 0; this.error = '';
  }
  add(info, initial) {
    const parser = new SessionParser({ id: path.basename(info.file, '.jsonl'), defaultModel: this.defaultModel,
      onStart: this.onStart, onEnd: this.onEnd, onUpdate: this.onUpdate, onWait: this.onWait, recoverIds: this.recoverIds });
    const fd = fs.openSync(info.file, 'r');
    try {
      const head = Buffer.alloc(Math.min(info.size, 1024 * 1024));
      fs.readSync(fd, head, 0, head.length, 0);
      const newline = head.indexOf(10);
      if (newline < 0) return;
      const metadata = JSON.parse(head.subarray(0, newline).toString('utf8').replace(/^\uFEFF/, ''));
      if (metadata.type !== 'session_meta') return;
      parser.identify(metadata.payload);
      const state = { parser, offset: newline + 1, pending: '', skipLine: false, decoder: new StringDecoder('utf8') };
      if (initial || info.mtime < Date.now() - 30000) {
        // Long Ultra turns can start well before the last megabyte. Bootstrap
        // the lifecycle in bounded chunks on the worker, without replaying any
        // completions. The UI and native follower never wait for this scan.
        parser.priming = true;
        while (state.offset < info.size) {
          const previous = state.offset;
          this.readNew(info.file, state, info.size);
          if (state.offset <= previous) break; // Concurrent truncation cannot trap the worker.
        }
        parser.prime([]);
      }
      this.files.set(info.file, state);
    } finally { fs.closeSync(fd); }
  }
  tick(initial = false) {
    this.error = '';
    if (initial || Date.now() - this.lastDiscovery > this.discoverMs) {
      const listed = sessionFiles(this.root, this.recoverIds);
      for (const info of listed) if (!this.files.has(info.file)) {
        try { this.add(info, initial); } catch { this.error = '部分会话记录暂不可读'; }
      }
      const keep = new Set(listed.map(x => x.file));
      for (const [file, state] of this.files) if (!keep.has(file) && !state.parser.active) this.files.delete(file);
      this.lastDiscovery = Date.now();
    }
    for (const [file, state] of this.files) {
      try { this.readNew(file, state); } catch { this.error = '部分会话记录暂不可读'; }
    }
  }
  readNew(file, state, through = Infinity) {
    const size = Math.min(fs.statSync(file).size, through);
    if (size < state.offset) { this.files.delete(file); this.lastDiscovery = 0; return; }
    if (size === state.offset) return;
    const count = Math.min(size - state.offset, 4 * 1024 * 1024);
    const fd = fs.openSync(file, 'r'); let buf;
    try { buf = Buffer.alloc(count); fs.readSync(fd, buf, 0, count, state.offset); } finally { fs.closeSync(fd); }
    state.offset += count; state.more = state.offset < size;
    const lines = (state.pending + state.decoder.write(buf)).split('\n'); state.pending = lines.pop() || '';
    for (const line of lines) {
      if (state.skipLine) { state.skipLine = false; state.parser.accept(''); continue; }
      state.parser.accept(line);
    }
    if (state.pending.length > 8 * 1024 * 1024) { state.pending = ''; state.skipLine = true; }
  }
  status() { return { watching: this.files.size, error: this.error, catchingUp: [...this.files.values()].some(s => s.more),
    recoverySeen: [...new Set([...this.files.values()].flatMap(s => [...s.parser.recoverySeen]))] }; }
}

export class SessionMonitor {
  constructor(service, { intervalMs = 750, discoverMs = 3000 } = {}) {
    Object.assign(this, { service, intervalMs, discoverMs });
    this.pending = new Set(); this.snapshot = { watching: 0, error: '', initializing: true }; this.stopped = false;
  }
  start() {
    if (this.worker) return;
    let c;
    try { c = this.service.config.resolve(); }
    catch { c = { model: '', setting: { monitorSessions: false } }; }
    this.worker = new Worker(new URL('./session-worker.mjs', import.meta.url), { workerData: {
      root: path.join(this.service.config.codexHome, 'sessions'), defaultModel: c.model,
      intervalMs: this.intervalMs, discoverMs: this.discoverMs, enabled: c.setting.monitorSessions,
      recoverIds: this.service.prepareRecovery?.() || [],
    } });
    this.worker.on('message', message => {
      if (this.stopped) return;
      if (message.status) this.snapshot = { ...message.status, initializing: false };
      for (const item of message.events || []) {
        if (item.type === 'start') this.service.beginTurn(item.meta);
        else if (item.type === 'update') this.service.updateTurn?.(item.meta);
        else if (item.type === 'wait') this.service.updateWait?.(item.meta);
        else this.dispatch(item.meta);
      }
      if (message.recoveryComplete) this.service.finishMissingRecovery?.(message.status?.recoverySeen || []);
    });
    this.worker.on('error', () => { this.snapshot.error = '会话监测线程异常；余额查询仍可使用'; });
    this.worker.on('exit', code => { if (!this.stopped && code) this.snapshot.error = '会话监测线程退出'; });
    this.worker.unref();
    this.timer = setInterval(() => {
      try { const current = this.service.config.resolve(); this.worker.postMessage({ enabled: current.setting.monitorSessions, defaultModel: current.model }); } catch {}
    }, 3000); this.timer.unref();
  }
  async stop({ timeoutMs = 1200 } = {}) {
    this.stopped = true; clearInterval(this.timer); await this.worker?.terminate();
    if (!this.pending.size) return;
    let timer;
    await Promise.race([Promise.allSettled([...this.pending]), new Promise(resolve => { timer = setTimeout(resolve, timeoutMs); })]);
    clearTimeout(timer);
  }
  dispatch(meta) {
    const p = this.service.finishTurn(meta).catch(() => { this.snapshot.error = '一条会话用量记录未能写入'; }).finally(() => this.pending.delete(p));
    this.pending.add(p);
  }
  status() {
    // Do not hand the mutable worker snapshot to HTTP callers. This is a
    // monitoring DTO, never a route to parser or accounting internals.
    const { watching = 0, error = '', initializing = false, catchingUp = false, recoverySeen = [] } = this.snapshot;
    const runtime = this.service.monitorStatus?.() || {};
    const recovery = runtime.recovery && typeof runtime.recovery === 'object' ? runtime.recovery : {};
    return { watching, error, initializing, catchingUp, recoverySeen: [...recoverySeen],
      activeTurns: Number.isSafeInteger(runtime.activeTurns) && runtime.activeTurns >= 0 ? runtime.activeTurns : 0,
      recovery: { pending: Number.isSafeInteger(recovery.pending) && recovery.pending >= 0 ? recovery.pending : 0,
        error: typeof recovery.error === 'string' ? recovery.error : '' }, worker: !this.stopped };
  }
}
