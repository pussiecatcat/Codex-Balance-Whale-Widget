import path from 'node:path';
import nodeFs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createResourceDeps } from './resources/shared.mjs';
import { declareRoutes as staticMedia } from './resources/static-media.mjs';
import { declareRoutes as records } from './resources/records.mjs';
import { declareRoutes as roles } from './resources/roles.mjs';
import { declareRoutes as audio } from './resources/audio.mjs';
import { declareRoutes as bubbleImages } from './resources/bubble-images.mjs';
import { declareRoutes as bubbleConfig } from './resources/bubble-config.mjs';
import { DEFAULT_BUBBLE_IMGS, PRESET_FRAGMENTS, PRESET_GROUPS, ROLE_DEFAULT_ID } from './widget-defaults.mjs';

export { DEFAULT_BUBBLE_IMGS, PRESET_FRAGMENTS, PRESET_GROUPS, ROLE_DEFAULT_ID };

const PACKAGE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// The host only assembles resource route groups. Each group owns its paths,
// validation and persistence; the shared reader supplies the file primitives.
export function createWidgetHost(dataRoot, { fs = nodeFs } = {}) {
  return {
    declare(ctx) {
      const deps = { ...createResourceDeps({ dataRoot, fs }), packageRoot: PACKAGE_ROOT };
      const disposers = [staticMedia, records, roles, audio, bubbleImages, bubbleConfig]
        .flatMap(module => module(ctx, deps));
      ctx.effect(() => () => {
        for (const dispose of disposers) {
          try { dispose(); } catch (err) { /* best effort during shutdown */ }
        }
      });
      return disposers;
    },
  };
}
