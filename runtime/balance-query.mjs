import { createHash } from 'node:crypto';

// Owns balance request ordering, cache identity, and the currently observed
// account/currency scope. It never owns a turn or a notification.
export class BalanceQuery {
  #activeScope = null;

  constructor({ config, provider, ledger, clock = Date.now }) {
    this.config = config;
    this.provider = provider;
    this.ledger = ledger;
    this.clock = clock;
    this.cache = new Map();
    this.inFlight = new Map();
    this.latestSamples = new Map();
    this.latestQueries = new Map();
    this.balanceSequence = 0;
    this.closed = false;
  }
  close() { this.closed = true; }
  getActiveScope() { return this.#activeScope; }
  scope(c, currency) { return c.accountId + '-' + currency; }
  balanceIdentity(c) {
    const s = c.setting || {};
    // Prices and UI preferences do not change the API meter. Its adapter and
    // conversion settings do; never compare readings expressed on two scales.
    return JSON.stringify([c.accountId, s.provider, s.currency, s.balancePath, s.balanceField,
      s.usedField, s.balanceScale, s.billingUsageDivisor, s.quotaPerUnit]);
  }
  isCurrentBalanceContext(c) {
    try { return this.balanceIdentity(c) === this.balanceIdentity(this.config.resolve()); }
    catch { return false; }
  }
  newestBalanceSample(c, currency) {
    const query = this.latestQueries.get(this.balanceIdentity(c));
    const scoped = this.latestSamples.get(this.scope(c, currency));
    return !scoped || query && query.sequence > scoped.sequence ? query : scoped;
  }
  balanceCache(c, cacheKey) {
    const cached = this.cache.get(cacheKey);
    if (!cached) return null;
    const latest = this.newestBalanceSample(c, cached.payload.currency);
    if (!latest || latest.sequence <= (cached.sequence || 0)) return cached;
    return latest.identity === this.balanceIdentity(c) ? latest : null;
  }
  stoppedBalance() { return { ok: false, code: 'STOPPED', error: '挂件正在退出，余额将在下次启动时刷新' }; }
  async getBalance({ force = false, context = null } = {}) {
    if (this.closed) return this.stoppedBalance();
    let c;
    try { c = context || this.config.resolve(); }
    catch (error) { return { ok: false, code: 'CONFIG', error: error.message }; }
    const cacheKey = c.accountId + ':' + JSON.stringify(c.setting);
    const identity = this.balanceIdentity(c), cached = this.balanceCache(c, cacheKey);
    // Each caller checks its own context, even when it joins a round's request.
    // A UI request made before an account/currency switch returns current data.
    const deliver = value => {
      if (this.closed) return this.stoppedBalance();
      if (!context) {
        if (!this.isCurrentBalanceContext(c)) return this.getBalance();
        if (value.superseded) {
          const latest = this.newestBalanceSample(c, value.currency);
          return latest?.identity === identity ? this.decorate(c, latest.payload) : this.getBalance({ force: true });
        }
      }
      return value;
    };
    if (!force && cached && this.clock() - cached.at < Math.min(c.setting.refreshSeconds, 25) * 1000) return deliver(this.decorate(c, cached.payload));
    if (this.inFlight.has(cacheKey)) return deliver(await this.inFlight.get(cacheKey));
    const sequence = ++this.balanceSequence;
    const request = (async () => {
      try {
        const payload = await this.provider.balance(c);
        if (this.closed) return this.stoppedBalance();
        const scope = this.scope(c, payload.currency);
        const latest = this.newestBalanceSample(c, payload.currency);
        if (latest && (sequence < latest.sequence || latest.identity !== identity && !this.isCurrentBalanceContext(c))) {
          // Keep the actual request's sample for a round's interval; replacing
          // its end with a newer sample could include another task's debit.
          // UI callers receive the latest compatible sample in deliver().
          return { ...this.decorate(c, payload, { activate: false }), superseded: true,
            ...(latest.identity !== identity ? { stale: true } : {}) };
        }
        const meterKey = createHash('sha256').update(identity).digest('hex');
        this.ledger.observe(scope, { ...payload, meterKey });
        const sample = { at: this.clock(), sequence, identity, payload };
        this.latestSamples.set(scope, sample);
        this.latestQueries.set(identity, sample);
        this.cache.set(cacheKey, sample);
        return this.decorate(c, payload);
      } catch (error) {
        if (this.closed) return this.stoppedBalance();
        const fallback = this.balanceCache(c, cacheKey);
        if (error.transient && fallback) return { ...this.decorate(c, fallback.payload), stale: true, error: error.message };
        return { ok: false, code: error.code || 'ERROR', error: error.code ? error.message : '余额服务暂时不可用', providerName: c.providerName, dashboardUrl: c.dashboardUrl, baseUrl: c.baseUrl, todayUsage: this.ledger.records(this.scope(c, c.setting.currency)).today.total, currency: c.setting.currency, usageMode: 'ledger' };
      } finally { this.inFlight.delete(cacheKey); }
    })();
    this.inFlight.set(cacheKey, request);
    return deliver(await request);
  }
  decorate(c, payload, { activate = true } = {}) {
    const scope = this.scope(c, payload.currency);
    const records = this.ledger.records(scope);
    if (activate && this.isCurrentBalanceContext(c)) this.#activeScope = scope;
    return { ...payload, todayUsage: records.today.total, observedSince: records.today.since, usageMode: 'ledger', usageNote: records.note };
  }
}
