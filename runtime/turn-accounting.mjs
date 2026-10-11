import { rounded } from './paths.mjs';
import { TurnJournal, safeSample, safeTurn, safeUsage } from './turn-journal.mjs';

// Owns live turns, durable recovery, pending cost checks, and ledger writes.
// BalanceQuery supplies observations; NoticePublisher owns publication.
export class TurnAccounting {
  constructor({ config, ledger, balance, notice, dataDir, pendingCostMs = 30000, clock = Date.now }) {
    this.config = config;
    this.ledger = ledger;
    this.balance = balance;
    this.notice = notice;
    this.clock = clock;
    this.journal = new TurnJournal(dataDir);
    this.turns = new Map();
    this.settling = new Set();
    this.jobs = new Set();
    this.pendingCosts = new Map();
    this.pendingCostMs = pendingCostMs;
    this.restored = false;
    this.recoveryActive = new Set();
    this.recoveryError = '';
    this.closed = false;
  }
  beginTurn(meta) {
    if (this.closed || this.settling.has(meta.id)) return;
    if (this.turns.has(meta.id)) { this.updateTurn(meta); return; }
    let context;
    try { context = this.config.resolve(); } catch { return; }
    if (!meta.isSubagent) this.notice.started(meta);
    const roots = [...this.turns.values()].filter(active => !active.isSubagent);
    const entry = { ...safeTurn(meta), context, canQuery: true, concurrent: !meta.isSubagent && roots.length > 0 };
    if (!meta.isSubagent) for (const active of roots) active.concurrent = true;
    // Subagents contribute tokens, not overlapping API-balance intervals.
    entry.start = meta.isSubagent ? null : this.balance.getBalance({ force: true, context });
    this.turns.set(meta.id, entry);
    this.persistTurn(entry, 'active');
    if (entry.start) entry.start.then(sample => {
      if (this.closed) return;
      entry.startSample = safeSample(sample);
      if (this.turns.get(meta.id) === entry) this.persistTurn(entry, 'active');
    }).catch(() => {});
  }
  updateTurn(meta) {
    const turn = this.turns.get(meta.id);
    if (!turn) return;
    turn.byModel = safeUsage(meta.byModel || turn.byModel);
    if (meta.rootTurnId) turn.rootTurnId = meta.rootTurnId;
    if (meta.ts) turn.ts = meta.ts;
    turn.failureKind = meta.failureKind === 'high-demand' ? 'high-demand' : null;
    this.persistTurn(turn, 'active');
  }
  persistTurn(turn, stage, meta = turn, extra = {}) {
    if (this.closed) return;
    this.journal.put({ stage, accountId: turn.context.accountId, currency: turn.context.setting.currency,
      pricing: turn.context.setting.models, meta: { ...meta, partial: !!turn.partial }, start: turn.startSample,
      concurrent: !!turn.concurrent, ...extra });
  }
  prepareRecovery() {
    if (this.restored) return [...this.recoveryActive];
    this.restored = true;
    let current;
    try { current = this.config.resolve(); } catch {}
    const waiting = [];
    for (const saved of this.journal.list()) {
      const matches = current?.accountId === saved.accountId && current.setting.currency === saved.currency;
      const context = matches ? { ...current, setting: { ...current.setting, models: saved.pricing } } :
        { accountId: saved.accountId, model: '', setting: { currency: saved.currency, models: saved.pricing } };
      const turn = { ...saved.meta, context, canQuery: matches, startSample: saved.start,
        start: Promise.resolve(saved.start || { ok: false }), concurrent: saved.concurrent };
      if (saved.stage === 'pending-cost') {
        // A restart cannot turn a later shared-key debit into an exact old bill.
        try { if (saved.scope) this.markCostUnknown(saved.scope, saved.meta.id); this.journal.remove(saved.meta.id); }
        catch { this.recoveryError = '一条待核对记录暂不可读；已保留恢复记录，其余功能仍可使用。'; }
        continue;
      }
      this.turns.set(saved.meta.id, turn);
      if (saved.stage === 'settling') waiting.push(saved.meta);
      else this.recoveryActive.add(saved.meta.id);
    }
    for (const meta of waiting) this.finishTurn({ ...meta, historical: true, notify: false, statusNotify: false }).catch(() => {});
    return [...this.recoveryActive];
  }
  status() {
    return { activeTurns: [...this.turns.values()].filter(turn => !turn.isSubagent).length,
      allTurns: this.turns.size, settling: this.settling.size, pendingCosts: this.pendingCosts.size,
      recovery: { pending: this.journal.entries.size, error: this.journal.error || this.recoveryError || '' },
      closed: this.closed };
  }
  finishMissingRecovery(seenIds = []) {
    const seen = new Set(seenIds);
    for (const id of this.recoveryActive) {
      const turn = this.turns.get(id);
      if (!seen.has(id) && turn) this.finishTurn({ ...safeTurn(turn), outcome: 'interrupted', historical: true,
        notify: false, statusNotify: false, ts: turn.ts || this.clock() }).catch(() => {});
    }
    this.recoveryActive.clear();
  }
  finishTurn(meta) {
    if (this.closed) return Promise.resolve();
    if (meta.statusCorrection === true && meta.outcome === 'aborted') { this.notice.cancelOutcomeNotice(meta); return Promise.resolve(); }
    const turn = this.turns.get(meta.id);
    if (!turn) return Promise.resolve();
    this.turns.delete(meta.id);
    this.settling.add(meta.id);
    this.persistTurn(turn, 'settling', meta);
    const job = this.settleTurn(meta, turn).finally(() => { this.settling.delete(meta.id); this.jobs.delete(job); });
    this.jobs.add(job); return job;
  }
  async settleTurn(meta, turn) {
    const context = turn.context;
    let outcome = meta.outcome || 'completed';
    const ownUsage = safeUsage(meta.byModel || turn.byModel);
    const base = { id: meta.id, sessionId: meta.sessionId || turn.sessionId, turnId: meta.turnId,
      sessionLabel: String(meta.sessionLabel || turn.sessionLabel || '').slice(0, 120),
      rootTurnId: meta.rootTurnId || turn.rootTurnId || meta.turnId, ts: meta.ts || this.clock(), outcome,
      partial: !!turn.partial, historical: !!meta.historical, accountId: context.accountId,
      failureKind: outcome === 'failed' && meta.failureKind === 'high-demand' ? 'high-demand' : null };
    if (turn.isSubagent || meta.isSubagent) {
      const estimate = !turn.partial ? estimateUsage(ownUsage, context.setting, base.ts) : null;
      const scope = this.balance.scope(context, context.setting.currency);
      this.ledger.append(scope, { ...base, isSubagent: true, byModel: ownUsage,
        model: (Object.keys(ownUsage).join(' + ') || context.model || '未知模型') + ' · 子任务用量',
        cost: estimate, costState: estimate === null ? 'unknown' : 'estimated', tokens: tokenTotal(ownUsage),
        source: estimate === null ? 'subagent-token-only' : 'subagent-pricing-estimate' });
      this.reviseRootEstimate(scope, base.rootTurnId);
      this.journal.remove(meta.id);
      return;
    }
    const start = await turn.start || { ok: false };
    if (this.closed) return;
    turn.startSample = safeSample(start); this.persistTurn(turn, 'settling', meta);
    const end = turn.canQuery === false ? { ok: false } : await this.balance.getBalance({ force: true, context });
    if (this.closed) return;
    let amount = null, source = 'token-only', costState = 'unknown', note = '没有可用的起止余额或模型价格，金额未知。';
    let currency = end.currency || start.currency || context.setting.currency;
    const children = this.ledger.load(this.balance.scope(context, context.setting.currency)).events.filter(e => e.isSubagent && e.rootTurnId === base.rootTurnId);
    const combined = mergeUsage([ownUsage, ...children.map(e => e.byModel || {})]);
    const estimate = estimateUsage(combined, context.setting, meta.ts || this.clock());
    if (estimate !== null && !turn.partial && !children.some(e => e.partial)) {
      amount = estimate; currency = context.setting.currency; source = 'configured-pricing-estimate'; costState = 'estimated';
      note = '根据 Codex 记录的 token 数量与手动配置价格估算，包含本主轮已记录的子任务用量；服务商折扣、缓存策略和账单延迟可能造成差异。';
    } else if (!meta.historical && outcome !== 'interrupted' && start.ok && end.ok && !start.stale && !end.stale && start.accountId === end.accountId && start.currency === end.currency) {
      if (typeof start.totalUsed === 'number' && typeof end.totalUsed === 'number' && end.totalUsed >= start.totalUsed) amount = rounded(end.totalUsed - start.totalUsed);
      else if (start.totalUsed == null && end.totalUsed == null && typeof start.totalBalance === 'number' && typeof end.totalBalance === 'number' && end.totalBalance <= start.totalBalance) amount = rounded(start.totalBalance - end.totalBalance);
      if (amount !== null) {
        source = 'shared-key-interval'; costState = amount > 0 ? 'observed' : 'pending';
        if (costState === 'pending') amount = null;
        note = costState === 'pending' ? '结束采样尚未出现可归属扣费，可能尚未入账或本次未计费；稍后的同密钥扣费不会直接归入本轮。' :
          '这是本轮运行期间同一 API 密钥的已观测合计扣费，可能含其他任务或设备的调用；并非逐请求最终账单。';
        note += (turn.partial ? ' 挂件在本轮开始后启动，仅覆盖启动后的时段。' : '') + (turn.concurrent ? ' 检测到同时运行的任务。' : '');
      }
    }
    if (meta.historical && amount === null) note = '已恢复任务状态及可用 token 记录；任务结束时没有可靠余额采样，不能把停机期间其他扣费归入本轮。';
    const label = source === 'configured-pricing-estimate' ? '上一轮消耗（估算）:' : source === 'shared-key-interval' ? (turn.partial ? '本轮已观测期间扣费:' : '上一轮期间 API 扣费:') : '上一轮 token 用量:';
    const tokens = tokenTotal(combined);
    const outcomeCancelled = this.notice.isOutcomeCancelled(meta.id);
    if(outcomeCancelled){outcome='aborted';base.outcome='aborted';base.failureKind=null;}
    const completionKind = outcome === 'completed' ? 'success' : ['failed','interrupted','superseded'].includes(outcome) ? 'failed' : outcome === 'aborted' ? 'cancelled' : null;
    const event = { ...base, ok: true, turn: meta.turnId || meta.id, amount, cost: amount, costState, tokens, currency, source, label, note,
      completionKind, notify: !meta.historical && !!completionKind && (outcome === 'completed' ? meta.notify !== false : meta.statusNotify === true || outcome === 'aborted' && outcomeCancelled),
      concurrent: !!turn.concurrent, childTurns: children.length, ownByModel: ownUsage, byModel: combined,
      pricing: context.setting.models };
    const scope = this.balance.scope(context, currency);
    const models = Object.keys(combined).join(' + ') || context.model || '未知模型';
    const model = source === 'shared-key-interval' ? models + ' · 期间扣费（同密钥合计）' : source === 'token-only' ? models + ' · 仅 token 记录' : models;
    if (!this.ledger.append(scope, { ...event, model })) {
      // A crash can happen between appending a pending row and changing the
      // journal stage. Recovery must not leave that durable row pending forever.
      if (meta.historical) this.markCostUnknown(scope, meta.id);
      this.journal.remove(meta.id); return;
    }
    if (costState === 'pending') {
      const dueAt = this.clock() + this.pendingCostMs;
      this.persistTurn(turn, 'pending-cost', meta, { dueAt, scope });
      this.pendingCosts.set(meta.id, { scope, context, dueAt, rechecked: false }); this.scheduleCostCheck();
    } else this.journal.remove(meta.id);
    this.notice.queueNotice(scope, event);
  }
  reviseRootEstimate(scope, rootTurnId) {
    const events = this.ledger.load(scope).events;
    const root = events.find(e => !e.isSubagent && e.turnId === rootTurnId && e.ownByModel);
    if (!root) return;
    const children = events.filter(e => e.isSubagent && e.rootTurnId === rootTurnId);
    const combined = mergeUsage([root.ownByModel, ...children.map(e => e.byModel || {})]);
    const patch = { tokens: tokenTotal(combined), byModel: combined, childTurns: children.length };
    if (root.pricing && ['configured-pricing-estimate', 'token-only'].includes(root.source)) {
      const complete = !root.partial && !children.some(e => e.partial);
      const estimate = complete ? estimateUsage(combined, { models: root.pricing }, root.ts) : null;
      if (estimate !== null && ['configured-pricing-estimate', 'token-only'].includes(root.source)) {
        Object.assign(patch, { cost: estimate, amount: estimate, costState: 'estimated', source: 'configured-pricing-estimate',
          model: Object.keys(combined).join(' + '), label: '上一轮消耗（估算）:',
          note: '根据完整已记录主子任务 token 和配置价格修订的估算；修订不会再次播放提示音。' });
      } else if (root.source === 'configured-pricing-estimate') {
        Object.assign(patch, { cost: null, amount: null, costState: 'unknown', source: 'token-only',
          model: Object.keys(combined).join(' + ') + ' · 仅 token 记录', label: '上一轮 token 用量:',
          note: '后来收到的子任务用量不完整或缺少模型价格，不能把原先局部估算当作整个主轮金额。' });
      }
    }
    this.reviseRecord(scope, root.id, patch);
  }
  reviseRecord(scope, id, patch) {
    const event = this.ledger.revise(scope, id, patch);
    if (!event) return;
    this.notice.reviseLastTurn(id, { ...event, amount: event.cost });
  }
  markCostUnknown(scope, id) {
    const event = this.ledger.find(scope, { id });
    if (event?.costState === 'pending') this.reviseRecord(scope, id, { cost: null, amount: null, costState: 'unknown',
      note: '暂无可验证的逐请求账单，无法确定本轮金额；余额及每日合计仍随服务商最新返回值更新。' });
  }
  scheduleCostCheck() {
    if (this.costTimer || this.closed || !this.pendingCosts.size) return;
    const soonest = Math.min(...[...this.pendingCosts.values()].map(item => item.rechecked ? item.dueAt : Math.min(item.dueAt, this.clock() + 1500)));
    this.costTimer = setTimeout(() => {
      this.costTimer = null;
      for (const [id, item] of this.pendingCosts) {
        try {
          if (!item.rechecked) { item.rechecked = true; this.balance.getBalance({ force: true, context: item.context }).catch(() => {}); }
          if (this.clock() >= item.dueAt) {
            this.markCostUnknown(item.scope, id); this.pendingCosts.delete(id); this.journal.remove(id);
          }
        } catch {
          this.recoveryError = '一条待核对费用暂时无法更新，恢复记录已保留。';
          item.dueAt = this.clock() + 60000; item.rechecked = true;
        }
      }
      this.scheduleCostCheck();
    }, Math.max(1, soonest - this.clock())); this.costTimer.unref();
  }
  async close({ timeoutMs = 3000 } = {}) {
    this.closed = true; clearTimeout(this.costTimer); this.costTimer = null;
    if (!this.jobs.size) return;
    let timer;
    await Promise.race([Promise.allSettled([...this.jobs]), new Promise(resolve => { timer = setTimeout(resolve, timeoutMs); })]);
    clearTimeout(timer);
    // Unfinished settlements were journaled before their first network await.
  }}

