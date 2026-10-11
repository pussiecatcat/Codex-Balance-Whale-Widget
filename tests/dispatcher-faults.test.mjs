import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createDispatcher } from '../runtime/dispatcher.mjs';
import { ConfigStore } from '../runtime/config.mjs';
import { WhaleService } from '../runtime/service.mjs';

// The dispatcher used to answer every uncaught exception with 400 and
// "操作失败，请检查设置或导入文件". That told the user to go and fix a setting that
// was not wrong, and it kept the defect out of sight of whoever could fix it.
// These pin the two halves of the replacement: a caller-facing rejection still
// arrives with its own message, and a defect arrives as a 500 with a reference
// that /api/status can resolve.

function setup(t, { onService = () => {} } = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'whale-faults-'));
  t.after(() => fs.rmSync(path.resolve(root), { recursive: true, force: true }));
  const codex = path.join(root, 'codex'); fs.mkdirSync(codex);
  fs.writeFileSync(path.join(codex, 'config.toml'),
    'model_provider="test"\n[model_providers.test]\nbase_url="https://example.test/v1"\nexperimental_bearer_token="TEST-ONLY-NOT-A-KEY"\n');
  const dataDir = path.join(root, 'data');
  const config = new ConfigStore({ dataDir, codexHome: codex, env: {} });
  const service = new WhaleService({ config, provider: { async balance() { return { ok: true }; } } });
  onService(service);
  const server = createDispatcher({ dataDir, service, monitor: false, autoRefresh: false });
  t.after(() => server.close().catch(() => {}));
  async function request(route, method = 'GET', body = null) {
    const response = await server.dispatch(route, { method, body });
    return { status: response.status, payload: JSON.parse(response.body.toString('utf8')) };
  }
  return { request, server, root };
}

// The defect detail belongs on stderr for a developer, not in the test runner's
// output. Capture it so the assertions can also check it was emitted.
function captureStderr(t) {
  const written = [];
  const original = process.stderr.write;
  process.stderr.write = chunk => { written.push(String(chunk)); return true; };
  t.after(() => { process.stderr.write = original; });
  return written;
}

test('an unexpected exception answers 500 with a reference instead of blaming the settings', async t => {
  const stderr = captureStderr(t);
  const { request } = setup(t, { onService: service => { service.usageRecords = () => { throw new Error('synthetic defect'); }; } });

  const failed = await request('/api/reconcile');
  assert.equal(failed.status, 500);
  assert.equal(failed.payload.ok, false);
  assert.equal(failed.payload.code, 'INTERNAL');
  assert.match(failed.payload.ref, /^f[0-9a-z]+$/, 'a defect must carry a quotable reference');
  assert.doesNotMatch(String(failed.payload.error), /检查设置/, 'the user must not be sent to fix a setting that is fine');
  assert.ok(stderr.some(line => line.includes('synthetic defect')), 'the detail must reach stderr');

  const status = await request('/api/status');
  const faults = status.payload.faults;
  assert.equal(faults.at(-1).ref, failed.payload.ref, '/api/status must resolve the reference the caller saw');
  assert.equal(faults.at(-1).context, '/api/reconcile');
  assert.match(faults.at(-1).message, /synthetic defect/);
  // Diagnostic entries are for quoting, not for dumping internals: no stack and
  // no absolute paths beyond the route.
  assert.deepEqual(Object.keys(faults.at(-1)).sort(), ['at', 'context', 'message', 'ref']);
  assert.doesNotMatch(JSON.stringify(faults), /[A-Za-z]:[\\/]/, 'no host paths in the fault log');
});

test('a caller-facing rejection keeps its own status and message', async t => {
  const { request } = setup(t);

  const badUrl = await request('/api/config', 'PUT', { baseUrl: 'not-a-url' });
  assert.equal(badUrl.status, 400);
  assert.equal(badUrl.payload.ok, false);
  assert.match(badUrl.payload.error, /API 地址无效/);

  const badSecret = await request('/api/config', 'PUT', { apiKey: 'sk-should-not-be-stored' });
  assert.equal(badSecret.status, 400);
  assert.match(badSecret.payload.error, /不保存密钥/);

  const status = await request('/api/status');
  assert.deepEqual(status.payload.faults, [], 'a rejection the caller can fix must not be logged as a defect');
});

test('an unusable provider answer stays caller-facing rather than becoming a defect', async t => {
  const { request } = setup(t, { onService: service => {
    service.apiModelUsage = () => ({ todayTokens: 0, byModel: {} });
  } });

  // No model id resolves, so the registry rejects the request itself.
  const missing = await request('/api/models/probe', 'POST', { id: '' });
  assert.equal(missing.status, 400);
  assert.equal(missing.payload.ok, false);
  assert.match(missing.payload.error, /API 模型/);

  const status = await request('/api/status');
  assert.deepEqual(status.payload.faults, []);
});


test('malformed JSON is rejected as input without adding a process fault', async t => {
  const { request } = setup(t);
  for (const [route, method] of [['/api/config', 'PUT'], ['/api/models', 'POST'], ['/api/sound-settings', 'PUT'], ['/dsh-whale/bubble.json', 'POST']]) {
    const result = await request(route, method, '{invalid-json');
    assert.equal(result.status, 400, route);
    assert.equal(result.payload.code, 'INVALID_JSON', route);
  }
  assert.deepEqual((await request('/api/status')).payload.faults, []);
});
