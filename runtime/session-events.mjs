export const SESSION_TOKEN_FIELDS = Object.freeze([
  'input_tokens', 'cached_input_tokens', 'cache_write_input_tokens',
  'output_tokens', 'reasoning_output_tokens',
]);

export const REALTIME_EVENT_PATTERN = /"(?:session_meta|response_item|token_count|turn_context|task_started|task_complete|turn_started|turn_completed|turn_aborted|task_aborted|error|stream_error|request_user_input|request_user_input_async|request_permissions|function_call_output)"/;
export const HISTORY_EVENT_PATTERN = /"(?:token_count|session_meta)"/;

export function sessionTimestamp(value) {
  return typeof value === 'number' ? (value < 1e12 ? value * 1000 : value) : Date.parse(value);
}

export function decodeSessionEvent(line, pattern = REALTIME_EVENT_PATTERN) {
  if (typeof line !== 'string') return line && typeof line === 'object' ? line : null;
  if (!pattern.test(line)) return null;
  try { return JSON.parse(line); } catch { return null; }
}

// Both live and historical projections use these field names. Historical
// snapshots require safe integers; live counters retain the existing Number()
// compatibility for Codex versions that serialized numbers as strings.
export function normalizeSessionUsage(value, { fields = SESSION_TOKEN_FIELDS, strict = false } = {}) {
  return Object.fromEntries(fields.map(key => {
    const raw = value?.[key];
    const count = strict ? Number.isSafeInteger(raw) && raw >= 0 ? raw : 0 : Math.max(0, Number(raw) || 0);
    return [key, count];
  }));
}

export function sessionCounterDifference(next, previous, fields = SESSION_TOKEN_FIELDS) {
  const reset = !!previous && (next.input_tokens < previous.input_tokens || next.output_tokens < previous.output_tokens);
  if (!previous || reset) return { reset, delta: null };
  return { reset: false, delta: Object.fromEntries(fields.map(key => [key, Math.max(0, next[key] - previous[key])])) };
}
