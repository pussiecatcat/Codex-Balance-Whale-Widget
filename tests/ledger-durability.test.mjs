import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { readJson, writeJson } from '../runtime/paths.mjs';
import { UsageLedger } from '../runtime/ledger.mjs';

function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'whale-durable-'));
  t.after(() => {
    const resolved = path.resolve(root);
    assert.ok(resolved.startsWith(path.resolve(os.tmpdir()) + path.sep) && path.basename(resolved).startsWith('whale-durable-'));
    fs.rmSync(resolved, { recursive: true, force: true });
  });
  return root;
}

test('writeJson flush reaches the staged file and backup keeps the previous revision', t => {
  const root = fixture(t), file = path.join(root, 'state.json');
  writeJson(file, { revision: 1 });
  const io = Object.create(fs); let staged;
  io.writeFileSync = (target, data, options) => { staged = options; return fs.writeFileSync(target, data, options); };
  writeJson(file, { revision: 2 }, { fs: io, flush: true, backup: true });
  assert.equal(staged.flush, true);
  assert.deepEqual(JSON.parse(fs.readFileSync(file, 'utf8')), { revision: 2 });
  assert.deepEqual(JSON.parse(fs.readFileSync(file + '.bak', 'utf8')), { revision: 1 });
});

test('readJson falls back to the backup and reports the recovery', t => {
  const root = fixture(t), file = path.join(root, 'state.json'), seen = [];
  writeJson(file, { version: 1 }, { backup: true });
  writeJson(file, { version: 2 }, { backup: true });
  fs.writeFileSync(file, '{broken');
  assert.deepEqual(readJson(file, {}, { backup: true, onRecover: () => seen.push('recovered') }), { version: 1 });
  assert.deepEqual(seen, ['recovered']);
  assert.throws(() => readJson(file, {}), /损坏/);
});

test('a corrupt ledger restores the backup, rewrites the live file and carries a warning', t => {
  const root = fixture(t), scope = 'a'.repeat(24) + '-USD', ledger = new UsageLedger(root);
  const first = ledger.load(scope); first.observed = 1; ledger.save(scope, first);
  const second = ledger.load(scope); second.observed = 2; ledger.save(scope, second);
  assert.equal(JSON.parse(fs.readFileSync(ledger.file(scope) + '.bak', 'utf8')).observed, 1);

  fs.writeFileSync(ledger.file(scope), '{broken');
  const recovered = ledger.load(scope);
  assert.equal(recovered.observed, 1);
  assert.equal(JSON.parse(fs.readFileSync(ledger.file(scope), 'utf8')).observed, 1);
  assert.match(ledger.records(scope).warning, /备份恢复/);
});

test('a corrupt ledger without a backup still fails loudly', t => {
  const root = fixture(t), scope = 'a'.repeat(24) + '-USD', ledger = new UsageLedger(root);
  ledger.save(scope, ledger.load(scope));
  fs.writeFileSync(ledger.file(scope), '{broken');
  fs.rmSync(ledger.file(scope) + '.bak', { force: true });
  assert.throws(() => ledger.load(scope), /损坏/);
});

test('a transient read lock reports a retry instead of restoring the backup', t => {
  const root = fixture(t), file = path.join(root, 'state.json');
  writeJson(file, { version: 1 }, { backup: true });
  writeJson(file, { version: 2 }, { backup: true });
  const original = fs.readFileSync;
  fs.readFileSync = (target, ...args) => {
    if (String(target) === file) { const error = new Error('locked'); error.code = 'EBUSY'; throw error; }
    return original(target, ...args);
  };
  try {
    assert.throws(() => readJson(file, {}, { backup: true }), /暂时无法读取/);
  } finally { fs.readFileSync = original; }
  assert.equal(JSON.parse(original(file, 'utf8')).version, 2, 'the live file must not be replaced by an older snapshot');
  assert.equal(JSON.parse(original(file + '.bak', 'utf8')).version, 1);
});

test('the recovery notice survives a restart until it is acknowledged', t => {
  const root = fixture(t), scope = 'b'.repeat(24) + '-CNY', ledger = new UsageLedger(root);
  const first = ledger.load(scope); first.observed = 3; ledger.save(scope, first);
  const second = ledger.load(scope); second.observed = 4; ledger.save(scope, second);
  fs.writeFileSync(ledger.file(scope), '{broken');
  ledger.load(scope);

  const restarted = new UsageLedger(root);
  assert.match(restarted.records(scope).warning, /备份恢复/);
  restarted.acknowledgeWarning(scope);
  assert.equal(new UsageLedger(root).records(scope).warning, '');
});
