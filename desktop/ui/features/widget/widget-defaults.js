// Widget-side defaults that the settings catalog also documents. Keeping them
// here gives settings-catalog.js a stable `file#symbol` reference instead of a
// line number that drifts as this file is refactored.
export const DEFAULT_SCALE = 1;
export const DEFAULT_BUBBLE_SHAPE = 'ellipse';
export const DEFAULT_ROLE_ID = 'default';
export const SNAP_VERSION = 3;
export const SNAP_DEFAULTS = Object.freeze({
  mode: 'ratio',
  ratio: Object.freeze({ L: 10, T: 0, R: 10, B: 15, F: 50 }),
  px: Object.freeze({ L: 80, T: 0, R: 80, B: 80, F: -1 }),
});
