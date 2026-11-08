import fs from 'node:fs';
import path from 'node:path';
import { readJson, writeJson, dayKey, DAY_MS, rounded } from './paths.mjs';

const initialLedger = () => ({ version: 1, revision: 0, date: '', observed: 0, firstObservation: null, lastObservation: null, history: {}, events: [], correctionLog: [] });
const MONEY_SCALE = 100000000;
const USAGE_NOTE = '每日合计来自同密钥累计消耗或余额差值；停机或跨午夜的观测间隔归入再次观测日，不能拆成精确逐请求账单。日汇总保留 365 天，明细保留 90 天且最多 20000 条。旧版已删除的日汇总显示未知，不冒充零消费；模型金额为配置价格估算。';
const ignoreError = () => {};
const modelRows = models => [...models].map(([model, cost]) => ({ model: model + '（估算）', cost: rounded(cost) })).sort((a, b) => b.cost - a.cost);
const units = value => {
  const scaled = Math.round(Number(value) * MONEY_SCALE);
  if (!Number.isSafeInteger(scaled)) throw new Error('金额超出八位小数安全范围');
  return BigInt(scaled);
};
const money = value => Number(value) / MONEY_SCALE;

export class UsageLedger {
  constructor(dataDir) { this.dataDir = dataDir; this.warnings = new Map(); this.lastSeen = new Map(); this.todayCache = new Map(); }
  file(scope) {
    if (!/^[a-f0-9]{24}-[A-Z]{3}$/.test(scope)) throw new Error('记账账户标识无效');
    return path.join(this.dataDir, 'ledgers', scope + '.json');
  }
  warningFile(scope) { return this.file(scope).replace(/\.json$/, '.warning.json'); }
  // The meter sidecar holds only the latest balance reading. A valid poll every
  // minute used to rewrite the whole event ledger (about 30 MB) just to move a
  // timestamp; this file is a few hundred bytes and is folded back into the
  // main ledger whenever one is written.
  meterFile(scope) { return this.file(scope).replace(/\.json$/, '.meter.json'); }
  load(scope) {
    let recovered = false;
    const value = readJson(this.file(scope), initialLedger(), {
      backup: true,
      onRecover: () => { recovered = true; },
    });
    const meter = readJson(this.meterFile(scope), null);
    if (meter && Number.isFinite(meter.at) && (!value.lastObservation || meter.at >= value.lastObservation.at)) {
      value.date = meter.date || value.date;
      value.observed = Number(meter.observed) || 0;
      value.firstObservation = meter.firstObservation ?? value.firstObservation;
      value.lastObservation = meter.lastObservation || value.lastObservation;
      value.revision = Math.max(Number(value.revision) || 0, Number(meter.revision) || 0);
    }
    if (recovered) {
      // Put the recovered snapshot back so later reads are clean again. Do not
      // back it up: the corrupt file must not replace the good backup.
      try { this.save(scope, value, { backup: false }); } catch {}
      const message = '账本文件损坏，已从上一份备份恢复。';
      this.warnings.set(scope, message);
      // The repaired file no longer looks corrupt on the next launch. Keep a
      // marker so the user still sees the notice once, until they dismiss it.
      try { writeJson(this.warningFile(scope), { message, at: new Date().toISOString() }); } catch (error) { ignoreError(error); }
    } else if (!this.warnings.has(scope)) {
      try {
        const saved = readJson(this.warningFile(scope), null);
        if (saved && typeof saved.message === 'string' && saved.message) this.warnings.set(scope, saved.message);
      } catch (error) { ignoreError(error); }
    }
    return value;
  }
  acknowledgeWarning(scope) {
    this.warnings.delete(scope);
    this.todayCache.delete(scope);
    try { fs.rmSync(this.warningFile(scope), { force: true }); } catch (error) { ignoreError(error); }
  }
  save(scope, ledger, { backup = true } = {}) {
    ledger.revision = Number(ledger.revision || 0) + 1;
    writeJson(this.file(scope), ledger, { flush: true, backup });
    // The main file now carries the meter fields, so an older sidecar must not
    // be allowed to win the merge on the next load.
    try { fs.rmSync(this.meterFile(scope), { force: true }); } catch (error) { ignoreError(error); }
    this.todayCache.delete(scope);
  }
  saveMeter(scope, ledger) {
    ledger.revision = Number(ledger.revision || 0) + 1;
    writeJson(this.meterFile(scope), {
      version: 1, revision: ledger.revision, date: ledger.date, observed: ledger.observed,
      firstObservation: ledger.firstObservation, lastObservation: ledger.lastObservation,
      at: Number(ledger.lastObservation?.at) || Date.now(),
    }, { flush: true });
    this.todayCache.delete(scope);
  }
  clearReadCache(scope) { if (scope) this.todayCache.delete(scope); else this.todayCache.clear(); }
  archiveFile(scope) { return path.join(this.dataDir, 'ledgers', scope + '.archive.json'); }
  archive(scope, entries, summaries = {}) {
    if (!entries.length && !Object.keys(summaries).length) return;
    const current = readJson(this.archiveFile(scope), { version: 1, events: [], history: {} });
    current.history = { ...(current.history || {}), ...summaries };
    const seen = new Set((current.events || []).map(item => item.id).filter(Boolean));
    for (const item of entries) if (!item.id || !seen.has(item.id)) { current.events.push(item); if (item.id) seen.add(item.id); }
    current.events = current.events.slice(-200000);
    writeJson(this.archiveFile(scope), current);
  }
  rollover(led, now) {
    const today = dayKey(now);
    if (led.date !== today) {
      if (led.date) led.history[led.date] = { total: led.observed, since: led.firstObservation };
      // Keep the last meter reading across midnight. The interval spanning
      // midnight belongs to its observation date; it is not a per-request bill.
      led.date = today; led.observed = 0; led.firstObservation = null;
    }
    return led;
  }
  observe(scope, sample, now = Date.now()) {
    const loaded = this.load(scope);
    // Only a strictly older reading is stale. Two callers can poll within the
    // same millisecond, and such a reading is new: dropping it would silently
    // lose consumption on fast machines while a duplicate contributes zero.
    // The in-memory reading also orders polls that were intentionally not
    // written to disk because nothing changed.
    const seen = this.lastSeen.get(scope);
    const ordering = seen && (!loaded.lastObservation || seen.at > loaded.lastObservation.at) ? seen : loaded.lastObservation;
    if (ordering && now < ordering.at) return loaded;
    const previousDate = loaded.date, previousFirst = loaded.firstObservation;
    const led = this.rollover(loaded, now);
    const balance = Number.isFinite(sample.totalBalance) ? sample.totalBalance : null;
    const used = Number.isFinite(sample.totalUsed) ? sample.totalUsed : null;
    const last = loaded.lastObservation;
    let delta = 0n;
    const meterKey = typeof sample.meterKey === 'string' && /^[a-f0-9]{64}$/.test(sample.meterKey) ? sample.meterKey : null;
    // A newer reading can legitimately reset to zero. Ordering is handled by
    // the service, while a changed adapter/scale starts a new meter baseline.
    if (last && (!meterKey || !last.meterKey || last.meterKey === meterKey)) {
      if (used !== null && last.used !== null && used >= last.used) delta = units(used) - units(last.used);
      else if (used === null && last.used === null && balance !== null && last.balance !== null && balance < last.balance) delta = units(last.balance) - units(balance);
    }
    led.observed = money(units(led.observed) + delta);
    led.firstObservation ||= now;
    led.lastObservation = { balance, used, at: now, ...(meterKey ? { meterKey } : {}) };
    this.lastSeen.set(scope, led.lastObservation);
    // A steady balance polled every minute changes only the timestamp. Keeping
    // that in memory is enough for ordering; writing a 20k-event ledger each
    // time is what made a successful query expensive. Any real change (amount,
    // meter, date rollover or first observation) still reaches disk immediately.
    const changed = delta !== 0n || !last || last.balance !== balance || last.used !== used ||
      (last.meterKey || null) !== meterKey || previousDate !== led.date || previousFirst !== led.firstObservation;
    // A day rollover also writes the finished day into history, so that one
    // still needs the full ledger. Every other meter change is sidecar-sized.
    if (changed) {
      if (previousDate !== led.date) this.save(scope, led);
      else this.saveMeter(scope, led);
    }
    return led;
  }
  append(scope, event) {
    const led = this.load(scope);
    if (led.events.some(e => this.sameEvent(e, event))) return false;
    led.events.push({ ...event, day: dayKey(event.ts) });
    const reference = Math.max(Number(event.ts) || 0, Number(led.lastObservation?.at) || 0, ...led.events.map(item => Number(item.ts) || 0));
    const cutoff = reference - 90 * 86400000;
    const keptByAge = led.events.filter(item => Number(item.ts) >= cutoff);
    const kept = keptByAge.slice(-20000);
    const keepIds = new Set(kept.map(item => item.id));
    this.archive(scope, led.events.filter(item => !keepIds.has(item.id)));
    led.missingSummaryDays = [...new Set([...(led.missingSummaryDays || []), ...led.events.filter(item => !keepIds.has(item.id) && item.day !== led.date && !Object.hasOwn(led.history, item.day)).map(item => item.day)])].slice(-365);
    led.events = kept;
    const historyCutoff = dayKey(reference - 365 * 86400000);
    const summaries = {};
    for (const day of Object.keys(led.history || {})) if (day < historyCutoff) summaries[day] = led.history[day];
    this.archive(scope, [], summaries);
    for (const day of Object.keys(summaries)) delete led.history[day];
    this.save(scope, led); return true;
  }
  // Before the identity ledger existed, subscription turns were written under
  // whichever API key was configured. Copy the root rows that carry only token
  // counts into the identity scope so an upgrade does not hide that history.
  // Rows with an amount are deliberately left alone: their money belongs to the
  // per-key API ledger and must not be merged into the subscription view.
  migrateLegacyTokenHistory(targetScope, now = Date.now()) {
    const target = this.load(targetScope);
    const seen = new Set(target.events.map(event => event.id).filter(Boolean));
    const added = [];
    let names = [];
    try { names = fs.readdirSync(path.join(this.dataDir, 'ledgers')); } catch { return 0; }
    for (const name of names) {
      if (!/^[a-f0-9]{24}-[A-Z]{3}\.json$/.test(name)) continue;
      const scope = name.slice(0, -5);
      if (scope === targetScope) continue;
      let source;
      try { source = readJson(this.file(scope), null); } catch { continue; }
      if (!source || !Array.isArray(source.events)) continue;
      for (const event of source.events) {
        if (!event || !event.id || event.isSubagent) continue;
        if (event.source !== 'token-only' || event.cost != null || event.amount != null) continue;
        if (seen.has(event.id)) continue;
        seen.add(event.id);
        added.push({ ...event, day: event.day || dayKey(event.ts), currency: targetScope.slice(-3),
          cost: null, amount: null, costState: 'unknown', source: 'token-only', migratedFrom: scope });
      }
    }
    if (!added.length) return 0;
    const reference = Math.max(now, ...target.events.map(event => Number(event.ts) || 0), ...added.map(event => Number(event.ts) || 0));
    const cutoff = reference - 90 * 86400000;
    const kept = [...target.events, ...added]
      .sort((a, b) => (Number(a.ts) || 0) - (Number(b.ts) || 0))
      .filter(event => (Number(event.ts) || 0) >= cutoff)
      .slice(-20000);
    target.events = kept;
    this.save(targetScope, target);
    return added.length;
  }
  reconcile(scope, input, now = Date.now()) {
    const led = this.rollover(this.load(scope), now);
    const revision = Number(input?.revision);
    if (!Number.isSafeInteger(revision) || revision !== Number(led.revision || 0)) {
      const error = new Error('账本已变化，请刷新后重试'); error.status = 409; throw error;
    }
    const values = {}, fixed = {};
    for (const key of ['opening', 'credits', 'otherDebits', 'last']) {
      const supplied = input?.[key];
      const raw = typeof supplied === 'number' && supplied > 0 && supplied < 1e-6 ? supplied.toFixed(8) : String(supplied ?? '');
      const value = Number(raw);
      if (!/^(?:0|[1-9]\d*)(?:\.\d{1,8})?$/.test(raw) || !Number.isFinite(value) || !Number.isSafeInteger(Math.round(value * 1e8))) throw new Error('校正金额须为非负数字，最多八位小数');
      values[key] = value;
      const [whole, decimal = ''] = raw.split('.');
      fixed[key] = BigInt(whole) * BigInt(MONEY_SCALE) + BigInt(decimal.padEnd(8, '0'));
    }
    const amount = money(fixed.opening + fixed.credits - fixed.otherDebits - fixed.last);
    if (amount < 0) throw new Error('校正结果为负，请核对充值与其他扣款');
    const date = input?.date || dayKey(now);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(Date.parse(date)) || new Date(date).toISOString().slice(0, 10) !== date) throw new Error('校正日期无效');
    if (date === led.date) led.observed = amount;
    else led.history[date] = { total: amount, since: now, source: 'balance-corrected' };
    led.correctionLog = [...(led.correctionLog || []), { date, ...values, amount, at: now, revision: revision + 1 }].slice(-50);
    this.save(scope, led);
    return { ok: true, date, amount, revision: led.revision, source: 'balance-corrected' };
  }
  sameEvent(existing, event) {
    return existing.id === event.id || !!(event.sessionId && event.turnId &&
      existing.id?.endsWith(event.sessionId + ':' + event.turnId));
  }
  find(scope, event) { return this.load(scope).events.find(e => this.sameEvent(e, event)) || null; }
  scopes(accountId) {
    try {
      return fs.readdirSync(path.join(this.dataDir, 'ledgers'))
        .filter(name => /^[a-f0-9]{24}-[A-Z]{3}\.json$/.test(name) && name.startsWith(accountId + '-'))
        .map(name => name.slice(0, -5));
    } catch { return []; }
  }
  moveEvent(from, to, id, patch = {}) {
    if (from === to) return false;
    const event = this.load(from).events.find(item => item.id === id);
    if (!event) return false;
    this.append(to, { ...event, ...patch, currency: to.slice(-3) });
    const source = this.load(from);
    const index = source.events.findIndex(item => item.id === id);
    if (index >= 0) { source.events.splice(index, 1); this.save(from, source); }
    return true;
  }
  revise(scope, id, patch) {
    const led = this.load(scope), index = led.events.findIndex(e => e.id === id);
    if (index < 0) return null;
    const before = led.events[index];
    if (Object.entries(patch).every(([key, value]) => JSON.stringify(before[key]) === JSON.stringify(value))) return before;
    const next = { ...before, ...patch, id: before.id, ts: before.ts, day: before.day, revision: (before.revision || 0) + 1 };
    led.events[index] = next; this.save(scope, led); return next;
  }
  records(scope, now = Date.now()) {
    const led = this.rollover(this.load(scope), now);
    const today = dayKey(now);
    // Index estimated model costs once; every day in the response would
    // otherwise rescan the full event list.
    const modelIndex = new Map();
    for (const event of led.events) {
      if (event.source !== 'configured-pricing-estimate') continue;
      const dayModels = modelIndex.get(event.day) || new Map();
      dayModels.set(event.model, (dayModels.get(event.model) || 0) + (event.cost || 0));
      modelIndex.set(event.day, dayModels);
    }
    const modelsFor = day => modelRows(modelIndex.get(day) || new Map());
    const totalDay = day => day === today ? led.observed : Object.hasOwn(led.history, day) ? Number(led.history[day].total || 0) : null;
    const days7 = [];
    for (let i = 0; i < 7; i++) {
      // Step in the same UTC+8 frame dayKey uses. Local-time setDate() here
      // produced the right bucket only for hosts already on UTC+8.
      const date = dayKey(now - i * DAY_MS), total = totalDay(date);
      days7.push({ date, total, totalState: total === null ? 'unknown' : 'observed', models: modelsFor(date) });
    }
    const days = [...new Set([today, ...Object.keys(led.history), ...led.events.map(e => e.day), ...(led.missingSummaryDays || [])])].sort().reverse();
    const missingSummaryDays = days.filter(date => totalDay(date) === null);
    return { ok: true, revision: Number(led.revision || 0), today: { total: led.observed, models: modelsFor(today), since: led.firstObservation,
      source: (led.correctionLog || []).some(item => item.date === today) ? 'balance-corrected' : 'balance-observed' }, days7,
      total7: rounded(days7.reduce((n, d) => n + (d.total || 0), 0)),
      total7Complete: days7.every(d => d.total !== null),
      all: { days: days.map(date => ({ date, total: totalDay(date), totalState: totalDay(date) === null ? 'unknown' : 'observed', models: modelsFor(date) })),
        total: rounded(days.reduce((n, day) => n + (totalDay(day) || 0), 0)), totalComplete: missingSummaryDays.length === 0,
        missingSummaryDays, events: led.events.slice(-20000).reverse(), storedEventCount: led.events.length, detailLimit: 20000,
        correctionLog: (led.correctionLog || []).slice(-50).reverse() },
      warning: this.warnings.get(scope) || '',
      usageSource: 'observed-api-debits', note: USAGE_NOTE };
  }
  // Cheap read used by the balance decoration path: no 7-day/all-history
  // buckets, and no event list in the payload.
  today(scope, now = Date.now()) {
    const day = dayKey(now);
    let stamp = '';
    try { const stat = fs.statSync(this.file(scope)); stamp = stat.mtimeMs + ':' + stat.size; } catch (error) { ignoreError(error); }
    // Meter updates no longer touch the main file, so its mtime alone would
    // keep serving the previous observation from cache.
    try { const stat = fs.statSync(this.meterFile(scope)); stamp += '|' + stat.mtimeMs + ':' + stat.size; } catch (error) { ignoreError(error); }
    const cacheKey = day + '|' + stamp;
    const cached = this.todayCache.get(scope);
    if (cached && cached.key === cacheKey && stamp) return cached.value;
    const led = this.rollover(this.load(scope), now);
    const models = new Map();
    for (const event of led.events) {
      if (event.day !== day || event.source !== 'configured-pricing-estimate') continue;
      models.set(event.model, (models.get(event.model) || 0) + (event.cost || 0));
    }
    const value = { total: led.observed, models: modelRows(models), since: led.firstObservation,
      source: (led.correctionLog || []).some(item => item.date === day) ? 'balance-corrected' : 'balance-observed',
      warning: this.warnings.get(scope) || '', note: USAGE_NOTE };
    if (stamp) this.todayCache.set(scope, { key: cacheKey, value });
    return value;
  }
}

