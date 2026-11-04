import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRuntimeLog, redact } from '../runtime/log.mjs';

test('runtime log redacts credentials, tokens and URLs before writing', () => {
  const text = redact([
    'Authorization: Bearer abcdef123456',
    'api_key=sk-secret12345678',
    'token: "ghp_1234567890"',
    'password = hunter2',
    'https://user:pass@example.test/v1',
    'sk-abcdefghijk',
    'https://generativelanguage.example/v1?key=QUERY_SECRET&x=1',
  ].join('\n'));
  for (const secret of ['abcdef123456', 'sk-secret12345678', 'ghp_1234567890', 'hunter2', 'user:pass', 'sk-abcdefghijk', 'QUERY_SECRET']) {
    assert.equal(text.includes(secret), false, secret);
  }
  assert.match(text, /\[REDACTED\]/);
});

test('runtime log rotates at the size cap and keeps the previous file', t => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'whale-log-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const log = createRuntimeLog({ dataDir: dir, maxBytes: 400 });
  for (let i = 0; i < 20; i++) log.info('line ' + i + ' ' + 'x'.repeat(40));
  assert.ok(fs.existsSync(log.file));
  assert.ok(fs.existsSync(log.file + '.1'));
  assert.ok(fs.statSync(log.file).size <= 400);
  assert.ok(fs.statSync(log.file + '.1').size <= 400);
  assert.match(fs.readFileSync(log.file + '.1', 'utf8'), /info line /);
});

test('runtime log carries the fault reference and stack without throwing on a bad directory', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'whale-log-'));
  try {
    const log = createRuntimeLog({ dataDir: dir });
    const error = new Error('boom'); error.stack = 'Error: boom\n    at handler';
    log.error('f1 /api/demo\n' + error.stack);
    const text = fs.readFileSync(log.file, 'utf8');
    assert.match(text, /f1 \/api\/demo/);
    assert.match(text, /handler/);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});
