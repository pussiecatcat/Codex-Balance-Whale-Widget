// `desktop` is tri-state: true shows a standalone widget, false follows Codex,
// and an omitted argument leaves the current mode alone. Keep the mapping in
// one place so the tool description and the launch call cannot drift.
export function desktopModeArg(args = {}) {
  if (typeof args.desktop !== 'boolean') return {};
  return { mode: args.desktop ? 'standalone' : 'follow-codex' };
}
