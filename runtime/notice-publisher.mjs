import fs from 'node:fs';
import path from 'node:path';
import { readJson, writeJson } from './paths.mjs';

// Owns the one-time status publication and pending user-input DTO. No raw
// function-call payload or provider credential enters the notice state.
export class NoticePublisher {
  #lastFile;
  #fs;
  #cancelledOutcomes = new Set();

  constructor({ config, ledger, balance, dataDir, noticeDelayMs = 2500, clock = Date.now, fs: fileSystem = fs }) {
    this.config = config;
    this.ledger = ledger;
    this.balance = balance;
    this.clock = clock;
    this.#lastFile = path.join(dataDir, 'last-turn.json');
    this.#fs = fileSystem;
    this.noticeDelayMs = noticeDelayMs;
    this.noticeTimers = new Map();
    this.latestStarts = new Map();
    this.waits = new Map();
    this.waitRevision = 0;
    this.recoveryError = '';
    this.closed = false;
  }
  started(meta) {
    const session = meta.sessionId || meta.id;
    this.latestStarts.set(session, meta.id);
    const waiting = this.noticeTimers.get(session);
    if (waiting) { clearTimeout(waiting.timer); this.noticeTimers.delete(session); }
  }
  updateWait(meta) {
    if (!meta || meta.isSubagent || !meta.sessionId || !meta.id) return;
    const key = meta.sessionId + ':' + meta.id;
    if (meta.pending === false) this.waits.delete(key);
    else if (meta.kind === 'question' || meta.kind === 'approval') this.waits.set(key, {
      id: String(meta.id), sessionId: String(meta.sessionId), sessionLabel: String(meta.sessionLabel || '当前对话').slice(0, 120),
      kind: meta.kind, pending: true, ts: Number(meta.ts) || this.clock(),
    });
    this.waitRevision++;
  }
  waitStatus() {
    const pending = [...this.waits.values()].sort((a, b) => b.ts - a.ts)[0] || null;
    return { ok: true, revision: this.waitRevision, pending: pending ? { ...pending } : null };
  }
  lastTurn() {
    const last = readJson(this.#lastFile, { ok: true, seq: 0, turn: null, amount: null, tokens: null, ts: null }, { fs: this.#fs });
    const c = this.config.resolve();
    if (last.accountId && last.accountId !== c.accountId) return { ok: true, seq: last.seq, turn: null, amount: null, tokens: null, ts: null };
    return last;
  }
  isOutcomeCancelled(id) { return this.#cancelledOutcomes.has(id); }
  reviseLastTurn(id, patch, { expectedOutcome = null } = {}) {
    const last = readJson(this.#lastFile, { seq: 0 }, { fs: this.#fs });
    if (last.id !== id || expectedOutcome && last.outcome !== expectedOutcome) return false;
    writeJson(this.#lastFile, { ...last, ...patch, seq: last.seq }, { fs: this.#fs });
    return true;
  }
  status() {
    return { recoveryError: this.recoveryError, pendingNotices: this.noticeTimers.size,
      pendingWaits: this.waits.size, closed: this.closed };
  }
  cancelOutcomeNotice(meta) {
    this.#cancelledOutcomes.add(meta.id);
    if(this.#cancelledOutcomes.size>256)this.#cancelledOutcomes.delete(this.#cancelledOutcomes.values().next().value);
    const session=meta.sessionId||meta.id, waiting=this.noticeTimers.get(session);
    if(waiting?.id===meta.id){clearTimeout(waiting.timer);this.noticeTimers.delete(session);}
    let c;try{c=this.config.resolve();}catch{return;}
    const patch={outcome:'aborted',completionKind:'cancelled',failureKind:null,notify:!meta.historical&&!meta.isSubagent};
    for(const scope of new Set([this.balance.getActiveScope(),this.balance.scope(c,c.setting.currency)])){
      if(!scope?.startsWith(c.accountId+'-'))continue;
      const found=this.ledger.find(scope,{id:meta.id});
      if(found?.outcome==='failed'){this.ledger.revise(scope,meta.id,patch);this.queueNotice(scope,{...found,...patch});}
    }
    this.reviseLastTurn(meta.id, patch, { expectedOutcome: 'failed' });
  }
  queueNotice(scope, event) {
    if (!event.notify || this.closed) return;
    if (['success','cancelled'].includes(event.completionKind) || event.completionKind === 'failed' && event.failureKind !== 'high-demand') { this.publishNotice(scope, event.id); return; }
    const session = event.sessionId || event.id;
    if (this.latestStarts.get(session) && this.latestStarts.get(session) !== event.id) return;
    const old = this.noticeTimers.get(session); if (old) clearTimeout(old.timer);
    const timer = setTimeout(() => {
      this.noticeTimers.delete(session);
      if (!this.closed && (!this.latestStarts.get(session) || this.latestStarts.get(session) === event.id)) {
        try { this.publishNotice(scope, event.id); }
        catch { this.recoveryError = '任务状态提示暂不可写；用量记录与恢复文件仍保留。'; }
      }
    }, this.noticeDelayMs); timer.unref();
    this.noticeTimers.set(session, { timer, id: event.id });
  }
  publishNotice(scope, id) {
    const event = this.ledger.find(scope, { id });
    if (!event || event.noticePublished || !event.notify || this.closed) return;
    let config;
    try { config = this.config.resolve(); } catch { return; }
    if (config.accountId !== event.accountId) return;
    if (!['success','cancelled','failed'].includes(event.completionKind)) return;
    // The notice file is what the widget polls, so it has to reach the disk before
    // the ledger claims the notice was published. Marking first meant a failed
    // write left the ledger saying "sent" while no notice existed, and the guard
    // above then skipped every retry — the completion notice was lost for good.
    //
    // Writing first needs the write to be idempotent, which is why the file
    // records the notice it carries: if the ledger revise is what failed, the
    // retry finds its own notice already there, rewrites nothing, and leaves seq
    // alone so the widget does not show the same turn twice.
    const noticeId = (event.accountId || '') + '|' + scope + '|' + id;
    const last = readJson(this.#lastFile, { seq: 0 }, { fs: this.#fs });
    if (last.noticeId !== noticeId) {
      writeJson(this.#lastFile, {
        ...event, seq: Number(last.seq || 0) + 1, noticeId, amount: event.cost, notificationAt: this.clock(),
      }, { fs: this.#fs });
    }
    this.ledger.revise(scope, id, { noticePublished: true });
  }
  close() {
    this.closed = true;
    for (const item of this.noticeTimers.values()) clearTimeout(item.timer);
    this.noticeTimers.clear();
  }
}
