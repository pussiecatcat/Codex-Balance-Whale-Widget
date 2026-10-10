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
  const diagnostics = normalizeDiagnostics(packet.visualDiagnostics);
  return {
    hostAlive: packet.hostAlive,
    hostPid: Number.isSafeInteger(packet.hostPid) && packet.hostPid > 0 ? packet.hostPid : 0,
    hostSession: typeof packet.hostSession === 'string' ? packet.hostSession.slice(0, 160) : '',
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
    serial: Number.isSafeInteger(packet.serial) && packet.serial >= 0 ? packet.serial : null,
    monitorExit: packet.monitorExit === true,
    mode: packet.mode === 'standalone' ? 'standalone' : packet.mode === 'follow-codex' ? 'follow-codex' : null,
    visualDiagnostics: diagnostics,
  };
}

function normalizeDiagnostics(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const result = {};
  for (const key of ['exists', 'visible', 'iconic', 'ownerMatches', 'hostForeground', 'overlayForeground',
    'aboveHost', 'orderKnown', 'topmost', 'toolWindow', 'transparent', 'cloakKnown', 'cloaked']) {
    if (typeof value[key] === 'boolean') result[key] = value[key];
  }
  for (const key of ['sampledAt', 'regionType']) if (Number.isFinite(value[key])) result[key] = value[key];
  for (const key of ['regionBounds', 'bounds']) {
    const rect = value[key];
    if (rect && typeof rect === 'object' && ['left', 'top', 'right', 'bottom'].every(name => Number.isFinite(rect[name]))) {
      result[key] = { left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom };
    }
  }
  return Object.keys(result).length ? result : null;
}

function parseInitialHostState(value, options) {
  try { return normalizeHostState(JSON.parse(value || 'null'), options); }
  catch { return null; }
}

module.exports = { normalizeHostState, parseInitialHostState };
