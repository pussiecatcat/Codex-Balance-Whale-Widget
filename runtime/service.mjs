import path from 'node:path';
import { ConfigStore } from './config.mjs';
import { BalanceProvider } from './providers.mjs';
import { UsageLedger, usageDefaults } from './ledger.mjs';
import { readJson, writeJson, dayKey } from './paths.mjs';
import { BalanceQuery } from './balance-query.mjs';
import { NoticePublisher } from './notice-publisher.mjs';
import { TurnAccounting } from './turn-accounting.mjs';

// Compatibility facade for the dispatcher, monitor, and existing integrations.
// Each mutable runtime state has one owner in the three components below.
export class WhaleService {
  constructor(options = {}) {
    this.config = options.config || new ConfigStore(options);
    this.provider = options.provider || new BalanceProvider(options);
    this.ledger = new UsageLedger(this.config.dataDir);
    this.clock = options.clock || Date.now;
    this.usageSettingsFile = path.join(this.config.dataDir, 'usage-settings.json');
    this.balanceQuery = new BalanceQuery({ config: this.config, provider: this.provider, ledger: this.ledger, clock: this.clock });
    this.noticePublisher = new NoticePublisher({ config: this.config, ledger: this.ledger, balance: this.balanceQuery,
      dataDir: this.config.dataDir, noticeDelayMs: options.noticeDelayMs, clock: this.clock });
    this.turnAccounting = new TurnAccounting({ config: this.config, ledger: this.ledger, balance: this.balanceQuery,
      notice: this.noticePublisher, dataDir: this.config.dataDir, pendingCostMs: options.pendingCostMs, clock: this.clock });
  }
  get turns() { return this.turnAccounting.turns; }
  get journal() { return this.turnAccounting.journal; }
  get lastFile() { return this.noticePublisher.lastFile; }
  get activeScope() { return this.balanceQuery.activeScope; }
  get recoveryError() { return this.turnAccounting.recoveryError || this.noticePublisher.recoveryError; }
  get closed() { return this.turnAccounting.closed; }
  scope(...args) { return this.balanceQuery.scope(...args); }
  balanceIdentity(...args) { return this.balanceQuery.balanceIdentity(...args); }
  isCurrentBalanceContext(...args) { return this.balanceQuery.isCurrentBalanceContext(...args); }
  newestBalanceSample(...args) { return this.balanceQuery.newestBalanceSample(...args); }
  balanceCache(...args) { return this.balanceQuery.balanceCache(...args); }
  stoppedBalance(...args) { return this.balanceQuery.stoppedBalance(...args); }
  getBalance(...args) { return this.balanceQuery.getBalance(...args); }
  decorate(...args) { return this.balanceQuery.decorate(...args); }
  usageRecords() {
    const c = this.config.resolve();
    const scope = this.activeScope?.startsWith(c.accountId + '-') ? this.activeScope : this.scope(c, c.setting.currency);
    return { ...this.ledger.records(scope), currency: scope.slice(-3), settings: this.readUsageSettings() };
  }
  reconcileUsage(input) {
    const c = this.config.resolve();
    const scope = this.activeScope?.startsWith(c.accountId + '-') ? this.activeScope : this.scope(c, c.setting.currency);
    return this.ledger.reconcile(scope, input);
  }
  apiModelUsage(matches, now = this.clock(), since = null) {
    const c = this.config.resolve();
    const scope = this.activeScope?.startsWith(c.accountId + '-') ? this.activeScope : this.scope(c, c.setting.currency);
    const byModel = {};
    const events = this.ledger.load(scope).events || [];
    const aggregateRoots = new Set(events.filter(event => !event.isSubagent && !event.ownByModel).map(event => event.rootTurnId).filter(Boolean));
    for (const event of events) {
      if (since === null ? event.day !== dayKey(now) : event.ts < since) continue;
      // Parent rows contain aggregate usage; use their own part alongside child rows.
      const counts = event.ownByModel || event.byModel;
      if (event.isSubagent && aggregateRoots.has(event.rootTurnId)) continue;
      for (const [name, usage] of Object.entries(counts || {})) {
        if (!matches.some(match => name.toLowerCase().includes(match.toLowerCase()))) continue;
        const target = byModel[name] ||= { input_tokens: 0, output_tokens: 0, cached_input_tokens: 0 };
        for (const key of Object.keys(target)) target[key] += Number(usage[key]) || 0;
      }
    }
    return { todayTokens: Object.values(byModel).reduce((n, row) => n + row.input_tokens + row.output_tokens, 0), byModel, date: dayKey(now), source: 'local-session-tokens' };
  }
  readUsageSettings() {
    return this.resolveUsageSettings(readJson(this.usageSettingsFile, {}));
  }
  resolveUsageSettings(saved = {}) {
    if (!saved || typeof saved !== 'object' || Array.isArray(saved)) throw new Error('用量设置格式无效');
    const defaults = usageDefaults();
    defaults.alert.lines.find(line => line.type === 'link').url = this.config.resolve().dashboardUrl;
    const result = { ...saved };
    for (const key of Object.keys(defaults)) {
      const value = saved[key];
      result[key] = { ...defaults[key], ...(value && typeof value === 'object' && !Array.isArray(value) ? value : {}) };
    }
    for (const kind of Object.keys(defaults.events)) result.events[kind] = { ...usageDefaults().events[kind], ...(saved.events?.[kind] || {}) };
    delete result.outcomeNotice;
    return result;
  }
  validateUsageSettings(result) {
    if (!result || typeof result !== 'object' || Array.isArray(result)) throw new Error('用量设置格式无效');
    for (const kind of ['press', 'turnCost', 'question', 'approval']) {
      const event = result.events?.[kind];
      if (!event || !Number.isFinite(Number(event.vol)) || Number(event.vol) < 0 || Number(event.vol) > 1) throw new Error('提示音量须在 0% 到 100% 之间');
      event.vol = Number(event.vol);
      if (event.lines !== undefined && (!Array.isArray(event.lines) || event.lines.length > 64)) throw new Error('提示内容格式无效');
    }
    for (const [key, field] of [['alert', 'below'], ['budget', 'amount']]) if (!Number.isFinite(Number(result[key]?.[field])) || Number(result[key][field]) < 0) throw new Error('提醒阈值须为非负数字');
    return result;
  }
  prepareUsageSettings(patch, { base } = {}) {
    if (!patch || typeof patch !== 'object' || Array.isArray(patch)) throw new Error('用量设置格式无效');
    const result = this.resolveUsageSettings(base === undefined ? readJson(this.usageSettingsFile, {}) : base);
    for (const key of Object.keys(result)) if (key !== 'events' && patch[key] && typeof patch[key] === 'object') result[key] = { ...result[key], ...patch[key] };
    if (patch.events && typeof patch.events === 'object' && !Array.isArray(patch.events)) {
      for (const kind of Object.keys(result.events)) if (patch.events[kind] && typeof patch.events[kind] === 'object') {
        result.events[kind] = { ...result.events[kind], ...patch.events[kind] };
      }
    }
    return this.validateUsageSettings(result);
  }
  commitUsageSettings(settings, { fs } = {}) {
    const result = this.validateUsageSettings(structuredClone(settings));
    writeJson(this.usageSettingsFile, result, fs ? { fs } : undefined);
    return { ok: true, settings: result };
  }
  writeUsageSettings(patch, options) {
    return this.commitUsageSettings(this.prepareUsageSettings(patch), options);
  }
  updateWait(...args) { return this.noticePublisher.updateWait(...args); }
  waitStatus(...args) { return this.noticePublisher.waitStatus(...args); }
  lastTurn(...args) { return this.noticePublisher.lastTurn(...args); }
  beginTurn(...args) { return this.turnAccounting.beginTurn(...args); }
  updateTurn(...args) { return this.turnAccounting.updateTurn(...args); }
  persistTurn(...args) { return this.turnAccounting.persistTurn(...args); }
  prepareRecovery(...args) { return this.turnAccounting.prepareRecovery(...args); }
  finishMissingRecovery(...args) { return this.turnAccounting.finishMissingRecovery(...args); }
  finishTurn(...args) { return this.turnAccounting.finishTurn(...args); }
  settleTurn(...args) { return this.turnAccounting.settleTurn(...args); }
  reviseRootEstimate(...args) { return this.turnAccounting.reviseRootEstimate(...args); }
  reviseRecord(...args) { return this.turnAccounting.reviseRecord(...args); }
  markCostUnknown(...args) { return this.turnAccounting.markCostUnknown(...args); }
  scheduleCostCheck(...args) { return this.turnAccounting.scheduleCostCheck(...args); }
  cancelOutcomeNotice(...args) { return this.noticePublisher.cancelOutcomeNotice(...args); }
  queueNotice(...args) { return this.noticePublisher.queueNotice(...args); }
  publishNotice(...args) { return this.noticePublisher.publishNotice(...args); }
  close(options) {
    this.balanceQuery.close();
    this.noticePublisher.close();
    return this.turnAccounting.close(options);
  }
}

export { estimateUsage } from './turn-accounting.mjs';
