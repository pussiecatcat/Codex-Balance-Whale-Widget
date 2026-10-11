import test from 'node:test';
import assert from 'node:assert/strict';

import { readBoundedBodyText } from '../runtime/bounded-body.mjs';

const streamOf = (pieces, hooks = {}) => new ReadableStream({
  pull(controller) { pieces.length ? controller.enqueue(pieces.shift()) : controller.close(); },
  cancel() { hooks.cancelled = true; },
}, { highWaterMark: 0 });

const bytes = (count, filler = 0) => new Uint8Array(count).fill(filler);

test('a declared length past the ceiling is refused and the body is cancelled', async () => {
  let cancelled = false;
  const response = new Response(new ReadableStream({ cancel() { cancelled = true; } }), { headers: { 'content-length': '201' } });
  await assert.rejects(readBoundedBodyText(response, { maxBytes: 200 }), /响应过大/);
  assert.equal(cancelled, true);
});

test('a chunked body is counted as it arrives and cancelled once it passes the ceiling', async () => {
  let cancelled = false, pulls = 0;
  const pieces = [bytes(128, 97), bytes(128, 98), bytes(128, 99)];
  const stream = new ReadableStream({
    pull(controller) { pulls++; controller.enqueue(pieces.shift()); },
    cancel() { cancelled = true; },
  }, { highWaterMark: 0 });
  await assert.rejects(readBoundedBodyText(new Response(stream), { maxBytes: 200 }), /响应过大/);
  assert.equal(cancelled, true, 'the tail of an oversized body is never read');
  assert.equal(pulls, 2, 'only the chunks needed to prove it is too large were pulled');
});

test('a response with no byte stream is refused rather than buffered whole', async () => {
  await assert.rejects(readBoundedBodyText(new Response(null), { maxBytes: 1 }), /不支持的字节流|不是可读/);
  const buffered = { headers: { get: () => null }, text: async () => '{"huge":true}' };
  await assert.rejects(readBoundedBodyText(buffered, { maxBytes: 1 }), /不支持的字节流|不是可读/);
});

test('a caller that knows its responses arrive streamless reads them through its own path', async () => {
  const buffered = { headers: { get: () => null }, text: async () => '{"ok":true}' };
  const text = await readBoundedBodyText(buffered, { maxBytes: 1024, streamless: r => r.text() });
  assert.equal(text, '{"ok":true}');

  const oversized = { headers: { get: () => null }, text: async () => 'x'.repeat(4096) };
  await assert.rejects(readBoundedBodyText(oversized, {
    maxBytes: 1024,
    streamless: async r => {
      const body = await r.text();
      if (body.length > 1024) throw new Error('too large for this caller');
      return body;
    },
  }), /too large for this caller/, 'the ceiling stays the caller wall to enforce on that path');
});

test('a read failure is translated, so raw server text never reaches the caller message', async () => {
  const failing = new Response(new ReadableStream({ start(c) { c.error(new Error('internal detail 0x9f')); } }));
  await assert.rejects(readBoundedBodyText(failing, { maxBytes: 64 }), /internal detail/);
  await assert.rejects(readBoundedBodyText(failing, {
    maxBytes: 64,
    translate: () => new Error('余额响应中断，请稍后刷新'),
  }), error => error.message === '余额响应中断，请稍后刷新');
});

test('a byte order mark is stripped before the text is handed back', async () => {
  const text = await readBoundedBodyText(new Response('\uFEFF{"ok":1}'), { maxBytes: 1024 });
  assert.equal(text, '{"ok":1}');
});

test('every read goes through the caller race, so a shutdown signal can abandon it', async () => {
  let raced = 0;
  const text = await readBoundedBodyText(new Response('{"ok":1}'), { maxBytes: 1024, race: promise => { raced++; return promise; } });
  assert.equal(text, '{"ok":1}');
  assert.ok(raced >= 1, 'the read was wrapped');

  const abandoned = readBoundedBodyText(new Response(streamOf([bytes(4)])), {
    maxBytes: 1024,
    race: () => Promise.reject(new Error('abandoned on shutdown')),
  });
  await assert.rejects(abandoned, /abandoned on shutdown/);
});
