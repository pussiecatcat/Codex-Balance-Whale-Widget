import path from 'node:path';
import { failureKind } from './failure-kind.mjs';
import { SESSION_TOKEN_FIELDS, REALTIME_EVENT_PATTERN, decodeSessionEvent,
  normalizeSessionUsage, sessionCounterDifference, sessionTimestamp } from './session-events.mjs';

const fields = SESSION_TOKEN_FIELDS;
const normalize = value => normalizeSessionUsage(value);
const zero = () => normalize({});
const timestamp = sessionTimestamp;

export class SessionParser {
  constructor({ id, defaultModel = '', onStart = () => {}, onEnd = () => {}, onUpdate = () => {}, onWait = () => {}, recoverIds = [] }) {
    this.id = id; this.model = ['__proto__', 'prototype', 'constructor'].includes(defaultModel) ? '' : defaultModel;
    this.onStart = onStart; this.onEnd = onEnd; this.onUpdate = onUpdate; this.onWait = onWait;
    this.total = null; this.active = null; this.priming = false;
    this.identity = null; this.skipHistory = 0; this.completed = new Set();
    this.recentEnds = new Map();
    this.waiting = new Map();
    this.recoverIds = new Set(recoverIds); this.recoverySeen = new Set();
  }
  identify(meta) {
    // Only the first header identifies this file; session_id may be inherited.
    if (this.identity || !meta || !(meta.id || meta.session_id)) return;
    this.id = String(meta.id || meta.session_id);
    const cwd = typeof meta.cwd === 'string' ? meta.cwd : '';
    this.identity = { sessionId: this.id, parentThreadId: meta.parent_thread_id || meta.source?.subagent?.thread_spawn?.parent_thread_id || null,
      isSubagent: meta.thread_source === 'subagent' || !!meta.source?.subagent,
      sessionLabel: cwd ? path.basename(path.resolve(cwd)).slice(0, 120) : '',
      createdAt: timestamp(meta.timestamp), forked: !!meta.forked_from_id };
    this.skipHistory = Number.isSafeInteger(meta.subagent_history_start_ordinal) ? Math.max(0, meta.subagent_history_start_ordinal) : 0;
  }
  prime(lines) {
    this.priming = true;
    for (const line of lines) this.accept(line);
    this.priming = false;
    if (this.active) {
      if (!this.active.recoverable) { this.active.byModel = {}; this.active.partial = true; }
      this.onStart({ ...this.active });
    }
    if (!this.identity?.isSubagent) for (const wait of this.waiting.values()) this.onWait({ ...wait });
  }
  accept(line) {
    if (this.skipHistory > 0) { this.skipHistory--; return; }
    const d = decodeSessionEvent(line, REALTIME_EVENT_PATTERN);
    if (!d) return;
    const p = d.payload || {};
    if (d.type === 'session_meta') { this.identify(p); return; }
    if (d.type === 'response_item') {
      if (p.type === 'function_call') {
        const kind = ['request_user_input', 'request_user_input_async'].includes(p.name) ? 'question' : p.name === 'request_permissions' ? 'approval' : '';
        const callId = p.call_id || p.id;
        if (kind && callId && !this.identity?.isSubagent) {
          const wait = { id: String(callId), sessionId: this.id, sessionLabel: this.identity?.sessionLabel || '当前对话',
            turnId: this.active?.turnId || '', kind, pending: true, ts: timestamp(d.timestamp) || Date.now(), isSubagent: false };
          this.waiting.set(String(callId), wait);
          if (!this.priming) this.onWait({ ...wait });
        }
      } else if (p.type === 'function_call_output') {
        const callId = p.call_id || p.id, wait = callId && this.waiting.get(String(callId));
        if (wait) {
          this.waiting.delete(String(callId));
          if (!this.priming) this.onWait({ ...wait, pending: false, ts: timestamp(d.timestamp) || Date.now() });
        }
      }
      return;
    }
    if (d.type === 'turn_context') {
      if (typeof p.model === 'string' && !['__proto__', 'prototype', 'constructor'].includes(p.model)) this.model = p.model;
      if (this.active && (!p.turn_id || p.turn_id === this.active.turnId)) {
        this.active.rootTurnId = p.root_turn_id || this.active.turnId;
        if (!this.priming) this.onUpdate({ ...this.active });
      }
      return;
    }
    if (d.type !== 'event_msg') return;
    const turnId = p.turn_id || p.turnId;
    if (['error', 'stream_error'].includes(p.type)) {
      // stream_error can be a reconnect diagnostic. A turn-level error is
      // terminal unless it explicitly says it will retry; it often has no
      // following task_complete record after an API/transport failure.
      if (!this.active || turnId && turnId !== this.active.turnId) return;
      this.active.failureKind = failureKind(p);
      if (!this.priming) this.onUpdate({ ...this.active });
      if (p.will_retry === false || p.fatal === true || p.type === 'error' && p.will_retry !== true) this.end(timestamp(d.timestamp) || Date.now(), 'failed');
      return;
    }
    if (['task_started', 'turn_started'].includes(p.type)) {
      if (typeof turnId !== 'string' || !turnId || this.completed.has(turnId) || this.active?.turnId === turnId) return;
      const startedAt = timestamp(p.started_at);
      // Old forks can rewrite outer timestamps, but preserve original start seconds.
      if (this.identity?.forked && Number.isFinite(startedAt) && startedAt + 1000 < this.identity.createdAt) return;
      if (this.active) this.end(timestamp(d.timestamp) || Date.now(), 'superseded');
      this.active = { id: this.id + ':' + turnId, sessionId: this.id, turnId, rootTurnId: p.root_turn_id || turnId,
        isSubagent: this.identity?.isSubagent || false, parentThreadId: this.identity?.parentThreadId || null,
        sessionLabel: this.identity?.sessionLabel || '',
        byModel: {}, startedAt: startedAt || timestamp(d.timestamp) || Date.now(), ts: timestamp(d.timestamp) || Date.now(), partial: false };
      this.active.recoverable = this.recoverIds.has(this.active.id);
      if (this.active.recoverable) this.recoverySeen.add(this.active.id);
      if (!this.priming) this.onStart({ ...this.active });
      return;
    }
    if (p.type === 'token_count' && p.info?.total_token_usage) {
      const next = normalize(p.info.total_token_usage);
      const difference = sessionCounterDifference(next, this.total, fields);
      let delta = zero();
      if (this.total) delta = difference.reset ? normalize(p.info.last_token_usage) : difference.delta;
      else if (this.active && (!this.priming || this.active.recoverable)) delta = normalize(p.info.last_token_usage || next);
      this.total = next;
      if (this.active && (!this.priming || this.active.recoverable) && delta.input_tokens + delta.output_tokens > 0) {
        const model = this.model || '未知模型';
        const counts = Object.hasOwn(this.active.byModel, model) ? this.active.byModel[model] : (this.active.byModel[model] = zero());
        for (const k of fields) counts[k] += delta[k];
        this.active.ts = timestamp(d.timestamp) || Date.now();
        if (!this.priming) this.onUpdate({ ...this.active });
      }
      return;
    }
    if (['task_complete', 'turn_completed', 'turn_aborted', 'task_aborted'].includes(p.type)) {
      const previous = this.recentEnds.get(turnId);
      if (/aborted$/.test(p.type) && previous?.outcome === 'failed') {
        const corrected = { ...previous, outcome: 'aborted', failureKind: null, notify: false, statusNotify: true, statusCorrection: true };
        this.recentEnds.set(turnId, corrected);
        if (!this.priming && !previous.historical) this.onEnd(corrected);
        return;
      }
      if (!this.active || !turnId || turnId !== this.active.turnId) return;
      const outcome = /aborted$/.test(p.type) || ['aborted','cancelled','canceled'].includes(p.status) ? 'aborted' :
        ['interrupted','incomplete'].includes(p.status) ? 'interrupted' : p.error || ['failed','error'].includes(p.status) ? 'failed' : 'completed';
      this.active.failureKind = outcome === 'failed' ? (p.error ? failureKind(p.error) : failureKind(p) || this.active.failureKind) : null;
      this.end(timestamp(d.timestamp) || Date.now(), outcome);
    }
  }
  end(ts, outcome) {
    if (!this.active) return;
    const endingTurnId = this.active.turnId;
    const completed = { ...this.active, ts, outcome, historical: this.priming,
      notify: !this.priming && outcome === 'completed' && !this.active.isSubagent,
      failureKind: outcome === 'failed' && this.active.failureKind === 'high-demand' ? 'high-demand' : null,
      statusNotify: !this.priming && ['aborted','failed','interrupted','superseded'].includes(outcome) && !this.active.isSubagent };
    this.active = null; this.completed.add(completed.turnId);
    for (const [callId, wait] of this.waiting) if (!wait.turnId || wait.turnId === endingTurnId) {
      this.waiting.delete(callId);
      if (!this.priming) this.onWait({ ...wait, pending: false, ts });
    }
    this.recentEnds.set(completed.turnId, completed);
    if (this.recentEnds.size > 128) this.recentEnds.delete(this.recentEnds.keys().next().value);
    if (this.completed.size > 8192) this.completed.delete(this.completed.values().next().value);
    if (!this.priming || completed.recoverable) this.onEnd(completed);
  }
}

