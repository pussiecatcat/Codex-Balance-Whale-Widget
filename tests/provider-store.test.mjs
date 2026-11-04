import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { ConfigStore } from '../runtime/config.mjs';
import { ApiModelRegistry } from '../runtime/api-models.mjs';
import { ProviderStore } from '../runtime/provider-store.mjs';

const fixture = t => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'whale-provider-store-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  return dir;
};

test('legacy settings and models merge into one file without losing either side', t => {
  const dir = fixture(t);
  fs.writeFileSync(path.join(dir, 'api-settings.json'), JSON.stringify({ provider: 'deepseek', currency: 'CNY', keyEnv: 'DEEPSEEK_API_KEY' }));
  fs.writeFileSync(path.join(dir, 'api-models.json'), JSON.stringify({ version: 1, models: [
    { id: 'deep', template: 'deepseek', name: 'DeepSeek', currency: 'CNY', keyEnv: 'DEEPSEEK_API_KEY' },
  ] }));
  const store = new ProviderStore({ dataDir: dir });
  const config = new ConfigStore({ dataDir: dir, store, codexHome: dir, env: {} });
  const models = new ApiModelRegistry({ dataDir: dir, store, env: {} });
  assert.equal(config.load().provider, 'deepseek');
  assert.equal(models.list().models.length, 1);

  config.save({ refreshSeconds: 90 });
  const saved = JSON.parse(fs.readFileSync(path.join(dir, 'providers.json'), 'utf8'));
  assert.equal(saved.codexApi.provider, 'deepseek');
  assert.equal(saved.diyModels.length, 1);
  assert.equal(saved.codexApi.refreshSeconds, 90);

  models.save({ id: 'second', template: 'openrouter' });
  const afterModel = JSON.parse(fs.readFileSync(path.join(dir, 'providers.json'), 'utf8'));
  assert.equal(afterModel.codexApi.provider, 'deepseek');
  assert.equal(afterModel.diyModels.length, 2);

  assert.equal(fs.existsSync(path.join(dir, 'api-settings.json')), true, 'legacy files stay readable');
  const backup = JSON.parse(fs.readFileSync(path.join(dir, 'providers.legacy-backup.json'), 'utf8'));
  assert.equal(backup.codexApi.provider, 'deepseek');
  assert.equal(backup.diyModels.length, 1);
});

test('a saved config and a saved model cannot overwrite each other', t => {
  const dir = fixture(t), store = new ProviderStore({ dataDir: dir });
  const config = new ConfigStore({ dataDir: dir, store, codexHome: dir, env: {} });
  const models = new ApiModelRegistry({ dataDir: dir, store, env: {} });
  models.save({ id: 'one', template: 'deepseek' });
  config.save({ currency: 'CNY' });
  models.save({ id: 'two', template: 'openrouter' });
  config.save({ refreshSeconds: 120 });
  const saved = JSON.parse(fs.readFileSync(path.join(dir, 'providers.json'), 'utf8'));
  assert.deepEqual(saved.diyModels.map(item => item.id), ['one', 'two']);
  assert.equal(saved.codexApi.currency, 'CNY');
  assert.equal(saved.codexApi.refreshSeconds, 120);
});

test('a corrupt merged file fails closed instead of silently starting empty', t => {
  const dir = fixture(t);
  fs.writeFileSync(path.join(dir, 'providers.json'), '{not json');
  const store = new ProviderStore({ dataDir: dir });
  const config = new ConfigStore({ dataDir: dir, store, codexHome: dir, env: {} });
  assert.throws(() => config.load(), /损坏|不可读/);
  assert.throws(() => new ApiModelRegistry({ dataDir: dir, store, env: {} }).list(), /损坏|不可读/);
});
