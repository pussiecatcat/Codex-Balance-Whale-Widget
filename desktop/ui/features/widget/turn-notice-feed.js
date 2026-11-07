import DefaultFeedback from './feedback.js';
import DefaultQuota from '../../services/quota.js';
// Turn notices arrive as runtime pushes. One snapshot at startup seeds the
// cursor; later events carry the same payload the JSON route used to return.
export function createTurnNoticeFeed(deps) {
  const { fetch: fetchImpl, WhaleTurnNotice,
    WhaleFeedback = DefaultFeedback, WhaleQuota = DefaultQuota, accountView = null, uiState,
    getCurrency, setLastTurnNotice, playTaskEndSound, getFeedbackVolume,
    showCostBubble, now = Date.now } = deps;
  const LAST_TURN_URL = '/dsh-whale/last-turn.json';
  let lastCostSeq = 0;
  let lastCostAligned = false;
  let lastCostId = '';
  let lastCostPending = false;
  const costPollingStartedAt = now();
  try {
    const lastCostStored = Number(uiState.get('dshw-last-seq') || 0);
    if (isFinite(lastCostStored) && lastCostStored >= 0) lastCostSeq = lastCostStored;
    lastCostId = uiState.get('dshw-last-turn-id') || '';
  } catch { /* missing storage simply starts the cursor at zero */ }

  function process(d, { firstPoll = lastCostAligned ? false : true } = {}) {
    if (!d || !d.ok || typeof d.seq !== 'number') return;
    if (d.seq < lastCostSeq) return;
    lastCostAligned = true;
    const fresh = WhaleTurnNotice.shouldNotify(d, {
      seq: lastCostSeq, id: lastCostId, firstPoll, startedAt: costPollingStartedAt
    });
    lastCostSeq = d.seq;
    if (d.id) lastCostId = d.id;
    try {
      uiState.set('dshw-last-seq', String(lastCostSeq));
      uiState.set('dshw-last-turn-id', lastCostId);
    } catch { /* the notice itself still renders without the cursor */ }
    const notice = WhaleTurnNotice.snapshot(d, getCurrency());
    setLastTurnNotice(notice);
    if (!fresh) return;
    if (notice.completionKind === 'success') playTaskEndSound();
    else if ((notice.completionKind === 'cancelled' || notice.failureKind === 'high-demand') && WhaleFeedback) {
      WhaleFeedback?.play(notice.completionKind, '', getFeedbackVolume());
    }
    if (accountView?.mode === 'subscription') {
      accountView.notice(notice);
      WhaleQuota.settled();
    }
    showCostBubble(notice.amount, notice);
  }

  function snapshot() {
    if (lastCostPending) return Promise.resolve();
    lastCostPending = true;
    try {
      return Promise.resolve(fetchImpl(LAST_TURN_URL, { cache: 'no-store' }))
        .then(response => response.json())
        .then(data => process(data, { firstPoll: !lastCostAligned }))
        .catch(() => {})
        .finally(() => { lastCostPending = false; });
    } catch { lastCostPending = false; return Promise.resolve(); }
  }

  return Object.freeze({ snapshot, process });
}
