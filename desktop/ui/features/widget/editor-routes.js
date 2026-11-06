// The editor names the settings window may request. Kept as a module so the
// catalog test can prove every `editor.name` in settings-catalog.js is actually
// routed by the widget instead of trusting a hand-maintained list in a comment.
//
// Route names are plain identifiers; per-item choices travel in `args`
// (for example `reminder` + `{ kind: 'alert' }` or `api-model` + `{ id }`).
export const EDITOR_ROUTES = Object.freeze([
  'role',
  'snap',
  'bubble',
  'reminder',
  'workshop',
  'api',
  'api-model',
  'feedback-events',
  'sound',
]);

export function isEditorRoute(name) {
  return EDITOR_ROUTES.includes(String(name || ''));
}
