import fs from 'node:fs';
import path from 'node:path';

// The one place runtime failures are written down. The data directory is
// already private to the current user; the log inherits that and is capped so a
// crash loop cannot fill the disk. Every line is redacted before it is written:
// stack traces and provider errors can quote headers and URLs.
export const LOG_MAX_BYTES = 2 * 1024 * 1024;
const MAX_LINE = 4000;

const RULES = [
  [/(authorization\s*[:=]\s*(?:bearer\s+)?)[^\s,;"']+/gi, '$1[REDACTED]'],
  [/\b(Bearer\s+)[A-Za-z0-9._~+/=-]{8,}/g, '$1[REDACTED]'],
  [/\bsk-[A-Za-z0-9_-]{8,}\b/g, 'sk-[REDACTED]'],
  [/((?:api[_-]?key|access[_-]?token|refresh[_-]?token|token|secret|password|cookie)\s*[:=]\s*["']?)[^\s"'&,;}]+/gi, '$1[REDACTED]'],
  [/([?&](?:key|api_key|access_token)=)[^&\s#]+/gi, '$1[REDACTED]'],
  [/(https?:\/\/)[^/\s:@]+:[^/\s@]+@/gi, '$1[REDACTED]@'],
];

export function redact(text) {
  let value = String(text ?? '');
  for (const [pattern, replacement] of RULES) value = value.replace(pattern, replacement);
  return value;
}

export function createRuntimeLog({ dataDir, maxBytes = LOG_MAX_BYTES, clock = Date.now } = {}) {
  const dir = path.join(dataDir, 'logs');
  const file = path.join(dir, 'runtime.log');
  let size = -1;
  const measure = () => {
    if (size >= 0) return size;
    try { size = fs.statSync(file).size; } catch { size = 0; }
    return size;
  };
  const rotate = () => {
    try { fs.renameSync(file, file + '.1'); } catch (error) { if (error.code !== 'ENOENT') throw error; }
    size = 0;
  };
  const write = (level, message) => {
    try {
      const line = new Date(clock()).toISOString() + ' ' + level + ' ' + redact(message).slice(0, MAX_LINE) + '\n';
      const bytes = Buffer.byteLength(line);
      fs.mkdirSync(dir, { recursive: true });
      if (measure() + bytes > maxBytes) rotate();
      fs.appendFileSync(file, line, { mode: 0o600 });
      size = measure() + bytes;
    } catch {}
  };
  return {
    file,
    write,
    error: message => write('error', message),
    warn: message => write('warn', message),
    info: message => write('info', message),
  };
}
