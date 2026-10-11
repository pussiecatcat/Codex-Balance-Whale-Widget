import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { writeJson } from '../runtime/paths.mjs';

function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'whale-atomic-'));
  t.after(() => {
    const resolved = path.resolve(root);
    assert.ok(resolved.startsWith(path.resolve(os.tmpdir()) + path.sep) && path.basename(resolved).startsWith('whale-atomic-'));
    fs.rmSync(resolved, { recursive: true, force: true });
  });
  const file = path.join(root, 'state.json'); fs.writeFileSync(file, '{"old":true}'); return { root, file };
}
const fault = code => Object.assign(new Error('simulated ' + code), { code });

test('atomic JSON replacement retries short Windows sharing failures without deleting the target', t => {
  for (const code of ['EPERM', 'EACCES', 'EBUSY']) {
    const { file, root } = fixture(t), io = Object.create(fs); let attempts = 0;
    io.renameSync = (from, to) => {
      assert.equal(to, file); assert.equal(fs.readFileSync(file, 'utf8'), '{"old":true}');
      if (++attempts < 3) throw fault(code);
      return fs.renameSync(from, to);
    };
    io.unlinkSync = target => { assert.notEqual(target, file); return fs.unlinkSync(target); };
    writeJson(file, { new: true }, { fs: io });
    assert.equal(attempts, 3); assert.deepEqual(JSON.parse(fs.readFileSync(file, 'utf8')), { new: true });
    assert.deepEqual(fs.readdirSync(root), ['state.json']);
  }
});

test('persistent access failures stop after three immediate tries and preserve old JSON', t => {
  const { root, file } = fixture(t), io = Object.create(fs); let attempts = 0;
  io.renameSync = () => { attempts++; throw fault('EPERM'); };
  io.unlinkSync = target => { assert.notEqual(target, file); return fs.unlinkSync(target); };
  assert.throws(() => writeJson(file, { new: true }, { fs: io }), error => error.code === 'EPERM');
  assert.equal(attempts, 3); assert.equal(fs.readFileSync(file, 'utf8'), '{"old":true}');
  assert.deepEqual(fs.readdirSync(root), ['state.json']);
});

test('non-sharing rename errors fail immediately without truncation or temporary leftovers', t => {
  const { root, file } = fixture(t), io = Object.create(fs); let attempts = 0;
  io.renameSync = () => { attempts++; throw fault('ENOSPC'); };
  assert.throws(() => writeJson(file, { new: true }, { fs: io }), error => error.code === 'ENOSPC');
  assert.equal(attempts, 1); assert.equal(fs.readFileSync(file, 'utf8'), '{"old":true}');
  assert.deepEqual(fs.readdirSync(root), ['state.json']);
});

// The staged file is written with fs.writeFileSync, so Node owns the descriptor
// and there is none of ours to leak. What the caller still relies on is that a
// partial staged write never reaches the target and leaves nothing behind.
test('partial temporary writes leave the previous target intact and no debris', t => {
  const { root, file } = fixture(t), io = Object.create(fs);
  io.writeFileSync = target => { fs.writeFileSync(target, 'partial'); throw fault('ENOSPC'); };
  io.unlinkSync = target => { assert.notEqual(target, file); return fs.unlinkSync(target); };
  assert.throws(() => writeJson(file, { new: true }, { fs: io }), error => error.code === 'ENOSPC');
  assert.equal(fs.readFileSync(file, 'utf8'), '{"old":true}');
  assert.deepEqual(fs.readdirSync(root), ['state.json']);
});
