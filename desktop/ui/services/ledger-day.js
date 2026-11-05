// The ledger buckets days in UTC+8 (see runtime/paths.mjs dayKey). Renderer
// views must use the same frame or "today" and the alert dedupe key drift on a
// host that is not already on China time.
export const LEDGER_DAY_OFFSET_MS = 8 * 3600000;

export function ledgerDayKey(ts = Date.now()) {
  return new Date(Number(ts) + LEDGER_DAY_OFFSET_MS).toISOString().slice(0, 10);
}
