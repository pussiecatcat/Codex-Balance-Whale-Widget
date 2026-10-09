// Native followers publish different packet shapes. Normalize the fields used
// by Electron before visibility and geometry decisions; retain diagnostics for
// status reporting without treating them as visibility commands.
function normalizeHostState(packet, { platform = process.platform } = {}) {
  if (!packet || typeof packet !== 'object' || Array.isArray(packet) || typeof packet.hostAlive !== 'boolean') return null;
  const mac = platform === 'darwin';
  const rect = packet.bounds;
  const bounds = rect && typeof rect === 'object' && ['x', 'y', 'width', 'height'].every(key => Number.isFinite(rect[key]))
    && rect.width >= 0 && rect.height >= 0
    ? { x: rect.x, y: rect.y, width: rect.width, height: rect.height } : null;
  return {
    ...packet,
    hostAlive: packet.hostAlive,
    hostPid: Number.isSafeInteger(packet.hostPid) && packet.hostPid > 0 ? packet.hostPid : 0,
    window: String(packet.window ?? '0'),
    visible: packet.visible === true,
    modal: packet.modal === true,
    attached: packet.attached === true,
    nativeFollowing: !mac && packet.nativeFollowing === true,
    followMode: typeof packet.followMode === 'string' && packet.followMode ? packet.followMode : mac ? 'macos-cgwindow-poll' : packet.nativeFollowing ? 'native' : 'windows-poll',
    bounds,
    dpi: Number.isFinite(packet.dpi) && packet.dpi > 0 ? packet.dpi : null,
    widgetVisible: typeof packet.widgetVisible === 'boolean' ? packet.widgetVisible : null,
    visibilityRevision: Number.isSafeInteger(packet.visibilityRevision) ? packet.visibilityRevision : null,
    mouseButtons: Number.isSafeInteger(packet.mouseButtons) && packet.mouseButtons >= 0 ? packet.mouseButtons : 0,
    mouseSampleAt: Number.isFinite(packet.mouseSampleAt) && packet.mouseSampleAt >= 0 ? packet.mouseSampleAt : 0,
  };
}

module.exports = { normalizeHostState };
