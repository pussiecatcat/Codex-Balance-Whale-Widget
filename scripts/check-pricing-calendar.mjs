import { readPricingCalendar } from '../runtime/pricing-schedule.mjs';

const calendar = readPricingCalendar();
const years = Object.keys(calendar.years || {}).map(Number).filter(Number.isFinite).sort((a, b) => a - b);
if (!years.length) {
  console.log('::warning::DeepSeek 峰谷日历为空；界面会显示「时段规则需更新」，请补充 runtime/pricing-schedule.json');
  process.exit(0);
}
const latest = years.at(-1);
const expiry = Date.parse(`${latest}-12-31T23:59:59+08:00`);
const days = Math.floor((expiry - Date.now()) / 86400000);
if (days <= 60) {
  console.log(`::warning::DeepSeek 峰谷日历覆盖到 ${latest}-12-31（剩 ${days} 天），请核对官方定价并补充下一年`);
} else {
  console.log(`DeepSeek 峰谷日历覆盖到 ${latest}-12-31（剩 ${days} 天）`);
}
