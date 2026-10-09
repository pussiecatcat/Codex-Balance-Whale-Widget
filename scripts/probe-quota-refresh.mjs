// Read-only live diagnostic: timing and availability only; never print account,
// credentials, quota percentages, session contents or the raw upstream response.
import { performance } from 'node:perf_hooks';
import { spawn } from 'node:child_process';
import { CODEX_HOME } from '../runtime/paths.mjs';
import { readCodexRateLimits, createCodexRateLimitsClient } from '../runtime/codex-rate-limits.mjs';
const failures = [];
function spawnDiagnostic(...args) {
  const child = spawn(...args); let buffer = '';
  child.stdout.on('data', bytes => {
    buffer += String(bytes); let end;
    while ((end = buffer.indexOf('\n')) >= 0) {
      const line = buffer.slice(0, end); buffer = buffer.slice(end + 1);
      try {
        const message = JSON.parse(line);
        if (message.error) {
          const text = String(message.error.message || '').toLowerCase();
          failures.push({ code: message.error.code, categories: ['chatgpt','api key','login','refresh','unauthorized','network','unsupported','http','timeout','auth','429','403','500','502','404','401','token','credential','not available','connection','send request'].filter(word => text.includes(word)) });
        }
      } catch {}
    }
  });
  return child;
}
const client = createCodexRateLimitsClient({ codexHome: CODEX_HOME, spawnImpl: spawnDiagnostic });
const samples = [];
async function sample(method, read) {
  const start = performance.now();
  try {
    const data = await read();
    samples.push({ method, ok: true, durationMs: Math.round(performance.now() - start), windows: data.windows.length });
  } catch { samples.push({ method, ok: false, durationMs: Math.round(performance.now() - start) }); }
}
try {
  for (let i = 0; i < 3; i++) await sample('one-shot', () => readCodexRateLimits({ codexHome: CODEX_HOME }));
  await sample('persistent-cold', () => client.read());
  for (let i = 0; i < 3; i++) await sample('persistent-warm', () => client.read());
} finally { client.close(); }
process.stdout.write(JSON.stringify({ samples, failures }, null, 2) + '\n');
