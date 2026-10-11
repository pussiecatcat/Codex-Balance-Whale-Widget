import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { atomicTempPath, writeFileAtomic, writeFileAtomicSync } from '../lib/atomic-write.mjs';

function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'whale-atomic-write-'));
  t.after(() => {
    const resolved = path.resolve(root);
    assert.ok(resolved.startsWith(path.resolve(os.tmpdir()) + path.sep) && path.basename(resolved).startsWith('whale-atomic-write-'));
    fs.rmSync(resolved, { recursive: true, force: true });
  });
  const file = path.join(root, 'state.json'); fs.writeFileSync(file, '{"old":true}');
  return { root, file };
}

const fault = code => Object.assign(new Error('simulated ' + code), { code, attempts: 0 });

// Two writers of the same target inside one process must not share a staged
// file. The pid alone was not enough, which is what this pins.
test('the staged path is unique per call and sits beside the target', () => {
  const file = path.join('data', 'state.json');
  const first = atomicTempPath(file), second = atomicTempPath(file);
  assert.notEqual(first, second);
  for (const name of [first, second]) {
    assert.ok(name.startsWith(file + '.'));
    assert.ok(name.endsWith('.tmp'));
    assert.equal(path.dirname(name), path.dirname(file));
  }
});

test('a sync write replaces the target and leaves nothing else in the directory', t => {
  const { root, file } = fixture(t);
  writeFileAtomicSync(file, '{"new":true}');
  assert.equal(fs.readFileSync(file, 'utf8'), '{"new":true}');
  assert.deepEqual(fs.readdirSync(root), ['state.json']);
  assert.deepEqual(fs.readdirSync(root).filter(name => name.endsWith('.tmp')), []);
});

test('the staged file is created exclusively, at the caller mode, and flushed only when asked', t => {
  const { file } = fixture(t);
  const seen = [];
  const io = Object.create(fs);
  io.writeFileSync = (target, data, options) => { seen.push({ target, options }); return fs.writeFileSync(target, data, options); };

  writeFileAtomicSync(file, '{}', { fs: io });
  assert.equal(seen.length, 1, 'the staged file is written once');
  assert.ok(seen[0].target.endsWith('.tmp'), 'and it is the staged file, not the target');
  assert.equal(seen[0].options.flag, 'wx', 'an existing staged file must never be reused');
  assert.equal(seen[0].options.mode, 0o600);
  assert.equal(seen[0].options.flush, false, 'a settings write does not need the staged bytes on disk first');

  writeFileAtomicSync(file, '{}', { fs: io, mode: 0o644, flush: true });
  assert.equal(seen[1].options.flush, true, 'a resource write does');
  assert.equal(seen[1].options.mode, 0o644);
});

test('sync retries only the Windows sharing codes, at the count it was given', t => {
  for (const code of ['EPERM', 'EACCES', 'EBUSY']) {
    const { root, file } = fixture(t), io = Object.create(fs);
    let attempts = 0;
    io.renameSync = (from, to) => {
      assert.equal(to, file);
      assert.equal(fs.readFileSync(file, 'utf8'), '{"old":true}', 'the target is never deleted to make room');
      if (++attempts < 3) throw fault(code);
      return fs.renameSync(from, to);
    };
    writeFileAtomicSync(file, '{"new":true}', { fs: io });
    assert.equal(attempts, 3, code + ' is retried');
    assert.equal(fs.readFileSync(file, 'utf8'), '{"new":true}');
    assert.deepEqual(fs.readdirSync(root), ['state.json']);
  }

  const { file } = fixture(t), io = Object.create(fs);
  let attempts = 0;
  io.renameSync = () => { attempts++; throw fault('ENOSPC'); };
  assert.throws(() => writeFileAtomicSync(file, '{"new":true}', { fs: io }), error => error.code === 'ENOSPC');
  assert.equal(attempts, 1, 'a full disk is not a sharing failure and must surface at once');
});

test('a sync write that cannot stage removes its temporary and keeps the old JSON', t => {
  const { root, file } = fixture(t), io = Object.create(fs);
  io.writeFileSync = target => { fs.writeFileSync(target, 'partial'); throw fault('ENOSPC'); };
  io.unlinkSync = target => { assert.notEqual(target, file); return fs.unlinkSync(target); };
  assert.throws(() => writeFileAtomicSync(file, '{"new":true}', { fs: io }), error => error.code === 'ENOSPC');
  assert.equal(fs.readFileSync(file, 'utf8'), '{"old":true}');
  assert.deepEqual(fs.readdirSync(root), ['state.json']);
});

test('the async write retries the same codes, waiting between tries, and cleans up either way', async t => {
  const { root, file } = fixture(t), io = Object.create(fs.promises);
  const waits = [];
  let attempts = 0;
  io.rename = async (from, to) => { if (++attempts < 3) throw fault('EPERM'); return fs.promises.rename(from, to); };
  await writeFileAtomic(file, '{"new":true}', { fs: io, retryDelay: attempt => { waits.push(attempt); return 1; } });
  assert.equal(attempts, 3);
  assert.deepEqual(waits, [0, 1], 'it waits between attempts, not before the first');
  assert.equal(fs.readFileSync(file, 'utf8'), '{"new":true}');
  assert.deepEqual(fs.readdirSync(root), ['state.json']);

  const failing = Object.create(fs.promises);
  failing.rename = async () => { throw fault('ENOSPC'); };
  await assert.rejects(writeFileAtomic(file, '{"new":true}', { fs: failing }), error => error.code === 'ENOSPC');
  assert.equal(fs.readFileSync(file, 'utf8'), '{"new":true}', 'the previous good file survives');
  assert.deepEqual(fs.readdirSync(root), ['state.json'], 'and no staged file is left behind');
});

// A caller on its way out abandons the write rather than publishing a value it
// no longer stands behind. The staged file is still removed.
test('an abandoning caller drops the write instead of renaming it over the target', async t => {
  const { root, file } = fixture(t);
  await writeFileAtomic(file, '{"new":true}', { abandon: () => true });
  assert.equal(fs.readFileSync(file, 'utf8'), '{"old":true}');
  assert.deepEqual(fs.readdirSync(root), ['state.json']);

  const io = Object.create(fs.promises);
  let closing = false, tries = 0;
  io.rename = async () => { tries++; closing = true; throw fault('EPERM'); };
  await writeFileAtomic(file, '{"new":true}', { fs: io, retryDelay: () => 1, abandon: () => closing });
  assert.equal(tries, 1, 'a shutdown part way through stops the retries');
  assert.equal(fs.readFileSync(file, 'utf8'), '{"old":true}');
  assert.deepEqual(fs.readdirSync(root), ['state.json']);
});

test('the parent directory is created for a target that does not exist yet', async t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'whale-atomic-write-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const nested = path.join(root, 'a', 'b', 'state.json');
  writeFileAtomicSync(nested, '{"sync":true}');
  assert.equal(fs.readFileSync(nested, 'utf8'), '{"sync":true}');
  await writeFileAtomic(path.join(root, 'a', 'c', 'other.json'), '{"async":true}');
  assert.equal(fs.readFileSync(path.join(root, 'a', 'c', 'other.json'), 'utf8'), '{"async":true}');
});
