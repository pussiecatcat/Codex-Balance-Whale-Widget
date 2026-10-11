import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { SessionMonitor } from '../runtime/session-monitor.mjs';
import { WhaleService } from '../runtime/service.mjs';

test('monitor status is a detached public snapshot without journal or turn objects', () => {
  const runtime = { activeTurns: 1, recovery: { pending: 1, error: '' } };
  const service = {
    monitorStatus: () => ({ activeTurns: runtime.activeTurns, recovery: { ...runtime.recovery } }),
    get turns() { throw new Error('monitor must not read turn objects'); },
    get journal() { throw new Error('monitor must not read journal objects'); },
  };
  const monitor = new SessionMonitor(service);
  monitor.snapshot = { watching: 2, error: '', recoverySeen: ['session:turn'] };
  const status = monitor.status();
  assert.equal(status.activeTurns, 1);
  assert.equal(status.recovery.pending, 1);
  assert.equal(JSON.stringify(status).includes('private'), false);
  status.recoverySeen.push('modified');
  status.recovery.pending = 99;
  assert.deepEqual(monitor.snapshot.recoverySeen, ['session:turn']);
  assert.equal(runtime.recovery.pending, 1);
});

test('service accounting and monitor DTOs are detached from component state', async t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'whale-monitor-status-'));
  t.after(async () => {
    await service.close({ timeoutMs: 20 });
    fs.rmSync(root, { recursive: true, force: true });
  });
  const context = { accountId: 'a'.repeat(24), model: 'model', dashboardUrl: '',
    setting: { currency: 'USD', refreshSeconds: 60, monitorSessions: true, models: {} } };
  const config = { dataDir: root, codexHome: root, resolve: () => context };
  const service = new WhaleService({ config, provider: { async balance() {
    return { ok: true, accountId: context.accountId, currency: 'USD', totalUsed: 0, totalBalance: 10 };
  } } });
  service.turnAccounting.turns.set('root', { isSubagent: false, secret: 'private' });
  service.turnAccounting.turns.set('child', { isSubagent: true, secret: 'private' });
  service.turnAccounting.journal.entries.set('recover', { secret: 'private' });

  const accounting = service.accountingStatus(), monitor = service.monitorStatus();
  assert.equal(accounting.activeTurns, 1);
  assert.equal(accounting.allTurns, 2);
  assert.equal(monitor.activeTurns, 1);
  assert.equal(monitor.recovery.pending, 1);
  assert.equal(JSON.stringify({ accounting, monitor }).includes('private'), false);

  accounting.recovery.pending = 20;
  monitor.recovery.pending = 30;
  assert.equal(service.accountingStatus().recovery.pending, 1);
  assert.equal(service.monitorStatus().recovery.pending, 1);
  assert.equal('activeScope' in service.balanceQuery, false);
  assert.equal('cancelledOutcomes' in service.noticePublisher, false);
  assert.equal('lastFile' in service.noticePublisher, false);
});
