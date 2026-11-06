import test from 'node:test';
import assert from 'node:assert/strict';
import { STATUS_TONES, statusForCode, statusForError, statusView } from '../desktop/ui/shared/status-tones.js';

test('every status carries a tone and a next action', () => {
  for (const [status, view] of Object.entries(STATUS_TONES)) {
    assert.equal(typeof view.label, 'string', status);
    assert.ok(view.label.length > 0, status);
    assert.equal(typeof view.tone, 'string', status);
    assert.equal(typeof view.action, 'string', status);
  }
  assert.equal(new Set(Object.values(STATUS_TONES).map(view => view.label)).size, Object.keys(STATUS_TONES).length);
});

test('quota states map to the same labels the panel already shows', () => {
  assert.equal(statusView('ready', { changed: true }).label, '额度已更新');
  assert.equal(statusView('ready').label, '已同步');
  assert.equal(statusView('unauthenticated').label, '请登录 Codex');
  assert.equal(statusView('unavailable', { reason: '暂无额度窗口' }).label, '暂无额度窗口');
  assert.equal(statusView('error').tone, 'critical');
  assert.equal(statusView('stale').tone, 'warn');
  assert.equal(statusView('unknown-state').tone, 'muted');
});

test('provider error codes map to the same status table', () => {
  assert.equal(statusForCode('AUTH'), 'auth-failed');
  assert.equal(statusForCode('HTTP_401'), 'auth-failed');
  assert.equal(statusForCode('TIMEOUT'), 'unreachable');
  assert.equal(statusForCode('NOT_JSON'), 'bad-response');
  assert.equal(statusForCode('NO_KEY'), 'key-missing');
  assert.equal(statusForCode('UNSUPPORTED'), 'no-balance-api');
  assert.equal(statusForCode('HTTP_500'), 'provider-error');
  assert.equal(statusForError({ payload: { code: 'AUTH' } }), 'auth-failed');
  assert.equal(statusForCode('NO_KEY'), 'key-missing');
  const view = statusView(statusForCode('NO_KEY'));
  assert.equal(view.label, '未检测到密钥');
  assert.match(view.action, /重新启动/);
  assert.ok(view.icon);
});

