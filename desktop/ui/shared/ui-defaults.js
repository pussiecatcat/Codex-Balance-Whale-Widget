// Persisted UI defaults. Consumers clone mutable drafts before editing them.
export const UI_DEFAULTS = Object.freeze({
  roleId: 'default', displayCurrency: 'USD', bubbleShape: 'ellipse', position: 'bottom-right',
  snap: Object.freeze({
    mode: 'ratio',
    ratio: Object.freeze({ L: 10, T: 0, R: 10, B: 15, F: 50 }),
    px: Object.freeze({ L: 80, T: 0, R: 80, B: 80, F: -1 }),
  }),
  feedback: Object.freeze({
    feel: 'balanced',
    events: Object.freeze(Object.fromEntries(['press', 'release', 'success', 'cancelled', 'failed'].map(event =>
      [event, Object.freeze({ preset: ['press', 'release', 'success'].includes(event) ? 'original' : 'silent', volume: .8 })]))),
  }),
});
