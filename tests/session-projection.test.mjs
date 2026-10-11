import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { InsightAccumulator, collectInsights } from '../runtime/insights-worker.mjs';
import { SessionParser } from '../runtime/session-parser.mjs';
import { HISTORY_EVENT_PATTERN, decodeSessionEvent } from '../runtime/session-events.mjs';

const now = Date.parse('2026-10-10T12:00:00+08:00');
const record = (type, payload, offset = 0) => ({
  type,
  timestamp: new Date(now + offset).toISOString(),
  payload,
});
const tokenRecord = (total, last, offset) => record('event_msg', {
  type: 'token_count',
  info: { total_token_usage: total, ...(last ? { last_token_usage: last } : {}) },
}, offset);

test('live and historical projections normalize the same session counters consistently', () => {
  const totalA = { input_tokens: 100, output_tokens: 10, cached_input_tokens: 20, reasoning_output_tokens: 3 };
  const totalB = { input_tokens: 135, output_tokens: 18, cached_input_tokens: 26, reasoning_output_tokens: 5 };
  const records = [
    record('session_meta', { id: 'shared-session', timestamp: new Date(now).toISOString() }),
    record('event_msg', { type: 'task_started', turn_id: 'shared-turn' }, 1),
    tokenRecord(totalA, totalA, 2),
    tokenRecord(totalB, null, 3),
    record('event_msg', { type: 'task_complete', turn_id: 'shared-turn' }, 4),
  ];
  const completed = [];
  const live = new SessionParser({ id: 'fixture', defaultModel: 'shared-model', onEnd: value => completed.push(value) });
  const historical = new InsightAccumulator(now + 1000);

  for (const value of records) {
    const line = JSON.stringify(value);
    live.accept(line);
    const decoded = decodeSessionEvent(line, HISTORY_EVENT_PATTERN);
    if (decoded) historical.accept(decoded);
  }

  assert.equal(completed.length, 1);
  const liveUsage = completed[0].byModel['shared-model'];
  const historyUsage = historical.events.reduce((sum, event) => ({
    input_tokens: sum.input_tokens + event.input_tokens,
    output_tokens: sum.output_tokens + event.output_tokens,
    cached_input_tokens: sum.cached_input_tokens + event.cached_input_tokens,
    reasoning_output_tokens: sum.reasoning_output_tokens + event.reasoning_output_tokens,
  }), { input_tokens: 0, output_tokens: 0, cached_input_tokens: 0, reasoning_output_tokens: 0 });
  assert.deepEqual(historyUsage, {
    input_tokens: liveUsage.input_tokens,
    output_tokens: liveUsage.output_tokens,
    cached_input_tokens: liveUsage.cached_input_tokens,
    reasoning_output_tokens: liveUsage.reasoning_output_tokens,
  });
  assert.equal(historical.partial, false);
});

test('historical collection includes archives and exposes file and byte budget truncation', t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'whale-session-projection-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const sessions = path.join(root, 'sessions');
  const archives = path.join(root, 'archived_sessions');
  fs.mkdirSync(sessions); fs.mkdirSync(archives);
  const write = (directory, id, input, offset) => {
    const lines = [
      record('session_meta', { id, timestamp: new Date(now + offset).toISOString() }, offset),
      tokenRecord({ input_tokens: input, output_tokens: 1 }, { input_tokens: input, output_tokens: 1 }, offset + 1),
    ];
    const file = path.join(directory, `rollout-${id}.jsonl`);
    fs.writeFileSync(file, lines.map(JSON.stringify).join('\n') + '\n');
    fs.utimesSync(file, new Date(now + offset), new Date(now + offset));
  };
  write(sessions, 'current', 10, 10);
  write(archives, 'archived', 20, 20);

  const complete = collectInsights({ codexHome: root, now: now + 1000 });
  assert.equal(complete.tokens.complete, true);
  assert.equal(complete.tokens.scannedFiles, 2);
  assert.equal(complete.tokens.input, 30);
  assert.equal(collectInsights({ codexHome: root, now: now + 1000, maxFiles: 1 }).tokens.complete, false);
  assert.equal(collectInsights({ codexHome: root, now: now + 1000, maxBytes: 32 }).tokens.complete, false);
});
