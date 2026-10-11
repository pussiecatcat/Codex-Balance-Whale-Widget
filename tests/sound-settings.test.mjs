import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { WhaleService } from '../runtime/service.mjs';
import { SoundSettingsCrash, SoundSettingsService } from '../runtime/sound-settings.mjs';

const jsonFile = file => JSON.parse(fs.readFileSync(file, 'utf8'));

function fixture(t, { seeded = true } = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'whale-sound-settings-'));
  t.after(() => {
    assert.ok(path.resolve(root).startsWith(path.resolve(os.tmpdir()) + path.sep));
    fs.rmSync(root, { recursive: true, force: true });
  });
  const config = {
    dataDir: root,
    resolve: () => ({ dashboardUrl: 'https://example.invalid/billing', accountId: 'fixture', setting: {} }),
  };
  const whale = new WhaleService({ config, provider: {} });
  const sizeFile = path.join(root, '.dshw-size.json');
  const usageFile = path.join(root, 'usage-settings.json');
  if (seeded) {
    fs.writeFileSync(sizeFile, JSON.stringify({ scale: 1.25, sound: true, vol: .8, soundSet: 'duck', turnCostOn: true, turnCostCloseMs: 5000, futureSize: 'keep', document: { keep: 'nested' } }));
    fs.writeFileSync(usageFile, JSON.stringify({ taskEnd: { on: false, sel: 'preset:duck:press' }, futureUsage: { keep: true } }));
  }
  return { root, whale, sizeFile, usageFile };
}

function command(snapshot, overrides = {}) {
  return {
    schemaVersion: 1,
    revision: snapshot.revision,
    size: { ...snapshot.size, vol: .35, turnCostCloseMs: 12000, ...overrides.size },
    usage: {
      ...snapshot.usage,
      taskEnd: { ...snapshot.usage.taskEnd, on: true, sel: 'preset:fx1:press' },
      events: {
        ...snapshot.usage.events,
        question: { ...snapshot.usage.events.question, soundOn: true, sel: 'preset:duck:release', vol: .4 },
      },
      ...overrides.usage,
    },
  };
}

test('combined sound settings save is canonical, preserves unknown fields and rejects stale revisions', async t => {
  const { root, whale, sizeFile, usageFile } = fixture(t);
  const service = new SoundSettingsService({ dataDir: root, whale });
  const before = await service.load();
  const saved = await service.save(command(before));
  assert.equal(saved.schemaVersion, 1);
  assert.notEqual(saved.revision, before.revision);
  assert.equal(saved.size.vol, .35);
  assert.equal(saved.usage.events.question.vol, .4);
  assert.equal(JSON.parse(fs.readFileSync(sizeFile)).futureSize, 'keep');
  assert.deepEqual(JSON.parse(fs.readFileSync(sizeFile)).document, { keep: 'nested' });
  assert.deepEqual(JSON.parse(fs.readFileSync(usageFile)).futureUsage, { keep: true });
  await assert.rejects(service.save(command(before)), error => error.code === 'SETTINGS_CONFLICT' && error.status === 409);
});

test('combined sound settings validates references and serializes concurrent writers', async t => {
  const { root, whale } = fixture(t);
  const service = new SoundSettingsService({ dataDir: root, whale });
  const snapshot = await service.load();
  await assert.rejects(service.save(command(snapshot, { usage: { taskEnd: { ...snapshot.usage.taskEnd, sel: 'invalid' } } })), error => error.code === 'INVALID_SOUND_REFERENCE');
  const results = await Promise.allSettled([service.save(command(snapshot)), service.save(command(snapshot, { size: { vol: .7 } }))]);
  assert.equal(results.filter(result => result.status === 'fulfilled').length, 1);
  assert.equal(results.filter(result => result.status === 'rejected' && result.reason.code === 'SETTINGS_CONFLICT').length, 1);
});

