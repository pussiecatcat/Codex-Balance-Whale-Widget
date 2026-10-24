import { createLifecycle } from '../../services/lifecycle.js';

// Poll completed turns once, persist the cursor, and deliver fresh notices to the widget.
export function createTurnNoticePoller(deps) {
  const { window, localStorage, fetch: fetchImpl, WhaleTurnNotice, CustomEvent,
    getCurrency, setLastTurnNotice, playTaskEndSound, getFeedbackVolume,
    showCostBubble, playFeedback = () => {}, isSubscription = () => false,
    showSubscriptionNotice = () => {}, notifyQuotaSettled = () => {}, now = Date.now } = deps;
  const lifecycle = createLifecycle();
  const LAST_TURN_URL = '/dsh-whale/last-turn.json';
  let lastCostSeq = 0;
  let lastCostAligned = false;
  let lastCostId = '';
  let lastCostPending = false;
  const costPollingStartedAt = now();
  try {
    const lastCostStored = Number(localStorage.getItem('dshw-last-seq') || 0);
    if (isFinite(lastCostStored) && lastCostStored >= 0) lastCostSeq = lastCostStored;
    lastCostId = localStorage.getItem('dshw-last-turn-id') || '';
  } catch (err) {}

  function pollLastTurn() {
    if (lifecycle.disposed || lastCostPending) return;
    lastCostPending = true;
    try {
      return fetchImpl(LAST_TURN_URL, { cache: 'no-store', signal: lifecycle.signal }).then(function (r) {
        return lifecycle.disposed ? null : r.json();
      }).then(function (d) {
        if (lifecycle.disposed || !d || !d.ok || typeof d.seq !== 'number') return;
        if (d.seq < lastCostSeq) return;
        const firstPoll = !lastCostAligned;
        lastCostAligned = true;
        const fresh = WhaleTurnNotice.shouldNotify(d, {
          seq: lastCostSeq, id: lastCostId, firstPoll: firstPoll, startedAt: costPollingStartedAt
        });
        lastCostSeq = d.seq;
        if (d.id) lastCostId = d.id;
        try {
          localStorage.setItem('dshw-last-seq', String(lastCostSeq));
          localStorage.setItem('dshw-last-turn-id', lastCostId);
        } catch (err) {}
        const notice = WhaleTurnNotice.snapshot(d, getCurrency());
        setLastTurnNotice(notice);
        if (!fresh) return;
        window.dispatchEvent(new CustomEvent('whale-turn-notice', { detail: notice }));
        if (notice.completionKind === 'success') playTaskEndSound();
        else if (notice.completionKind === 'cancelled' || notice.failureKind === 'high-demand') {
          playFeedback(notice.completionKind, '', getFeedbackVolume());
        }
        if (isSubscription()) {
          showSubscriptionNotice(notice);
          notifyQuotaSettled();
        }
        showCostBubble(notice.amount, notice);
      }).catch(function () {}).finally(function () { lastCostPending = false; });
    } catch (err) { lastCostPending = false; }
  }

  return Object.freeze({ poll: pollLastTurn, dispose: lifecycle.dispose });
}
