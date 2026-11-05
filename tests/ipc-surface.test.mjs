import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ALLOWED } from '../runtime/bridge.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

test('SECURITY.md mirrors the complete IPC allow-list', () => {
  const text = fs.readFileSync(path.join(root, 'SECURITY.md'), 'utf8');
  const start = text.indexOf('**第一层 · 本地 IPC 白名单。**');
  const end = text.indexOf('**第二层');
  assert.ok(start >= 0 && end > start, 'IPC section is missing from SECURITY.md');
  const section = text.slice(start, end);
  const documented = new Set(section.split('\n')
    .filter(line => /^\|\s*`\//.test(line))
    .map(line => line.match(/`([^`]+)`/)[1]));
  assert.deepEqual([...documented].sort(), [...ALLOWED.keys()].sort());
  assert.match(section, /`\/internal\/host`[^\n]*退出/);
});