test('a normal second-file failure rolls both files back and removes the journal', async t => {
  const { root, whale, sizeFile, usageFile } = fixture(t);
  const beforeSize = jsonFile(sizeFile), beforeUsage = jsonFile(usageFile);
  const injected = Object.create(fs);
  let failed = false;
  injected.renameSync = (source, target) => {
    if (!failed && path.resolve(target) === path.resolve(usageFile)) {
      failed = true;
      const error = new Error('synthetic usage write failure'); error.code = 'ENOSPC'; throw error;
    }
    return fs.renameSync(source, target);
  };
  const service = new SoundSettingsService({ dataDir: root, whale, fs: injected });
  const snapshot = await service.load();
  await assert.rejects(service.save(command(snapshot)), error => error.code === 'SETTINGS_SAVE_FAILED');
  assert.deepEqual(jsonFile(sizeFile), beforeSize);
  assert.deepEqual(jsonFile(usageFile), beforeUsage);
  assert.equal(fs.existsSync(path.join(root, 'sound-settings-transaction.json')), false);
});

for (const stage of ['after-journal', 'after-size', 'after-usage', 'after-commit']) {
  test(`restart recovery resolves an abrupt ${stage} crash to one complete snapshot`, async t => {
    const { root, whale, sizeFile, usageFile } = fixture(t);
    const beforeSize = jsonFile(sizeFile), beforeUsage = jsonFile(usageFile);
    const crashing = new SoundSettingsService({
      dataDir: root,
      whale,
      failpoint: current => { if (current === stage) throw new SoundSettingsCrash(stage); },
    });
    const before = await crashing.load();
    await assert.rejects(crashing.save(command(before)), error => error.simulatedCrash === true);
    assert.equal(fs.existsSync(path.join(root, 'sound-settings-transaction.json')), true);
    const recovered = new SoundSettingsService({ dataDir: root, whale });
    const snapshot = await recovered.load();
    if (stage === 'after-commit') {
      assert.equal(snapshot.size.vol, .35);
      assert.equal(snapshot.usage.taskEnd.on, true);
    } else {
      assert.deepEqual(jsonFile(sizeFile), beforeSize);
      assert.deepEqual(jsonFile(usageFile), beforeUsage);
      assert.equal(snapshot.size.vol, .8);
      assert.equal(snapshot.usage.taskEnd.on, false);
    }
    assert.equal(fs.existsSync(path.join(root, 'sound-settings-transaction.json')), false);
  });
}

test('failed rollback retains the journal and a later startup completes recovery', async t => {
  const { root, whale, sizeFile, usageFile } = fixture(t);
  const beforeSize = jsonFile(sizeFile), beforeUsage = jsonFile(usageFile);
  const injected = Object.create(fs);
  let sizeWrites = 0;
  injected.renameSync = (source, target) => {
    if (path.resolve(target) === path.resolve(sizeFile) && ++sizeWrites === 2) {
      const error = new Error('synthetic rollback failure'); error.code = 'EACCES'; throw error;
    }
    return fs.renameSync(source, target);
  };
  const service = new SoundSettingsService({
    dataDir: root,
    whale,
    fs: injected,
    failpoint: stage => { if (stage === 'after-size') throw new Error('synthetic commit failure'); },
  });
  const snapshot = await service.load();
  await assert.rejects(service.save(command(snapshot)), error => error.code === 'RECOVERY_REQUIRED');
  assert.equal(fs.existsSync(path.join(root, 'sound-settings-transaction.json')), true);
  const recovered = new SoundSettingsService({ dataDir: root, whale });
  await recovered.load();
  assert.deepEqual(jsonFile(sizeFile), beforeSize);
  assert.deepEqual(jsonFile(usageFile), beforeUsage);
  assert.equal(fs.existsSync(path.join(root, 'sound-settings-transaction.json')), false);
});

test('recovery restores the absence of files that did not exist before the transaction', async t => {
  const { root, whale, sizeFile, usageFile } = fixture(t, { seeded: false });
  const service = new SoundSettingsService({
    dataDir: root,
    whale,
    failpoint: stage => { if (stage === 'after-size') throw new SoundSettingsCrash(stage); },
  });
  const snapshot = await service.load();
  await assert.rejects(service.save(command(snapshot)), error => error.simulatedCrash === true);
  new SoundSettingsService({ dataDir: root, whale });
  assert.equal(fs.existsSync(sizeFile), false);
  assert.equal(fs.existsSync(usageFile), false);
});

test('a damaged transaction journal blocks guessing at a recoverable state', async t => {
  const { root, whale } = fixture(t);
  fs.writeFileSync(path.join(root, 'sound-settings-transaction.json'), '{broken');
  const service = new SoundSettingsService({ dataDir: root, whale });
  await assert.rejects(service.load(), error => error.code === 'SETTINGS_JOURNAL_INVALID' && error.status === 503);
});
