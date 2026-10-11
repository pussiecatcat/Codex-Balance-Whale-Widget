import fs from 'node:fs';
import {fileURLToPath} from 'node:url';
for(const name of [
  '../vendor/smol-toml/dist/index.js','../desktop/main.cjs','../desktop/host-state.cjs','../desktop/ui/widget.html','../desktop/ui/gesture.js','../desktop/ui/audio-engine.js','../desktop/ui/insights.js','../desktop/ui/workshop.js','../assets/DSniang1.png',
  '../desktop/ui/services/request.js','../desktop/ui/services/sound-reference.js',
  '../desktop/ui/features/sound-settings/model.js','../desktop/ui/features/sound-settings/controller.js','../desktop/ui/features/sound-settings/view.js',
  '../desktop/ui/features/bubble/default-content.js','../desktop/ui/features/bubble/bubble-layout.js','../desktop/ui/components/custom-select.js','../desktop/ui/features/usage/usage-charts.js','../desktop/ui/features/bubble/bubble-editor-commands.js','../desktop/ui/features/bubble/bubble-scene.js','../desktop/ui/features/bubble/bubble-notice-queue.js','../desktop/ui/features/bubble/bubble-interaction.js','../desktop/ui/features/character/input-policy.js','../desktop/ui/features/audio/task-end-sound.js','../desktop/ui/components/name-marquee.js','../desktop/ui/features/roles/role-manager.js','../desktop/ui/features/character/character-interaction.js','../desktop/ui/services/asset-client.js','../desktop/ui/features/character/anchors.js','../desktop/ui/features/resources/resource-manager.js','../desktop/ui/features/character/menu-hover.js','../desktop/ui/features/bubble/bubble-editor-view.js','../desktop/ui/features/bubble/bubble-editor-model.js','../desktop/ui/features/usage/usage-records-view.js','../desktop/ui/features/usage/usage-alerts.js','../desktop/ui/features/character/snap-editor.js','../desktop/ui/features/bubble/bubble-color-select.js','../desktop/ui/features/bubble/bubble-palette.js','../desktop/ui/features/bubble/bubble-quick-editors.js','../desktop/ui/features/usage/usage-models-view.js','../desktop/ui/features/usage/usage-overview-view.js','../desktop/ui/features/usage/fx-controls.js','../desktop/ui/features/usage/usage-navigation.js','../desktop/ui/features/bubble/bubble-content.js','../desktop/ui/features/bubble/bubble-template-help.js','../desktop/ui/features/bubble/bubble-rows-view.js','../desktop/ui/features/usage/turn-notice-poller.js',
  '../runtime/size-settings.mjs','../runtime/sound-settings.mjs',
  '../runtime/balance-query.mjs','../runtime/turn-accounting.mjs','../runtime/notice-publisher.mjs',
  '../runtime/session-events.mjs','../runtime/session-parser.mjs','../runtime/bounded-body.mjs',
  '../lib/atomic-write.mjs','../lib/route-result.mjs',
  '../desktop/ui/services/lifecycle.js','../desktop/ui/services/settings-client.js',
  '../desktop/ui/features/roles/role-import.js','../desktop/ui/features/audio/audio-editor.js','../desktop/ui/features/bubble/bubble-editor.js',
]) {
  if(!fs.existsSync(fileURLToPath(new URL(name,import.meta.url))))throw new Error('Package dependency missing: '+name);
}
if(!fs.existsSync(fileURLToPath(new URL('../desktop/ui/account-view.js',import.meta.url))))throw new Error('Account view module is missing');
if(!fs.existsSync(fileURLToPath(new URL('../desktop/ui/shape.js',import.meta.url))))throw new Error('Window region module is missing');
await import('../runtime/dispatcher.mjs');
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
process.stdout.write('Package dependency graph is complete.\n');
