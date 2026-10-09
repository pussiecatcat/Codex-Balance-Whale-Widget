import test from 'node:test';
import assert from 'node:assert/strict';
import { SessionMonitor } from '../runtime/session-monitor.mjs';

test('monitor status is a detached public snapshot without journal or turn objects', () => {
  const service = {
    turns: new Map([['root', { isSubagent: false, secret: 'private' }], ['child', { isSubagent: true }]]),
    journal: { entries: new Map([['recover', {}]]) }, recoveryError: '',
  };
  const monitor = new SessionMonitor(service);
  monitor.snapshot = { watching: 2, error: '', recoverySeen: ['session:turn'] };
  const status = monitor.status();
  assert.equal(status.activeTurns, 1);
  assert.equal(status.recovery.pending, 1);
  assert.equal(JSON.stringify(status).includes('private'), false);
  status.recoverySeen.push('modified');
  assert.deepEqual(monitor.snapshot.recoverySeen, ['session:turn']);
});
