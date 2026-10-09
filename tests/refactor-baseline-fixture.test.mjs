import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { SessionParser } from '../runtime/session-monitor.mjs';

const fixtureUrl = new URL('./fixtures/refactor-baseline-history.json', import.meta.url);

test('the refactor baseline history is synthetic and exercises main and child projections', () => {
  const source = fs.readFileSync(fixtureUrl, 'utf8');
  assert.doesNotMatch(source, /(?:sk-|gh[pousr]_)[A-Za-z0-9_-]{20,}/);
  assert.doesNotMatch(source, /[A-Z]:[\\/](?:Users|Documents)[\\/]/i);

  const fixture = JSON.parse(source);
  assert.equal(fixture.schemaVersion, 1);
  assert.equal(fixture.sessions.length, 2);

  const completed = [];
  for (const session of fixture.sessions) {
    const parser = new SessionParser({ id: session.id, onEnd: event => completed.push(event) });
    for (const event of session.events) parser.accept(event);
  }

  assert.deepEqual(completed.map(event => ({
    sessionId: event.sessionId,
    turnId: event.turnId,
    rootTurnId: event.rootTurnId,
    isSubagent: Boolean(event.isSubagent),
    input: event.byModel['fixture-model'].input_tokens,
    output: event.byModel['fixture-model'].output_tokens,
  })), [
    { sessionId: 'fixture-main', turnId: 'fixture-turn', rootTurnId: 'fixture-turn', isSubagent: false, input: 120, output: 30 },
    { sessionId: 'fixture-child', turnId: 'fixture-child-turn', rootTurnId: 'fixture-turn', isSubagent: true, input: 25, output: 5 },
  ]);
});
