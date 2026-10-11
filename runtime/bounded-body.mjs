import { Buffer } from 'node:buffer';

// The one place a response body is read under a byte ceiling. Each caller used
// to carry its own copy of this loop, with its own ceiling and its own cleanup,
// and they disagreed on the case that decides whether a hostile or broken
// response can be buffered whole: a body with no byte stream. Two of them fell
// back to response.text(), which allocates the entire body before any check.
//
//   maxBytes    the ceiling, counted as bytes arrive rather than after
//   race        wraps each read, so a caller that owns a shutdown signal can
//               abandon it (runtime/fx.mjs passes its own abortable)
//   tooLarge    the error for a body past the ceiling
//   unsupported the error for a body that cannot be read as a byte stream
//   streamless  reads a response the caller knows arrives without a stream, as
//               in-process adapters and tests do; without it such a response is
//               refused instead
//   translate   turns a read failure into the caller's error, so raw server
//               text never reaches a message a user reads
export async function readBoundedBodyText(response, {
  maxBytes,
  race = promise => promise,
  tooLarge = () => new Error('响应过大'),
  unsupported = () => new Error('响应体不是可读的字节流'),
  streamless = null,
  translate = error => error,
} = {}) {
  const cancel = async () => { try { await response.body?.cancel(); } catch {} };
  const declared = Number(response.headers?.get?.('content-length'));
  if (Number.isFinite(declared) && declared > maxBytes) { await cancel(); throw tooLarge(); }
  if (!response.body || typeof response.body.getReader !== 'function') {
    if (!streamless) { await cancel(); throw unsupported(); }
    return race(Promise.resolve().then(() => streamless(response)));
  }
  const reader = response.body.getReader(), chunks = [];
  let count = 0;
  try {
    for (;;) {
      const { done, value } = await race(reader.read());
      if (done) break;
      count += value.byteLength;
      if (count > maxBytes) { try { await reader.cancel(); } catch {} throw tooLarge(); }
      chunks.push(Buffer.from(value));
    }
    return Buffer.concat(chunks, count).toString('utf8').replace(/^\uFEFF/, '');
  } catch (error) {
    try { await reader.cancel(); } catch {}
    throw translate(error);
  } finally { reader.releaseLock(); }
}
