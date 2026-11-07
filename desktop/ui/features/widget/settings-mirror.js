// Mirrors the size domain a settings-window save broadcasts back into the
// widget's live state. Keeping it here lets the mirror be tested without
// slicing the composition root.
export function mirrorSizeSettings(saved, target = {}) {
  saved = saved || {};
  if (typeof saved.scale === 'number') target.scale = saved.scale;
  target.bubbleOn = saved.bubbleOn;
  target.scrollGapOn = saved.scrollGapOn;
  target.scrollGapPx = saved.scrollGapPx;
  target.menuBtnHide = saved.menuBtnHide === true;
  return target;
}
