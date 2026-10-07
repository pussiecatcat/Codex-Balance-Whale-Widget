import path from 'node:path';
import { readJson, writeJson, dayKey, rounded } from './paths.mjs';

const initialLedger = () => ({ version: 1, revision: 0, date: '', observed: 0, firstObservation: null, lastObservation: null, history: {}, events: [], correctionLog: [] });
const MONEY_SCALE = 100000000;
const units = value => {
  const scaled = Math.round(Number(value) * MONEY_SCALE);
  if (!Number.isSafeInteger(scaled)) throw new Error('金额超出八位小数安全范围');
  return BigInt(scaled);
};
const money = value => Number(value) / MONEY_SCALE;

export class UsageLedger {
  constructor(dataDir) { this.dataDir = dataDir; }
  file(scope) {
    if (!/^[a-f0-9]{24}-[A-Z]{3}$/.test(scope)) throw new Error('记账账户标识无效');
    return path.join(this.dataDir, 'ledgers', scope + '.json');
  }
  load(scope) { return readJson(this.file(scope), initialLedger()); }
  save(scope, ledger) { ledger.revision = Number(ledger.revision || 0) + 1; writeJson(this.file(scope), ledger); }
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
    if (loaded.lastObservation && now < loaded.lastObservation.at) return loaded;
    const led = this.rollover(loaded, now);
    const balance = Number.isFinite(sample.totalBalance) ? sample.totalBalance : null;
    const used = Number.isFinite(sample.totalUsed) ? sample.totalUsed : null;
    const last = led.lastObservation;
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
    this.save(scope, led); return led;
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
    const modelsFor = day => {
      const models = new Map();
      for (const e of led.events) {
        if (e.day !== day || e.source !== 'configured-pricing-estimate') continue;
        models.set(e.model, (models.get(e.model) || 0) + (e.cost || 0));
      }
      return [...models].map(([model, cost]) => ({ model: model + '（估算）', cost: rounded(cost) })).sort((a, b) => b.cost - a.cost);
    };
    const totalDay = day => day === today ? led.observed : Object.hasOwn(led.history, day) ? Number(led.history[day].total || 0) : null;
    const days7 = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(now); d.setDate(d.getDate() - i);
      const date = dayKey(d), total = totalDay(date);
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
      usageSource: 'observed-api-debits', note: '每日合计来自同密钥累计消耗或余额差值；停机或跨午夜的观测间隔归入再次观测日，不能拆成精确逐请求账单。日汇总保留 365 天，明细保留 90 天且最多 20000 条。旧版已删除的日汇总显示未知，不冒充零消费；模型金额为配置价格估算。' };
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
        { type: 'text', text: '{session}', size: 3, color: '#63719a' },
      ] },
      approval: { on: true, soundOn: false, sel: 'preset:duck:press', vol: 1, bubbleOn: true, lines: [
        { type: 'text', text: 'Codex 正在等你授权', size: 6, bold: true },
        { type: 'text', text: '{session}', size: 3, color: '#63719a' },
      ] },
    },
    wait: { charClose: false },
    turnCost: { lines: [
      { type: 'text', text: '{turn_title}', size: 6, bold: true },
      { type: 'text', text: '{turn_primary}', size: 16, bold: true, color: '#4059b3' },
      { type: 'text', text: '{turn_detail}', size: 2, color: '#63719a' },
    ] },
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
