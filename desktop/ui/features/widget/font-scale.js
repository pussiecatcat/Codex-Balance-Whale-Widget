// Bubble font-size levels.
//
// A module's `size` is a level from 1 to 50 that maps to a font size in bubble
// units (--dshw-u; the bubble is 1026 units wide). Two maps exist:
//
//   legacy (no `fontScale` field)  1 → 40u, 50 → 240u
//   fine   (`fontScale: 2`)        1 → 24u, 50 → 200u
//
// The fine map gives smaller text at both ends and smaller steps, so a level is
// easier to adjust. Saved bubbles keep the legacy map until someone moves a size
// slider; at that point the whole module (its own size and every line's size) is
// converted to the fine map, so it looks the same and only the edited value
// changes. Untouched built-in defaults therefore stay byte-identical and keep
// receiving default updates.
export const FINE_FONT_SCALE = 2;
export const FONT_LEVEL_MIN = 1;
export const FONT_LEVEL_MAX = 50;
const DEFAULT_LEVEL = 6;

const LEGACY = { min: 40, max: 240 };
const FINE = { min: 24, max: 200 };
const span = FONT_LEVEL_MAX - FONT_LEVEL_MIN;

function clampLevel(level, fallback = DEFAULT_LEVEL) {
  const n = Math.round(Number(level));
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return Math.max(FONT_LEVEL_MIN, Math.min(FONT_LEVEL_MAX, n));
}

export function isFineScale(module) {
  return !!module && module.fontScale === FINE_FONT_SCALE;
}

function unitsFor(map, level) {
  return map.min + (clampLevel(level) - FONT_LEVEL_MIN) * (map.max - map.min) / span;
}

/** Font size in bubble units for a level, read with the module's own map. */
export function fontUnits(level, module) {
  return Math.round(unitsFor(isFineScale(module) ? FINE : LEGACY, level));
}

/** The fine-map level that renders closest to a legacy level. */
export function legacyLevelToFine(level) {
  const units = unitsFor(LEGACY, level);
  return clampLevel(FONT_LEVEL_MIN + (units - FINE.min) * span / (FINE.max - FINE.min));
}

/** The level a slider should show for this module (or one of its lines). */
export function displayLevel(module, level) {
  const value = level ?? module?.size;
  return isFineScale(module) ? clampLevel(value) : legacyLevelToFine(value);
}

/**
 * Convert a legacy module to the fine map in place. Every size it carries is
 * converted, including a missing module size (which renders as the default
 * level), so the module looks the same afterwards.
 */
export function upgradeFontScale(module) {
  if (!module || typeof module !== 'object' || isFineScale(module)) return module;
  module.size = legacyLevelToFine(module.size);
  if (Array.isArray(module.lines)) {
    for (const line of module.lines) {
      if (line && typeof line === 'object' && line.size != null) line.size = legacyLevelToFine(line.size);
    }
  }
  module.fontScale = FINE_FONT_SCALE;
  return module;
}

/** Apply a slider value: upgrade the module first, then set the edited size. */
export function setFontLevel(module, value, line) {
  upgradeFontScale(module);
  const level = clampLevel(value);
  if (line) line.size = level; else module.size = level;
  return level;
}
