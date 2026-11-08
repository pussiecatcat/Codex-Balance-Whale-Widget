import fs from 'node:fs';
import {fileURLToPath} from 'node:url';
// Codex resolves plugin MCP servers with cwd "." at the plugin root; it does
// not expand CLAUDE_PLUGIN_ROOT, so a placeholder there fails at spawn time.
const mcp = JSON.parse(fs.readFileSync(new URL('../.mcp.json', import.meta.url), 'utf8'));
const servers = Object.entries(mcp.mcpServers || {});
if (!servers.length) throw new Error('MCP manifest declares no servers');
for (const [name, server] of servers) {
  const text = JSON.stringify(server);
  if (text.includes('${')) throw new Error('MCP server "' + name + '" uses an unsupported placeholder: ' + text);
  if (server.cwd !== '.') throw new Error('MCP server "' + name + '" must set cwd to "."');
  if (!Array.isArray(server.args) || !server.args.length ||
      server.args.some(arg => typeof arg !== 'string' || (!arg.startsWith('-') && !arg.startsWith('./')))) {
    throw new Error('MCP server "' + name + '" arguments must be contained ./ paths or flags: ' + text);
  }
}
for(const name of [
  '../vendor/smol-toml/dist/index.js','../desktop/main.cjs','../desktop/host-state.cjs','../desktop/mode-controller.cjs','../desktop/settings-window.cjs','../desktop/settings-domains.cjs','../desktop/legacy-storage-import.cjs','../desktop/tray.cjs','../desktop/app-actions.cjs','../desktop/renderer-lifecycle.cjs','../desktop/chromium-switches.cjs','../desktop/shortcuts.cjs','../desktop/diagnostics.cjs','../desktop/ipc-handlers.cjs','../desktop/test-harness.cjs','../desktop/ui/widget.html','../desktop/ui/features/widget/gesture.js','../desktop/ui/services/audio-engine.js','../desktop/ui/features/widget/workshop-dialog.js','../assets/DSniang1.png','../assets/feeding-bowl.png','../assets/feeding-steel-basin.png','../assets/feeding-steel-empty.png','../assets/feeding-rice-clump.png','../assets/feeding-empty-bowl.png','../assets/feeding-rice.webp','../assets/feeding-ready.webp',
  '../desktop/ui/services/request.js','../desktop/ui/services/sound-reference.js','../desktop/ui/shared/bubble-config/resolve.js','../desktop/ui/shared/bubble-config/content.js','../desktop/ui/shared/bubble-config/font-scale.js','../desktop/ui/shared/editor-routes.js','../desktop/ui/shared/quota-format.js','../desktop/ui/shared/labels.js','../desktop/ui/shared/ui-defaults.js','../desktop/ui/shared/ledger-day.js','../desktop/ui/shared/sound-model.js','../desktop/ui/services/scope.js','../desktop/ui/services/popover.js','../desktop/ui/services/settings-client.js','../desktop/ui/services/toast.js',
  '../desktop/ui/features/sound-settings/model.js','../desktop/ui/features/sound-settings/controller.js','../desktop/ui/features/sound-settings/view.js',
  '../desktop/ui/shared/bubble-config/defaults.js','../desktop/ui/shared/bubble-config/layout.js','../desktop/ui/features/widget/select.js','../desktop/ui/features/widget/usage-charts.js','../desktop/ui/features/widget/bubble-editor-commands.js','../desktop/ui/features/widget/bubble-scene.js','../desktop/ui/features/widget/bubble-notice-queue.js','../desktop/ui/features/widget/bubble-interaction.js','../desktop/ui/features/widget/input-policy.js','../desktop/ui/features/widget/task-end-sound.js','../desktop/ui/features/widget/name-marquee.js','../desktop/ui/features/widget/role-manager.js','../desktop/ui/features/widget/character-interaction.js','../desktop/ui/features/widget/asset-client.js','../desktop/ui/features/widget/anchors.js','../desktop/ui/features/widget/resource-manager.js','../desktop/ui/features/widget/menu-hover.js','../desktop/ui/features/widget/bubble-editor-view.js','../desktop/ui/features/widget/bubble-editor-controller.js','../desktop/ui/features/widget/reminder-editor.js','../desktop/ui/features/widget/item-editor.js','../desktop/ui/features/widget/bubble-editor-model.js','../desktop/ui/features/widget/usage-records-view.js','../desktop/ui/features/widget/usage-panel.js','../desktop/ui/features/widget/usage-alerts.js','../desktop/ui/features/widget/snap-editor.js','../desktop/ui/features/widget/bubble-color-select.js','../desktop/ui/features/widget/bubble-palette.js','../desktop/ui/features/widget/bubble-quick-editors.js','../desktop/ui/features/widget/usage-models-view.js','../desktop/ui/features/widget/usage-overview-view.js','../desktop/ui/shared/status-tones.js','../desktop/ui/features/widget/usage-navigation.js','../desktop/ui/features/widget/bubble-content.js','../desktop/ui/features/widget/bubble-template-help.js','../desktop/ui/features/widget/bubble-rows-view.js','../desktop/ui/features/widget/turn-notice-feed.js','../desktop/ui/features/widget/settings-mirror.js','../desktop/ui/features/widget/api-models/store.js','../desktop/ui/features/widget/api-models/editor.js','../desktop/ui/services/runtime-feed.js','../desktop/ui/services/ui-state.js','../desktop/ui/services/window-shape.js','../desktop/ui/services/pointer-input.js','../desktop/ui/features/widget/account-view.js',
  '../lib/errors.mjs',
  '../runtime/composition.mjs','../runtime/http-shim.mjs','../runtime/faults.mjs','../runtime/routes/core.mjs',
  '../runtime/size-settings.mjs','../runtime/sound-settings.mjs',
  '../runtime/balance-query.mjs','../runtime/turn-accounting.mjs','../runtime/notice-publisher.mjs',
  '../runtime/session-events.mjs','../runtime/session-parser.mjs','../runtime/bounded-body.mjs',
  '../lib/atomic-write.mjs','../lib/route-response.mjs',
]) {
  if(!fs.existsSync(fileURLToPath(new URL(name,import.meta.url))))throw new Error('Package dependency missing: '+name);
}
if(!fs.existsSync(fileURLToPath(new URL('../desktop/ui/features/widget/account-view.js',import.meta.url))))throw new Error('Account view module is missing');
if(!fs.existsSync(fileURLToPath(new URL('../desktop/ui/services/window-shape.js',import.meta.url))))throw new Error('Window region module is missing');
if(!fs.existsSync(fileURLToPath(new URL('../desktop/settings-store.cjs',import.meta.url))))throw new Error('Settings store module is missing');

