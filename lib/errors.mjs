// A failure the caller caused and can act on: invalid settings, an unusable
// provider response, a conflicting write. The dispatcher answers these with
// their own message and a 4xx.
//
// Service layers throw these at their own validation points rather than the
// dispatcher guessing after the fact. Anything that reaches the dispatcher as a
// plain Error is therefore a defect in this process rather than something the
// user could fix — see runtime/faults.mjs.
//
// Lives in lib/ so that lib/ modules (workshop) and runtime/ modules (config,
// api-models) can all throw it without depending on each other.
export class DomainError extends Error {
  constructor(message, { status = 400, code = 'BAD_REQUEST', cause } = {}) {
    super(message, cause ? { cause } : undefined);
    this.name = 'DomainError';
    this.status = status;
    this.code = code;
  }
}

export function domainError(message, status = 400, code = 'BAD_REQUEST') {
  return new DomainError(message, { status, code });
}

export function asDomainError(error, { status = 400, code = 'BAD_REQUEST' } = {}) {
  if (error instanceof DomainError) return error;
  return new DomainError(String(error?.message || '操作失败'), { status, code, cause: error });
}
