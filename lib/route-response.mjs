// What a route handler answers with, as a value instead of as calls on a
// response object. A handler used to be handed a collector with writeHead and
// end on it and mutated that; these are the same four outcomes expressed as
// data, so a route reads as "produce this".
//
//   json(value, status)    the ordinary case: a JSON body
//   raw(value, type)       a raw body; its length header is computed from it,
//                          which is one place rather than one per route
//   text(message, status)  a plain-text message, which is what a missing binary
//                          resource answers with
//   empty(status)          no body at all, which is how an empty sound slot
//                          replies so the widget stays silent
//
// toResponse is the only interpreter of these, so the dispatcher and the tests
// that drive a host directly agree on what a route answered.

const JSON_TYPE = 'application/json; charset=utf-8'
const TEXT_TYPE = 'text/plain; charset=utf-8'
const KINDS = new Set(['json', 'bytes', 'text', 'empty'])

export const json = (value, status = 200) => ({ kind: 'json', status, value })
export const raw = (value, type, status = 200) => ({ kind: 'bytes', status, type, value })
export const text = (message, status = 404) => ({ kind: 'text', status, message })
export const empty = (status = 204) => ({ kind: 'empty', status })

export function toResponse(result, method = 'GET') {
  if (!result || typeof result !== 'object' || !KINDS.has(result.kind)) {
    // Loud rather than silent: a handler that forgets to answer would otherwise
    // look like a route that answers nothing.
    throw new Error('route handler returned no response')
  }
  const headers = { 'cache-control': 'no-store' }
  let body = Buffer.alloc(0)
  if (result.kind === 'json') {
    headers['content-type'] = JSON_TYPE
    body = Buffer.from(JSON.stringify(result.value))
  } else if (result.kind === 'bytes') {
    headers['content-type'] = result.type
    body = Buffer.isBuffer(result.value) ? result.value : Buffer.from(String(result.value))
  } else if (result.kind === 'text') {
    headers['content-type'] = TEXT_TYPE
    body = Buffer.from(result.message)
  }
  // The length describes the body the same request would have carried, so a
  // HEAD keeps the header its GET would send and drops only the bytes.
  if (body.length) headers['content-length'] = String(body.length)
  return { status: result.status, headers, body: method === 'HEAD' ? Buffer.alloc(0) : body }
}
