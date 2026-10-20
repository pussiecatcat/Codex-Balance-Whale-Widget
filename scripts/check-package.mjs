import fs from 'node:fs';
import {fileURLToPath} from 'node:url';
for(const name of [
  '../vendor/smol-toml/dist/index.js','../desktop/main.cjs','../desktop/host-state.cjs','../desktop/diagnostics.cjs','../desktop/ipc-handlers.cjs','../desktop/test-harness.cjs','../desktop/ui/widget.html','../desktop/ui/gesture.js','../desktop/ui/audio-engine.js','../desktop/ui/insights.js','../desktop/ui/workshop.js','../assets/DSniang1.png',
  '../desktop/ui/services/request.js','../desktop/ui/services/sound-reference.js',
  '../desktop/ui/features/sound-settings/model.js','../desktop/ui/features/sound-settings/controller.js','../desktop/ui/features/sound-settings/view.js',
  '../desktop/ui/features/widget/default-content.js','../desktop/ui/features/widget/bubble-layout.js','../desktop/ui/features/widget/custom-select.js','../desktop/ui/features/widget/usage-charts.js','../desktop/ui/features/widget/bubble-editor-commands.js','../desktop/ui/features/widget/bubble-scene.js','../desktop/ui/features/widget/bubble-notice-queue.js','../desktop/ui/features/widget/bubble-interaction.js','../desktop/ui/features/widget/input-policy.js','../desktop/ui/features/widget/task-end-sound.js','../desktop/ui/features/widget/name-marquee.js','../desktop/ui/features/widget/role-manager.js','../desktop/ui/features/widget/character-interaction.js','../desktop/ui/features/widget/asset-client.js','../desktop/ui/features/widget/anchors.js','../desktop/ui/features/widget/resource-manager.js','../desktop/ui/features/widget/menu-hover.js','../desktop/ui/features/widget/bubble-editor-view.js','../desktop/ui/features/widget/bubble-editor-model.js','../desktop/ui/features/widget/usage-records-view.js','../desktop/ui/features/widget/usage-alerts.js','../desktop/ui/features/widget/snap-editor.js','../desktop/ui/features/widget/bubble-color-select.js','../desktop/ui/features/widget/bubble-palette.js','../desktop/ui/features/widget/bubble-quick-editors.js','../desktop/ui/features/widget/usage-models-view.js','../desktop/ui/features/widget/usage-overview-view.js','../desktop/ui/features/widget/fx-controls.js','../desktop/ui/features/widget/usage-navigation.js','../desktop/ui/features/widget/bubble-content.js','../desktop/ui/features/widget/bubble-template-help.js','../desktop/ui/features/widget/bubble-rows-view.js','../desktop/ui/features/widget/turn-notice-poller.js',
  '../lib/errors.mjs',
  '../runtime/composition.mjs','../runtime/http-shim.mjs','../runtime/faults.mjs','../runtime/routes/core.mjs',
  '../runtime/size-settings.mjs','../runtime/sound-settings.mjs',
  '../runtime/balance-query.mjs','../runtime/turn-accounting.mjs','../runtime/notice-publisher.mjs',
  '../runtime/session-events.mjs','../runtime/session-parser.mjs','../runtime/bounded-body.mjs',
  '../lib/atomic-write.mjs',
]) {
  if(!fs.existsSync(fileURLToPath(new URL(name,import.meta.url))))throw new Error('Package dependency missing: '+name);
}
if(!fs.existsSync(fileURLToPath(new URL('../desktop/ui/account-view.js',import.meta.url))))throw new Error('Account view module is missing');
if(!fs.existsSync(fileURLToPath(new URL('../desktop/ui/shape.js',import.meta.url))))throw new Error('Window region module is missing');
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
// package.json declares "type": "module", so require() would treat this plain
// browser script as ESM and skip its module.exports branch. Run it in a sandbox
// with an explicit module object, the way tests/settings-catalog.test.mjs does.
const vm=await import('node:vm');
const catalogModule={exports:{}};
vm.runInNewContext(fs.readFileSync(fileURLToPath(new URL('../desktop/ui/settings-catalog.js',import.meta.url)),'utf8'),{module:catalogModule,globalThis:{},console});
const catalog=catalogModule.exports;
const problems=catalog.validate();
if(problems.length)throw new Error('Settings catalog is incomplete:\n'+problems.map(p=>'  '+p.id+' — '+p.problem).join('\n'));
process.stdout.write('Package dependency graph is complete. Settings window: '+settingsFiles.length+' files on disk, '+catalog.fields.length+' catalog fields.\n');
