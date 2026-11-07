// Global shortcut registration. Returns the flags main.cjs reports in status.
function registerShortcuts({ globalShortcut, isMac, toggle, reportVisibility, usesWindowShape, harnessEnabled, diagnose }) {
  const toggleRegistered = globalShortcut.register(isMac ? 'Command+Option+W' : 'Control+Alt+W', toggle);
  if (!toggleRegistered) diagnose('toggle-shortcut-unavailable');
  const diagnosticRegistered = usesWindowShape && !harnessEnabled
    ? globalShortcut.register('Control+Alt+Shift+F10', reportVisibility) : false;
  return { toggleRegistered, diagnosticRegistered };
}
module.exports = { registerShortcuts };
