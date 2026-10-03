(function (host, factory) {
  'use strict';
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else host.WhaleTurnNotice = api;
})(typeof globalThis === 'object' ? globalThis : this, function () {
  'use strict';
  function kind(record) {
    if (record.completionKind === 'failed' || ['failed','interrupted','superseded'].includes(record.outcome)) return 'failed';
    if (record.completionKind === 'cancelled' || ['aborted', 'cancelled'].includes(record.outcome)) return 'cancelled';
    return 'success';
  }
  function shouldNotify(record, { seq = 0, id = '', firstPoll = false, startedAt = 0 } = {}) {
    if (!record?.ok || !Number.isSafeInteger(record.seq) || record.seq <= seq || !record.id || record.id === id ||
        record.turn == null || record.notify === false || record.isSubagent) return false;
    const published = record.notificationAt || record.ts;
    const at = typeof published === 'number' ? published : Date.parse(published);
    return !firstPoll || Number.isFinite(at) && at >= startedAt;
  }
  function snapshot(record, nativeCurrency = 'USD', random = Math.random) {
    const completionKind = kind(record);
    const known = record.amount !== null && record.amount !== undefined && Number.isFinite(Number(record.amount)) &&
      !['pending', 'unknown'].includes(record.costState);
    const failureKind = completionKind === 'failed' && record.failureKind === 'high-demand' ? 'high-demand' : null;
    const tokenParts = { input: 0, output: 0, cachedInput: 0, reasoningOutput: 0 };
    let hasParts = false;
    for (const usage of Object.values(record.byModel || {})) {
      if (!usage || typeof usage !== 'object') continue;
      tokenParts.input += Number(usage.input_tokens) || 0;
      tokenParts.output += Number(usage.output_tokens) || 0;
      tokenParts.cachedInput += Number(usage.cached_input_tokens) || 0;
      tokenParts.reasoningOutput += Number(usage.reasoning_output_tokens) || 0;
      hasParts = true;
    }
    return Object.freeze({
      id: String(record.id || ''), completionKind,
      failureKind,
      label: failureKind ? '挤不进去...' : completionKind !== 'success' ? (record.source === 'configured-pricing-estimate' ? '本轮消耗（估算）:' : record.source === 'token-only' ? '本轮 token 用量:' : '本轮已观测消耗:') : String(record.label || '上一轮期间 API 扣费:'),
      amount: known ? Number(record.amount) : null,
      currency: record.currency || nativeCurrency,
      costState: known ? record.costState || 'observed' : record.costState === 'pending' ? 'pending' : 'unknown',
      tokens: Number.isFinite(record.tokens) && record.tokens >= 0 ? Math.floor(record.tokens) : null,
      inputTokens: hasParts ? Math.floor(tokenParts.input) : null,
      outputTokens: hasParts ? Math.floor(tokenParts.output) : null,
      cachedInputTokens: hasParts ? Math.floor(tokenParts.cachedInput) : null,
      reasoningOutputTokens: hasParts ? Math.floor(tokenParts.reasoningOutput) : null,
      sessionLabel: String(record.sessionLabel || '').slice(0, 120),
      note: String(record.note || ''),
    });
  }
  function enabled(notice, settings, turnCostOn) {
    return notice.completionKind === 'failed' && notice.failureKind === 'high-demand' || ['success','cancelled','failed'].includes(notice.completionKind) && !!turnCostOn;
  }
  return Object.freeze({ kind, shouldNotify, snapshot, enabled });
});
