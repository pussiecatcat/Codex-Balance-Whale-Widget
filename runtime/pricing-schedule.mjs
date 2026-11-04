import fs from 'node:fs';

// Display-only schedule. Never changes a provider bill or configured token prices.
// The holiday calendar is data, not code: rules change every year and must carry
// the source and the date they were checked. A missing file falls back to the
// verified 2026 table instead of switching the feature off.
const FILE = new URL('./pricing-schedule.json', import.meta.url);
const FALLBACK = {
  source: 'https://api-docs.deepseek.com/quick_start/pricing',
  rulesCheckedAt: '2026-09-28',
  effectiveFrom: '2026-09-19T00:00:00+08:00',
  timeZone: 'Asia/Shanghai',
  weekendOffPeak: true,
  peakHours: [[9, 12], [14, 18]],
  years: { 2026: [[1, 1, 3], [2, 15, 23], [4, 4, 6], [5, 1, 5], [6, 19, 21], [9, 25, 27], [10, 1, 7]] },
};

export function readPricingCalendar() {
  try {
    const value = JSON.parse(fs.readFileSync(FILE, 'utf8'));
    if (!value || typeof value !== 'object' || !value.years || typeof value.years !== 'object' || Array.isArray(value.years)) throw new Error('invalid');
    return value;
  } catch { return FALLBACK; }
}

const calendar = readPricingCalendar();
const holidays = new Map();
for (const [year, ranges] of Object.entries(calendar.years || {})) {
  const days = new Set();
  for (const [month, first, last] of Array.isArray(ranges) ? ranges : []) {
    for (let day = first; day <= last; day++) days.add(`${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`);
  }
  holidays.set(String(year), days);
}

function peakAt(now) {
  const bj = new Date(now + 8 * 3600000), day = bj.getUTCDay(), hour = bj.getUTCHours();
  const offDay = holidays.get(String(bj.getUTCFullYear()));
  if (!offDay) return false;
  if (calendar.weekendOffPeak !== false && (day === 0 || day === 6)) return false;
  if (offDay.has(bj.toISOString().slice(0, 10))) return false;
  return (calendar.peakHours || []).some(([from, to]) => hour >= from && hour < to);
}

export function pricingSchedule(config, now = Date.now()) {
  let host;
  try { host = new URL(config?.baseUrl).hostname; } catch { return { visible: false }; }
  if (host !== 'api.deepseek.com') return { visible: false };
  const year = new Date(now + 8 * 3600000).getUTCFullYear();
  const stale = !holidays.has(String(year)) || (calendar.effectiveFrom && now < Date.parse(calendar.effectiveFrom));
  if (stale) {
    // Do not silently extrapolate a holiday calendar into an unverified year.
    return { visible: true, phase: 'unknown', nextChangeAt: null, source: calendar.source, stale: true,
      note: '时段规则需更新，请查看官方定价。' };
  }
  const peak = peakAt(now);
  let next = Math.floor(now / 3600000) * 3600000 + 3600000;
  const deadline = now + 16 * 86400000;
  while (next < deadline && peakAt(next) === peak) next += 3600000;
  return { visible: true, phase: peak ? 'peak' : 'off-peak', nextChangeAt: next < deadline ? next : null,
    timeZone: calendar.timeZone || 'Asia/Shanghai', source: calendar.source, rulesCheckedAt: calendar.rulesCheckedAt, stale: false,
    note: '北京时间工作日 09–12、14–18 为高峰；周末及法定节假日为谷期。此提示不改变账单。' };
}
