export function clampToViewport(left, top, width, height, viewport, rightGap = 0) {
  return {
    left: Math.max(0, Math.min(left, Math.max(0, viewport.w - width - rightGap))),
    top: Math.max(0, Math.min(top, Math.max(0, viewport.h - height))),
  };
}

export function snapBounds(config, viewport) {
  const bounds = { L: 0, T: 0, R: viewport.w, B: viewport.h, F: viewport.w / 2 };
  if (!config || config.mode === 'off') return bounds;
  if (config.mode === 'px') {
    return { L: config.px.L, T: config.px.T, R: viewport.w - config.px.R,
      B: viewport.h - config.px.B, F: config.px.F };
  }
  return { L: viewport.w * config.ratio.L / 100, T: viewport.h * config.ratio.T / 100,
    R: viewport.w * (100 - config.ratio.R) / 100,
    B: viewport.h * (100 - config.ratio.B) / 100, F: viewport.w * config.ratio.F / 100 };
}

export function snapZones(config, cx, cyBox, cyImage, viewport) {
  const zones = { zH: null, zV: null, flip: false };
  if (!config || config.mode === 'off') return zones;
  const bounds = snapBounds(config, viewport);
  zones.flip = cx < bounds.F;
  if (cx < bounds.L) zones.zH = 'left';
  else if (cx > bounds.R) zones.zH = 'right';
  if (cyBox < bounds.T) zones.zV = 'top';
  else if (cyImage > bounds.B) zones.zV = 'bottom';
  return zones;
}

export function artCenterAt(left, top, width, height, flipped) {
  const imageWidth = Math.max(1, width * 0.5945);
  return { cx: flipped ? left + imageWidth / 2 : left + width - imageWidth / 2,
    cy: top + height - imageWidth / 2 };
}

export function restoreAnchor(anchor, viewport, width, height, rightGap = 0) {
  if (!anchor || anchor.v !== 2 || !['left', 'right'].includes(anchor.hAnchor) ||
      !Number.isFinite(anchor.hDist) || anchor.hDist < 0 ||
      !['top', 'bottom'].includes(anchor.vAnchor) || !Number.isFinite(anchor.vDist) || anchor.vDist < 0) return null;
  const distanceRight = anchor.hAnchor === 'right' ? anchor.hDist + rightGap : anchor.hDist;
  const left = anchor.hAnchor === 'left' ? anchor.hDist : viewport.w - distanceRight - width;
  const top = anchor.vAnchor === 'top' ? anchor.vDist : viewport.h - anchor.vDist - height;
  return { ...clampToViewport(left, top, width, height, viewport),
    h: anchor.hAnchor, hOff: anchor.hDist, v: anchor.vAnchor, vOff: anchor.vDist };
}
