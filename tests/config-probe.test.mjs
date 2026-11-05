import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { ConfigStore } from '../runtime/config.mjs';
import { WhaleService } from '../runtime/service.mjs';
import { createDispatcher } from '../runtime/dispatcher.mjs';

function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'whale-probe-'));
  const dataDir = path.join(root, 'data'), codexHome = path.join(root, 'codex');
  fs.mkdirSync(codexHome);
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const config = new ConfigStore({ dataDir, codexHome, env: { DRAFT_KEY: 'draft-secret' } });
  config.save({ baseUrl: 'https://a.example/v1', keyEnv: 'DRAFT_KEY' });
  const calls = [];
  const provider = { balance: async context => { calls.push(context); return { ok: true, totalBalance: 12.5, currency: 'USD', balanceLabel: 'API 账户余额' }; } };
  const service = new WhaleService({ config, provider });
  const server = createDispatcher({ dataDir, service, monitor: false, autoRefresh: false });
  t.after(() => server.close().catch(() => {}));
  const request = async body => {
    const response = await server.dispatch('/api/config/probe', { method: 'POST', body: Buffer.from(JSON.stringify(body)) });
    return { status: response.status, payload: JSON.parse(response.body.toString()) };
  };
  return { config, calls, dataDir, request };
}

test('the probe resolves the draft without writing it or touching the ledger', async t => {
  const { config, calls, dataDir, request } = fixture(t);
  const { status, payload } = await request({ baseUrl: 'https://b.example/v1' });
  assert.equal(status, 200);
  assert.equal(payload.totalBalance, 12.5);
  assert.equal(calls[0].baseUrl, 'https://b.example/v1', 'the draft endpoint is used for the request');
  assert.equal(config.load().baseUrl, 'https://a.example/v1', 'the saved configuration is unchanged');
  assert.equal(fs.existsSync(path.join(dataDir, 'ledgers')), false, 'probing must not create a ledger');
});

test('the probe enforces the same credential-origin rule as a save', async t => {
  const { config, request } = fixture(t);
  const { status, payload } = await request({ baseUrl: 'https://b.example/v1', keyEnv: '' });
  assert.equal(status, 400);
  assert.match(payload.error, /密钥环境变量/);
  assert.equal(config.load().keyEnv, 'DRAFT_KEY');
  assert.equal(config.load().baseUrl, 'https://a.example/v1');
});
