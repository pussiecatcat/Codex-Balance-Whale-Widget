import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { SessionParser } from '../runtime/session-monitor.mjs';
import { quotaFromAppServer } from '../runtime/codex-rate-limits.mjs';

const fixture = name => fs.readFileSync(new URL('./fixtures/codex/0.166.0-alpha.6/' + name, import.meta.url), 'utf8');

test('a sanitized 0.166 rollout drives questions but never approval detection', () => {
  const waits = [];
  const parser = new SessionParser({ id: 'fixture-session', onWait: wait => waits.push(wait) });
  for (const line of fixture('session.txt').split('\n')) if (line.trim()) parser.accept(line);
  assert.deepEqual(waits.map(wait => [wait.kind, wait.pending]), [['question', true], ['question', false]]);
  assert.equal(waits.some(wait => wait.kind === 'approval'), false);
  assert.equal(waits[0].id, 'call-q');
});

test('the app-server fixture keeps known and unknown quota windows', () => {
  const response = JSON.parse(fixture('app-server-rate-limits.json'));
  assert.deepEqual(quotaFromAppServer(response, Date.now()).map(window => window.label), ['5 小时', '周']);
  const fallback = quotaFromAppServer({ rateLimits: response.rateLimits }, Date.now());
  assert.deepEqual(fallback.map(window => window.label), ['1 天']);
  assert.equal(fallback[0].usedPercent, 10);
});
