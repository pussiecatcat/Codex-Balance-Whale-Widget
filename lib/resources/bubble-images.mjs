import path from 'node:path';
import { MEDIA_POLICY, decodeMediaDataUrl, validateImage } from '../media-validation.mjs';
import { pickResourceDirectory, importResource, deleteResource, validResourceId } from '../resource-store.mjs';
import { json, raw, text } from '../route-response.mjs';
import { DEFAULT_BUBBLE_IMGS } from '../widget-defaults.mjs';
import { BODY_LIMITS } from './shared.mjs';

export function declareRoutes(ctx, deps) {
  const { fs, dataRoot, packageRoot, readLibrary, libraryWarning, validEntries, mediaPath, mediaBudget, readMediaBytes, readBodyMax, writeResourceJson } = deps;
  const BUBBLE_IMG_DIR_CANDIDATES = [path.join(dataRoot, 'whale-bubble-imgs')];
  const BUBBLE_IMG_INDEX_NAME = 'bubble-imgs.json';
  function bubbleImgFileCandidates(file) { return [path.join(packageRoot, 'assets', file)]; }
  function loadBuiltinBubbleImgBytes(def) {
    if (!def || !def.file) return null;
    for (const p of bubbleImgFileCandidates(def.file)) {
      try {
        const bytes = fs.readFileSync(p);
        if (bytes && bytes.length > 0) return bytes;
      } catch { /* try the next shipped file */ }
    }
    return null;
  }
  const disposers = [];
    function pickBubbleImgDir() {
      return pickResourceDirectory(BUBBLE_IMG_DIR_CANDIDATES, BUBBLE_IMG_INDEX_NAME, { fs })
    }
    function defaultBubbleImgIndex() {
      return { version: 1, images: [] }
    }
    function readBubbleImgIndex(strict = false) {
      return readLibrary(path.join(pickBubbleImgDir(), BUBBLE_IMG_INDEX_NAME), defaultBubbleImgIndex(), value => value && validEntries(value.images), strict)
    }
    function writeBubbleImgIndex(index) {
      readBubbleImgIndex(true)
      return writeResourceJson(path.join(pickBubbleImgDir(), BUBBLE_IMG_INDEX_NAME), index, { fs })
    }
    function bubbleImgPayload() {
      const index = readBubbleImgIndex()
      // 内置默认图常驻(先列出,不占 createdAt 排序;用户图库含同 id 时不重复)
      const seen = {}
      index.images.forEach((im) => { seen[im.id] = 1 })
      const builtins = DEFAULT_BUBBLE_IMGS.filter((d) => !seen[d.id]).map((d) => ({
        id: d.id,
        name: String(d.name || d.id),
        format: d.format === 'gif' ? 'gif' : 'png',
        url: '/dsh-whale/bubble-img.png?id=' + encodeURIComponent(d.id),
        createdAt: null,
        builtin: true,
      }))
      return {
        ok: true,
        ...libraryWarning(path.join(pickBubbleImgDir(), BUBBLE_IMG_INDEX_NAME)),
        images: builtins.concat(index.images.slice().sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)).map((im) => ({
          id: im.id,
          name: String(im.name || im.id),
          format: im.format === 'gif' ? 'gif' : 'png',
          url: '/dsh-whale/bubble-img.png?id=' + encodeURIComponent(im.id),
          createdAt: im.createdAt || null,
        }))),
      }
    }
    function bubbleImgIdFromUrl(url) {
      try {
        const q = String(url || '').split('?')[1] || ''
        const m = /(?:^|&)id=([^&]+)/.exec(q)
        return m ? decodeURIComponent(m[1]) : ''
      } catch (err) { return '' }
    }
    disposers.push(ctx.declareRoute({
      path: '/dsh-whale/bubble-imgs.json',
      methods: ['GET', 'HEAD'],
      handler: (req) => {
        return json(bubbleImgPayload())
      },
    }))

    disposers.push(ctx.declareRoute({
      path: '/dsh-whale/bubble-img-upload.json',
      methods: ['POST', 'PUT'],
      bodyLimit: BODY_LIMITS.bubbleImageUpload,
      handler: async (req) => {
        try {
          const body = await readBodyMax(req, BODY_LIMITS.bubbleImageUpload)
          const parsed = JSON.parse(body)
          const action = parsed && parsed.action
          const index = readBubbleImgIndex(true)
          if (action === 'upload') {
            const name = String(parsed.name || '').trim().slice(0, 40) || ''
            const { bytes: buf, mime } = decodeMediaDataUrl(parsed.data, ['image/png', 'image/gif'], MEDIA_POLICY.bubbleBytes)
            const media = validateImage(buf, { mime, maxBytes: MEDIA_POLICY.bubbleBytes })
            const format = media.extension
            mediaBudget(buf.length, index.images.length)
            const id = 'bimg_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8)
            index.images.push({ id, name, format, width: media.width, height: media.height, frames: media.frames, createdAt: Date.now() })
            importResource(mediaPath(pickBubbleImgDir(), id, format), buf, () => writeBubbleImgIndex(index), { fs })
            return json(bubbleImgPayload())
          }
          if (action === 'delete') {
            const id = String(parsed.id || '')
            if (!validResourceId(id)) throw new Error('图片编号无效')
            const img = index.images.find((x) => x.id === id)
            if (!img) {
              return json({ ok: false, error: 'image not found' }, 404)
            }
            const original = structuredClone(index)
            index.images = index.images.filter((x) => x.id !== id)
            const ext = img.format === 'gif' ? 'gif' : 'png'
            deleteResource(mediaPath(pickBubbleImgDir(), id, ext), () => writeBubbleImgIndex(index), () => writeBubbleImgIndex(original), { fs })
            return json(bubbleImgPayload())
          }
          return json({ ok: false, error: 'unknown action' }, 400)
        } catch (err) {
          return json({ ok: false, error: String((err && err.message) || err).slice(0, 200) }, 400)
        }
      },
    }))

    disposers.push(ctx.declareRoute({
      path: '/dsh-whale/bubble-img.png',
      methods: ['GET', 'HEAD'],
      handler: (req) => {
        try {
          const id = bubbleImgIdFromUrl(req.url)
          if (!validResourceId(id)) throw new Error('图片编号无效')
          // 1) 用户图库优先
          const index = readBubbleImgIndex()
          const img = index.images.find((x) => x.id === id)
          if (img) {
            const ext = img.format === 'gif' ? 'gif' : 'png'
            const bytes = readMediaBytes(mediaPath(pickBubbleImgDir(), id, ext), MEDIA_POLICY.bubbleBytes)
            return raw(bytes, img.format === 'gif' ? 'image/gif' : 'image/png')
          }
          // 2) 内置默认图回退(全新安装无用户图库时,泡泡序列引用的语义 id 也能出图)
          const def = DEFAULT_BUBBLE_IMGS.find((x) => x.id === id)
          if (def) {
            const bytes = loadBuiltinBubbleImgBytes(def)
            if (bytes) {
              return raw(bytes, def.format === 'gif' ? 'image/gif' : 'image/png')
            }
          }
          throw new Error('bad image id')
        } catch (err) {
          return text('bubble image unavailable')
        }
      },
    }))

  return disposers;
}
