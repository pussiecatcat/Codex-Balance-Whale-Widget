import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import { migrateData } from '../runtime/migration.mjs';

test('plugin MCP launches from a plugin-root-relative cwd', async () => {
  const config = JSON.parse(await fs.readFile(new URL('../.mcp.json', import.meta.url), 'utf8'));
  const whale = config.mcpServers.whale;
  assert.equal(whale.command, 'node');
  assert.deepEqual(whale.args, ['runtime/mcp.mjs']);
  assert.equal(whale.cwd, '.');
  assert.doesNotMatch(JSON.stringify(whale), /\$\{(?:CLAUDE_)?PLUGIN_ROOT\}/);
});

test('reduced-motion override follows every rainbow animation declaration', async () => {
  const css = await fs.readFile(new URL('../desktop/ui/whale-widget.css', import.meta.url), 'utf8');
  const override = css.indexOf('@media (prefers-reduced-motion:reduce)');
  assert.ok(override > css.lastIndexOf('animation:dshwvRainbow'), 'later animation declarations must not override reduced motion');
  for (const selector of ['.dshwv-qcolmenu .dshwv-rgbopt.optgrad', '.dshwv-trow.dshwv-rgb', '.dshwv-trow.dshwv-bgrgb', '.dshwv-trowtx.dshwv-rgb']) {
    assert.ok(css.slice(override).includes(selector));
  }
});

test('failed migration stays retryable and completes after the state file is repaired', async t => {
  const dataDir = await fs.mkdtemp(path.join(os.tmpdir(), 'whale-migration-'));
  t.after(() => fs.rm(dataDir, { recursive: true, force: true }));
  const stateFile = path.join(dataDir, 'api-settings.json');
  const markerFile = path.join(dataDir, 'migration-follow-v1.json');
  await fs.writeFile(stateFile, '{broken');
  migrateData(dataDir);
  const failed = JSON.parse(await fs.readFile(markerFile, 'utf8'));
  assert.equal(failed.complete, false);
  assert.deepEqual(failed.failed.map(item => item.name), ['api-settings.json']);

  await fs.writeFile(stateFile, '\uFEFF' + JSON.stringify({ pricingSchedule: { stale: true }, keep: 1 }));
  migrateData(dataDir);
  assert.deepEqual(JSON.parse(await fs.readFile(stateFile, 'utf8')), { keep: 1 });
  assert.equal(JSON.parse(await fs.readFile(markerFile, 'utf8')).complete, true);
});

test('legacy daily alert keys are compacted without repeating today alerts', async () => {
  const day = new Date(Date.now() + 8 * 3600000).toISOString().slice(0, 10);
  const storage = {
    [`dshw-api-alert:${day}:model-a:balance`]: '1',
    'dshw-api-alert:2020-01-01:model-a:budget': '1',
    'dshw-unrelated': 'keep',
    getItem(key) { return Object.hasOwn(this, key) && typeof this[key] === 'string' ? this[key] : null; },
    setItem(key, value) { this[key] = String(value); },
    removeItem(key) { delete this[key]; },
  };
  const document = { readyState: 'loading', addEventListener() {}, getElementById() { return null; } };
  const window = {};
  const source = await fs.readFile(new URL('../desktop/ui/api-models.js', import.meta.url), 'utf8');
  vm.runInNewContext(source, { window, document, localStorage: storage, fetch() {}, setInterval() {}, CustomEvent: class {} });
  assert.equal(storage['dshw-api-alert:model-a:balance'], day);
  assert.equal(storage[`dshw-api-alert:${day}:model-a:balance`], undefined);
  assert.equal(storage['dshw-api-alert:2020-01-01:model-a:budget'], undefined);
  assert.equal(storage['dshw-unrelated'], 'keep');
});
