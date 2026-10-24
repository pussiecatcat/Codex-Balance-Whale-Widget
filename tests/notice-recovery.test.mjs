import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { UsageLedger } from '../runtime/ledger.mjs';
import { NoticePublisher } from '../runtime/notice-publisher.mjs';
import { TurnAccounting } from '../runtime/turn-accounting.mjs';

function fixture(t) {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'whale-notice-recovery-'));
  let accountId = 'a'.repeat(24), now = Date.now(), failWrite = false;
  const config = { dataDir, resolve: () => ({ accountId, model: 'fixture', setting: { currency: 'USD', models: {} } }) };
  const ledger = new UsageLedger(dataDir), publishers = [], accounts = [];
  const balance = { scope: c => c.accountId + '-USD', getBalance: async () => ({ ok: false }) };
  const fileSystem = Object.create(fs);
  fileSystem.renameSync = (from, to) => {
    if (failWrite && path.basename(to) === 'last-turn.json') { const error = new Error('synthetic disk full'); error.code = 'ENOSPC'; throw error; }
    return fs.renameSync(from, to);
  };
  const publisher = () => { const p = new NoticePublisher({ config, ledger, balance, dataDir, clock: () => now, fs: fileSystem, retryMs: 10 }); publishers.push(p); return p; };
  const accounting = notice => { const a = new TurnAccounting({ config, ledger, balance, dataDir, notice }); accounts.push(a); return a; };
  t.after(async () => {
    for (const p of publishers) p.close();
    for (const a of accounts) await a.close();
    assert.ok(path.resolve(dataDir).startsWith(path.resolve(os.tmpdir()) + path.sep));
    fs.rmSync(dataDir, { recursive: true, force: true });
  });
  return { dataDir, ledger, publisher, accounting, scope: () => accountId + '-USD',
    fail: value => { failWrite = value; }, account: value => { accountId = value; }, advance: value => { now += value; },
    seed(p, id, extra = {}) { const event = p.prepareNotice({ id, ts: now, accountId, notify: true, completionKind: 'success', ...extra }); ledger.append(accountId + '-USD', event); return event; } };
}

test('real settlement persists notice intent before removing recovery journal and retries automatically', async t => {
  const f = fixture(t), p = f.publisher(), a = f.accounting(p);
  p.start(); f.fail(true);
  const meta = { id: 's:t', turnId: 't', sessionId: 's', ts: Date.now() };
  a.beginTurn(meta); await a.finishTurn({ ...meta, outcome: 'completed' });
  assert.equal(a.journal.list().length, 0);
  assert.equal(p.status().pendingNotices, 1);
  assert.equal(f.ledger.pendingNotices('a'.repeat(24)).length, 1);
  f.fail(false);
  for (let tries = 0; tries < 100 && !p.lastTurn().id; tries++) await new Promise(resolve => setTimeout(resolve, 10));
  assert.equal(p.lastTurn().id, meta.id);
  assert.equal(p.status().pendingNotices, 0);
  assert.equal(f.ledger.pendingNotices('a'.repeat(24)).length, 0);
});

test('new publisher discovers durable intent after process restart, including append-before-enqueue window', t => {
  const f = fixture(t), before = f.publisher();
  f.seed(before, 'pending'); before.close();
  const restarted = f.publisher(); restarted.start();
  assert.equal(restarted.lastTurn().id, 'pending');
  assert.equal(f.ledger.find(f.scope(), { id: 'pending' }).noticePublished, true);
});

test('failed acknowledgement, newer publication, restart and older retry never republish old status', t => {
  const f = fixture(t), p = f.publisher();
  const a = f.seed(p, 'A'); f.advance(1); const b = f.seed(p, 'B');
  const revise = f.ledger.revise.bind(f.ledger);
  f.ledger.revise = (scope, id, patch) => { if (id === 'A') throw new Error('synthetic ledger failure'); return revise(scope, id, patch); };
  assert.throws(() => p.publishNotice(f.scope(), a.id));
  p.publishNotice(f.scope(), b.id); const latest = p.lastTurn(); p.close();
  f.ledger.revise = revise;
  const restarted = f.publisher(); restarted.start();
  assert.deepEqual(restarted.lastTurn(), latest);
  assert.equal(f.ledger.find(f.scope(), { id: 'A' }).noticePublished, true);
});

test('startup does not replay historical rows, expired notices, or another account', t => {
  const f = fixture(t), p = f.publisher();
  f.ledger.append(f.scope(), { id: 'legacy', accountId: 'a'.repeat(24), notify: true, ts: Date.now() });
  f.seed(p, 'expired'); f.advance(300001); p.close();
  const next = f.publisher(); next.start();
  assert.equal(next.lastTurn().id, undefined);
  assert.equal(f.ledger.find(f.scope(), { id: 'expired' }).noticeDismissed, 'expired');
  const event = f.seed(next, 'account-A');
  f.account('b'.repeat(24)); next.queueNotice('a'.repeat(24) + '-USD', event);
  assert.equal(next.lastTurn().id, undefined);
});

test('a new session turn suppresses the pending high-demand notice', t => {
  const f = fixture(t), p = f.publisher(); p.start();
  const event = f.seed(p, 'A', { sessionId: 's', completionKind: 'failed', failureKind: 'high-demand' });
  p.queueNotice(f.scope(), event); p.started({ sessionId: 's', id: 'B' }); f.advance(2501); p.retryPending();
  assert.equal(p.lastTurn().id, undefined);
  assert.equal(f.ledger.find(f.scope(), { id: 'A' }).noticeDismissed, 'superseded');
});


test('journal cleanup failure after append does not strand the live notification', async t => {
  const f = fixture(t), p = f.publisher(), a = f.accounting(p);
  p.start();
  const remove = a.journal.remove.bind(a.journal);
  a.journal.remove = () => { throw new Error('synthetic journal lock'); };
  const meta = { id: 'locked:t', turnId: 't', sessionId: 'locked', ts: Date.now() };
  a.beginTurn(meta);
  await assert.rejects(a.finishTurn({ ...meta, outcome: 'completed' }));
  assert.equal(p.lastTurn().id, meta.id);
  assert.equal(f.ledger.find(f.scope(), { id: meta.id }).noticePublished, true);
  a.journal.remove = remove;
});

test('a failed acknowledgement does not block a newer queued notice', t => {
  const f = fixture(t), p = f.publisher(); p.start();
  const a = f.seed(p, 'A'); f.advance(1); const b = f.seed(p, 'B');
  const revise = f.ledger.revise.bind(f.ledger);
  f.ledger.revise = (scope, id, patch) => { if (id === 'A') throw new Error('locked A'); return revise(scope, id, patch); };
  p.queueNotice(f.scope(), a); p.queueNotice(f.scope(), b);
  assert.equal(p.lastTurn().id, 'B');
  assert.equal(p.status().pendingNotices, 1);
  f.ledger.revise = revise;
  p.retryPending();
  assert.equal(p.lastTurn().id, 'B');
  assert.equal(p.lastTurn().seq, 2);
  assert.equal(p.status().pendingNotices, 0);
});
