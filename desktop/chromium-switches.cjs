// Chromium switches that must be set before app ready. Kept out of main.cjs so
// the platform matrix can be tested directly.
function applyChromiumSwitches({ app, platform = process.platform, env = process.env }) {
  // Windows layered/region-clipped transparent windows can remain logically
  // visible while their GPU surface stops presenting. Use the software path for
  // this small companion only; no settings or switches are applied to Codex.
  const softwareRendering = platform === 'win32' && env.WHALE_RENDER_MODE !== 'hardware';
  // The owned, region-clipped surface can be considered occluded by Chromium
  // independently of IsWindowVisible and the software/GPU rendering choice.
  // Disable that optimization only in this Windows companion, before app ready.
  const nativeOcclusionDisabled = platform === 'win32';
  if (nativeOcclusionDisabled) {
    const disabled = app.commandLine.getSwitchValue('disable-features').split(',').filter(Boolean);
    app.commandLine.appendSwitch('disable-features', [...new Set([...disabled, 'CalculateNativeWinOcclusion'])].join(','));
    app.commandLine.appendSwitch('disable-backgrounding-occluded-windows');
  }
  if (softwareRendering) app.disableHardwareAcceleration();
  else if (platform !== 'win32') app.commandLine.appendSwitch('enable-gpu-rasterization');
  return { softwareRendering, nativeOcclusionDisabled };
}
module.exports = { applyChromiumSwitches };