const tokenTotal = usage => Object.values(usage).reduce((n, u) => n + (Number(u.input_tokens) || 0) + (Number(u.output_tokens) || 0), 0);
function mergeUsage(parts) {
  const result = {};
  for (const part of parts) for (const [model, counts] of Object.entries(part)) {
    const total = Object.hasOwn(result, model) ? result[model] : (result[model] = {});
    for (const [key, value] of Object.entries(counts)) total[key] = (total[key] || 0) + (Number(value) || 0);
  }
  return result;
}

export function estimateUsage(byModel, settings, ts) {
  if (!Object.keys(byModel).length) return null;
  let total = 0;
  for (const [model, u] of Object.entries(byModel)) {
    const p = Object.hasOwn(settings.models || {}, model) ? settings.models[model] : null;
    if (!p) return null;
    const cached = Math.min(u.input_tokens, u.cached_input_tokens);
    const write = Math.min(Math.max(0, u.input_tokens - cached), u.cache_write_input_tokens || 0);
    const miss = Math.max(0, u.input_tokens - cached - write);
    // Reasoning tokens are already a subset of output_tokens in Codex events.
    total += (miss * p.input + write * (p.cacheWrite ?? p.input) + cached * p.cachedInput + u.output_tokens * p.output) / 1e6;
  }
  return rounded(total);
}
