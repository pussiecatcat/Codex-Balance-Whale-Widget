import nodeFs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { raw, text } from '../route-response.mjs';

const PACKAGE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const IMAGE_CANDIDATES = [
  path.join(PACKAGE_ROOT, 'assets', 'DSniang1.png'),
  path.join(PACKAGE_ROOT, 'assets', 'DSniang02.png'),
];
const RUA_GIF_CANDIDATES = [path.join(PACKAGE_ROOT, 'assets', 'rua.gif')];
const WIDGET_FILE = path.join(PACKAGE_ROOT, 'assets', 'whale-widget.js');

export function declareRoutes(ctx, deps) {
  const { fs = nodeFs } = deps;
  let imageBytes = null, gifBytes = null, widgetJsCache = null;
  function loadImage() {
    if (imageBytes) return imageBytes;
    for (const p of IMAGE_CANDIDATES) {
      try {
        const bytes = fs.readFileSync(p);
        if (bytes && bytes.length > 0) { imageBytes = bytes; return bytes; }
      } catch (err) { /* try the next shipped file */ }
    }
    throw new Error('whale image not found');
  }
  function loadGif() {
    if (gifBytes) return gifBytes;
    for (const p of RUA_GIF_CANDIDATES) {
      try {
        const bytes = fs.readFileSync(p);
        if (bytes && bytes.length > 0) { gifBytes = bytes; return bytes; }
      } catch (err) { /* try the next shipped file */ }
    }
    throw new Error('rua gif not found');
  }
  function loadWidgetJs() {
    try {
      const st = fs.statSync(WIDGET_FILE);
      if (widgetJsCache && widgetJsCache.mtimeMs === st.mtimeMs) return widgetJsCache.text;
      widgetJsCache = { text: fs.readFileSync(WIDGET_FILE, 'utf8'), mtimeMs: st.mtimeMs };
      return widgetJsCache.text;
    } catch { return widgetJsCache ? widgetJsCache.text : ''; }
  }
  const disposers = [];
  disposers.push(ctx.declareRoute({
    path: '/dsh-whale/image.png', methods: ['GET', 'HEAD'],
    handler: () => {
      try { return raw(loadImage(), 'image/png'); }
      catch (err) { return text('whale image unavailable: ' + String((err && err.message) || err)); }
    },
  }));
  disposers.push(ctx.declareRoute({
    path: '/dsh-whale/rua.gif', methods: ['GET', 'HEAD'],
    handler: () => {
      try { return raw(loadGif(), 'image/gif'); }
      catch (err) { return text('rua gif unavailable: ' + String((err && err.message) || err)); }
    },
  }));
  disposers.push(ctx.declareRoute({
    path: '/dsh-whale/widget.js', methods: ['GET', 'HEAD'],
    handler: () => raw(loadWidgetJs(), 'application/javascript; charset=utf-8'),
  }));
  return disposers;
}

export { PACKAGE_ROOT };
