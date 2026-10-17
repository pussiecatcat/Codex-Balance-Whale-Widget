import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { NoticePublisher } from '../runtime/notice-publisher.mjs';

const SCOPE = 'acct-main-USD';

function fixture() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'whale-notice-'));
  const events = new Map();
  const marked = [];
  let clock = 1000;
  let failRevise = false;
  let failWrite = false;

  const failingFs = Object.create(fs);
  failingFs.renameSync = (...args) => {
    if (failWrite) { const error = new Error('no space left on device'); error.code = 'ENOSPC'; throw error; }
    return fs.renameSync(...args);
  };

  const ledger = {
    find: (scope, { id }) => events.get(scope + '|' + id) || null,
    revise(scope, id, patch) {
      if (failRevise) { failRevise = false; const error = new Error('ledger unavailable'); error.code = 'ENOSPC'; throw error; }
      marked.push([scope, id, patch]);
      const event = events.get(scope + '|' + id);
      if (event) Object.assign(event, patch);
    },
  };

  const publisher = new NoticePublisher({
    config: { resolve: () => ({ accountId: 'acct' }) },
    ledger,
    balance: { getActiveScope: () => SCOPE, scope: () => SCOPE },
    dataDir: dir,
    clock: () => clock++,
    fs: failingFs,
  });

  const lastFile = path.join(dir, 'last-turn.json');
  return {
    publisher,
    lastFile,
    seed(id, extra = {}) {
      events.set(SCOPE + '|' + id, { id, accountId: 'acct', notify: true, completionKind: 'success', turn: 1, cost: 1, ...extra });
    },
    marked,
    failRevise: value => { failRevise = value; },
    failWrite: value => { failWrite = value; },
    read: () => JSON.parse(fs.readFileSync(lastFile, 'utf8')),
    written: () => fs.existsSync(lastFile),
    cleanup: () => fs.rmSync(dir, { recursive: true, force: true }),
  };
}

test('publishing writes the notice the widget polls and then marks the ledger', () => {
  const fx = fixture();
  fx.seed('t1');
  fx.publisher.publishNotice(SCOPE, 't1');
  const notice = fx.read();
  assert.equal(notice.id, 't1');
  assert.equal(notice.seq, 1);
  assert.equal(typeof notice.noticeId, 'string', 'the file records which notice it carries');
  assert.equal(notice.amount, 1);
  assert.equal(notice.notificationAt, 1000);
  assert.deepEqual(fx.marked, [[SCOPE, 't1', { noticePublished: true }]]);
  fx.cleanup();
});

// The defect this replaced marked the ledger first, so a write that never landed
// left the ledger claiming the notice was sent and every later attempt skipped it.
test('a notice that never reached the disk is not marked, and the retry publishes it', () => {
  const fx = fixture();
  fx.seed('t1');
  fx.failWrite(true);
  assert.throws(() => fx.publisher.publishNotice(SCOPE, 't1'));
  assert.equal(fx.written(), false, 'nothing was written');
  assert.deepEqual(fx.marked, [], 'and the ledger must not claim otherwise');

  fx.failWrite(false);
  fx.publisher.publishNotice(SCOPE, 't1');
  assert.equal(fx.read().id, 't1', 'the retry publishes normally');
  assert.equal(fx.read().seq, 1, 'the failed attempt did not consume a sequence number');
  assert.equal(fx.marked.length, 1);
  fx.cleanup();
});

// The other half of the same window: the file landed but the ledger write failed.
// Re-running must not write the notice a second time, because seq is what the
// widget uses to decide a notice is new.
test('a ledger write failure after a landed notice replays without writing again', () => {
  const fx = fixture();
  fx.seed('t1');
  fx.failRevise(true);
  assert.throws(() => fx.publisher.publishNotice(SCOPE, 't1'));
  const first = fx.read();
  assert.equal(first.seq, 1);

  fx.publisher.publishNotice(SCOPE, 't1');
  assert.deepEqual(fx.read(), first, 'the same notice, not a rewritten one');
  assert.equal(fx.read().seq, 1, 'seq is what marks a notice as new, so it must not move');
  assert.deepEqual(fx.marked, [[SCOPE, 't1', { noticePublished: true }]], 'the retry settles the ledger');
  fx.cleanup();
});

test('a second turn takes the next sequence number', () => {
  const fx = fixture();
  fx.seed('t1');
  fx.seed('t2');
  fx.publisher.publishNotice(SCOPE, 't1');
  fx.publisher.publishNotice(SCOPE, 't2');
  assert.equal(fx.read().id, 't2');
  assert.equal(fx.read().seq, 2);
  fx.cleanup();
});

test('a notice already marked published is left alone', () => {
  const fx = fixture();
  fx.seed('t1', { noticePublished: true });
  fx.publisher.publishNotice(SCOPE, 't1');
  assert.equal(fx.written(), false);
  fx.cleanup();
});

test('the guard set refuses anything the widget could not show', () => {
  for (const [label, extra] of [
    ['notify off', { notify: false }],
    ['another account', { accountId: 'someone-else' }],
    ['an unfinished outcome', { completionKind: 'running' }],
  ]) {
    const fx = fixture();
    fx.seed('t1', extra);
    fx.publisher.publishNotice(SCOPE, 't1');
    assert.equal(fx.written(), false, label);
    assert.deepEqual(fx.marked, [], label);
    fx.cleanup();
  }

  const closed = fixture();
  closed.seed('t1');
  closed.publisher.close();
  closed.publisher.publishNotice(SCOPE, 't1');
  assert.equal(closed.written(), false, 'closed');
  closed.cleanup();

  const missing = fixture();
  missing.publisher.publishNotice(SCOPE, 'nope');
  assert.equal(missing.written(), false, 'unknown turn');
  missing.cleanup();
});

test('lastTurn still reads back what publishing wrote, and rejects another account', () => {
  const fx = fixture();
  fx.seed('t1');
  fx.publisher.publishNotice(SCOPE, 't1');
  const read = fx.publisher.lastTurn();
  assert.equal(read.id, 't1');
  assert.equal(read.seq, 1);
  fx.cleanup();
});