export function usageDefaults() {
  return {
    taskEnd: { on: false, sel: 'preset:duck:press', vol: 1, volSet: false },
    events: {
      press: { vol: 1 },
      turnCost: { vol: 1, volSet: false, bubbleOn: true },
      question: { on: true, soundOn: false, sel: 'preset:duck:press', vol: 1, bubbleOn: true, lines: [
        { type: 'text', text: 'Codex 正在等你回答', size: 6, bold: true },
        { type: 'text', text: '{session}', size: 3, color: '#5a6a92' },
      ] },
      approval: { on: true, soundOn: false, sel: 'preset:duck:press', vol: 1, bubbleOn: true, lines: [
        { type: 'text', text: 'Codex 正在等你授权', size: 6, bold: true },
        { type: 'text', text: '{session}', size: 3, color: '#5a6a92' },
      ] },
    },
    wait: { charClose: false },
    turnCost: {
      lines: [
        { type: 'text', text: '{turn_title}', size: 8, bold: true },
        { type: 'text', text: '{turn_primary}', size: 16, bold: true, rgb: 'indigo' },
        { type: 'text', text: '{turn_detail}', size: 2, color: '#5a6a92' },
      ],
      subscriptionLines: [
        { type: 'text', text: '{turn_title}', size: 4, bold: true, compact: true },
        { type: 'text', text: '{turn_primary}', size: 4, bold: true, rgb: 'indigo', compact: true },
        { type: 'text', text: '{turn_quota}', size: 3, bold: true, rgb: 'indigo', compact: true, nowrap: true },
        { type: 'text', text: '{turn_detail}', size: 4, color: '#5a6a92', compact: true },
      ],
    },
    alert: { on: true, below: 5, msg: '余额已低于 {currency}{below}', lines: [
      { type: 'text', text: '老大～你的 API 余额', size: 5, bold: true },
      { type: 'text', text: '已经不足 {currency}{below} 啦', size: 6, bold: true, rgb: 'rouge' },
      { type: 'image', imgId: 'bimg_yue_money', size: 6, imgScale: 0.3 },
      { type: 'link', text: '打开当前 API 账单', url: '/provider-dashboard', size: 2, color: '#ffffff', bgRgb: 'indigo' },
    ], autoClose: false, ttlSec: 6 },
    budget: { on: true, amount: 10, msg: '今日已观测用量达到 {currency}{amount}', lines: [
      { type: 'text', text: '今天已观测用量超过', size: 6, bold: true },
      { type: 'text', text: '{currency}{amount}', size: 7, bold: true, rgb: 'rouge' },
    ], autoClose: false, ttlSec: 6 },
  };
}
