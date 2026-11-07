import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { NoticePublisher } from '../runtime/notice-publisher.mjs';

function fixture() {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'whale-notice-'));
  const event = { id: 'turn-1', accountId: 'account', completionKind: 'success', notify: true, noticePublished: false, cost: 1.5, tokens: 12 };
  const publisher = new NoticePublisher({
    config: { resolve: () => ({ accountId: 'account', setting: { currency: 'USD' } }) },
    ledger: { find: () => event, revise: (_scope, _id, patch) => Object.assign(event, patch) },
    balance: { getActiveScope: () => null, scope: () => null },
    dataDir, clock: () => 1000,
  });
  return { publisher, dataDir, event };
}

test('a published turn notice is pushed exactly once', t => {
  const { publisher, dataDir } = fixture();
  t.after(() => { publisher.close(); fs.rmSync(dataDir, { recursive: true, force: true }); });
  const events = [];
  const unsubscribe = publisher.subscribe(event => events.push(event));
  publisher.publishNotice('scope', 'turn-1');
  assert.equal(events.length, 1);
  assert.equal(events[0].type, 'turn');
  assert.equal(events[0].payload.id, 'turn-1');
  assert.equal(events[0].payload.seq, 1);
  publisher.publishNotice('scope', 'turn-1');
  assert.equal(events.length, 1, 'a notice already published is not pushed again');
  unsubscribe();
});

test('pending wait changes are pushed with the current snapshot', t => {
  const { publisher, dataDir } = fixture();
  t.after(() => { publisher.close(); fs.rmSync(dataDir, { recursive: true, force: true }); });
  const events = [];
  publisher.subscribe(event => events.push(event));
  publisher.updateWait({ id: 'w1', sessionId: 's1', sessionLabel: '对话', kind: 'question', pending: true, ts: 10 });
  assert.equal(events.at(-1).type, 'wait');
  assert.equal(events.at(-1).payload.pending.id, 'w1');
  publisher.updateWait({ id: 'w1', sessionId: 's1', pending: false });
  assert.equal(events.at(-1).payload.pending, null);
});