// The settings window is a second page served over the same whale:// scheme.
// main 线的 dispatcher 按路径解析 desktop/ui/ 下的文件（无手工白名单表），
// 所以这里只验证文件在盘上；真正的可达性由 resolveUiFile 的扩展名与存在性检查保证。
const settingsFiles = ['settings.html','settings.css','settings.js','settings-catalog.js','settings-help.js','settings-pages.js'];
for(const name of settingsFiles) {
  if(!fs.existsSync(fileURLToPath(new URL('../desktop/ui/'+name,import.meta.url))))throw new Error('Settings window file is missing: '+name);
}
// The catalog is the single source of truth; if it is stale the settings window
// and docs/CONFIGURATION.md disagree with the running app.
await import('../runtime/dispatcher.mjs');
await import('../runtime/composition.mjs');
await import('../runtime/routes/core.mjs');
await import('../runtime/process.mjs');
await import('../runtime/size-settings.mjs');
await import('../runtime/sound-settings.mjs');
await import('../runtime/balance-query.mjs');
await import('../runtime/turn-accounting.mjs');
await import('../runtime/notice-publisher.mjs');
await import('../runtime/session-events.mjs');
await import('../runtime/session-parser.mjs');
await import('../runtime/bounded-body.mjs');
await import('../lib/atomic-write.mjs');
const {createRequire}=await import('node:module');
createRequire(import.meta.url)('../desktop/settings-store.cjs');
const catalog=(await import('../desktop/ui/settings-catalog.js')).default;
const problems=catalog.validate();
if(problems.length)throw new Error('Settings catalog is incomplete:\n'+problems.map(p=>'  '+p.id+' — '+p.problem).join('\n'));
process.stdout.write('Package dependency graph is complete. Settings window: '+settingsFiles.length+' files on disk, '+catalog.fields.length+' catalog fields.\n');
