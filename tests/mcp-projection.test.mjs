import test from 'node:test';
import assert from 'node:assert/strict';
import { projectToolOutput } from '../runtime/mcp-projection.mjs';

const forbidden = json => {
  assert.equal(json.includes('C:\\'), false, 'local Windows path leaked: ' + json);
  assert.equal(/[A-Za-z]:\\\\/.test(json), false, 'local Windows path leaked: ' + json);
  assert.equal(json.includes('http://'), false, 'provider URL leaked: ' + json);
  assert.equal(json.includes('https://'), false, 'provider URL leaked: ' + json);
  assert.equal(json.includes('sessionLabel'), false, 'session label leaked: ' + json);
};

test('MCP status projection drops paths, faults and diagnostics', () => {
  const projected = projectToolOutput('whale_status', {
    ok: true, version: '0.3.0', buildVersion: '0.3.0+test', transport: 'local-ipc', webpage: false,
    provider: {
      providerName: '当前 API', hasKey: true,
      settings: { provider: 'auto', currency: 'USD', monitorSessions: true, refreshSeconds: 60, models: {}, baseUrl: 'https://api.example.test' },
      configured: { baseUrl: true, keyEnv: false, profile: true, projectDir: true, dashboardUrl: false, balancePath: true },
    },
    monitor: { watching: 2, activeTurns: 1, initializing: false, catchingUp: false, error: 'C:\\secret\\bad.jsonl', recoverySeen: ['C:\\secret'] },
    dataDir: 'C:\\Users\\me\\.codex\\whale-widget',
    faults: [{ message: 'C:\\secret' }],
    hostPid: 4242,
    windowBounds: { x: 1, y: 2 },
    diagnostics: { native: { report: 'C:\\secret' } },
    followCodex: true, desktopMode: 'follow-codex', rendererReady: true, platform: 'win32',
  });
  assert.deepEqual(projected.provider.configured, { baseUrl: true, keyEnv: false });
  assert.deepEqual(projected.monitor, { watching: 2, activeTurns: 1, initializing: false, catchingUp: false });
  assert.equal('dataDir' in projected, false);
  assert.equal('faults' in projected, false);
  assert.equal('hostPid' in projected, false);
  assert.equal('diagnostics' in projected, false);
  forbidden(JSON.stringify(projected));
});

test('MCP usage projection keeps summaries and drops event rows and labels', () => {
  const projected = projectToolOutput('whale_usage', {
    ok: true, currency: 'USD', total7: 3, total7Complete: true,
    today: { total: 1, since: '2026-11-04T00:00:00.000Z', source: 'balance-observed', models: [{ model: 'gpt', cost: 1 }], extra: 'C:\\secret' },
    days7: [{ date: '2026-11-04', total: 1, totalState: 'observed', models: [{ model: 'gpt', cost: 1 }] }],
    all: {
      days: [{ date: '2026-11-04', total: 1, totalState: 'observed', models: [] }],
      total: 1, totalComplete: true, missingSummaryDays: [],
      events: [{ sessionLabel: 'C:\\secret\\session.jsonl', cost: 1 }],
      correctionLog: [{ note: 'C:\\secret' }], storedEventCount: 1,
    },
    settings: { alert: {} }, note: 'C:\\secret', usageSource: 'x',
  });
  assert.deepEqual(projected.today, { total: 1, since: '2026-11-04T00:00:00.000Z', source: 'balance-observed', models: [{ model: 'gpt', cost: 1 }] });
  assert.deepEqual(projected.all, {
    total: 1, totalComplete: true, missingSummaryDays: [],
    days: [{ date: '2026-11-04', total: 1, totalState: 'observed', models: [] }],
  });
  assert.equal('events' in projected.all, false);
  forbidden(JSON.stringify(projected));
});

test('MCP balance projection drops the provider endpoint, account and dashboard', () => {
  const projected = projectToolOutput('whale_balance', {
    ok: true, totalBalance: 1, totalUsed: 2, totalGranted: 3, currency: 'USD', unlimited: false,
    adapter: 'billing', balanceScope: 'api-billing', balanceLabel: 'API 可用余额', unitNote: '按接口约定换算', updatedAt: '2026-11-04T00:00:00.000Z',
    accountId: 'a'.repeat(24), providerName: '切换后的服务商', baseUrl: 'https://api.example.test/v1', dashboardUrl: 'https://example.test/billing',
  });
  assert.equal(projected.totalBalance, 1);
  for (const key of ['accountId', 'providerName', 'baseUrl', 'dashboardUrl']) assert.equal(key in projected, false, key);
  forbidden(JSON.stringify(projected));
});

test('MCP projections keep error details and do not invent fields', () => {
  assert.deepEqual(projectToolOutput('whale_balance', { ok: false, code: 'CONFIG', error: '请先配置余额接口', baseUrl: 'https://x.test' }),
    { ok: false, code: 'CONFIG', error: '请先配置余额接口' });
  assert.deepEqual(projectToolOutput('whale_open', { ok: true, pid: 9, path: 'C:\\secret' }), { ok: true });
  assert.throws(() => projectToolOutput('unknown_tool', { ok: true }), /未知工具/);
});
