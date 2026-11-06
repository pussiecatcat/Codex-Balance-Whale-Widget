import path from 'node:path';
import { MEDIA_POLICY } from '../media-validation.mjs';
import { pickResourceDirectory, validResourceId, importResource, deleteResource } from '../resource-store.mjs';
import { decodeMediaDataUrl, validateWav } from '../media-validation.mjs';
import { json, raw, text, empty } from '../route-response.mjs';
import { PRESET_GROUPS, PRESET_FRAGMENTS } from '../widget-defaults.mjs';
import { BODY_LIMITS } from './shared.mjs';

export function declareRoutes(ctx, deps) {
  const { fs, dataRoot, readLibrary, libraryWarning, validEntries, mediaPath, mediaBudget, readMediaBytes, readBodyMax, writeResourceJson, packageRoot } = deps;
  const AUDIO_DIR_CANDIDATES = [path.join(dataRoot, 'whale-audio'), path.join(dataRoot, 'profiles', 'web', 'whale-audio')];
  const AUDIO_INDEX_NAME = 'audio.json';
  const SOUND_SETS = {
    duck: { press: [path.join(packageRoot, 'assets', 'Ya1.mp3')], release: [path.join(packageRoot, 'assets', 'Ya2.mp3')] },
    fx1: { press: [path.join(packageRoot, 'assets', 'D1.mp3')], release: [path.join(packageRoot, 'assets', 'D2.mp3')] },
  };
  function soundSetFromUrl(url) {
    try {
      const q = String(url || '').split('?')[1] || '';
      const m = /(?:^|&)set=([^&]+)/.exec(q);
      return m ? decodeURIComponent(m[1]) : '';
    } catch { return ''; }
  }
  const disposers = [];
    function pickAudioDir() {
      return pickResourceDirectory(AUDIO_DIR_CANDIDATES, AUDIO_INDEX_NAME, { fs })
    }

    function defaultAudioIndex() {
      return { version: 1, groups: [], fragments: [] }
    }

    function readAudioIndex(strict = false) {
      const dir = pickAudioDir()
      return readLibrary(path.join(dir, AUDIO_INDEX_NAME), defaultAudioIndex(), value => value && validEntries(value.groups) && validEntries(value.fragments), strict)
    }

    function writeAudioIndex(index) {
      const dir = pickAudioDir()
      readAudioIndex(true)
      return writeResourceJson(path.join(dir, AUDIO_INDEX_NAME), index, { fs })
    }

    // 自定义片段 id -> 文件路径；预设片段无文件
    function audioFragmentPath(id) {
      if (!validResourceId(id)) return null
      if (PRESET_FRAGMENTS[id]) return null
      return mediaPath(pickAudioDir(), id, 'wav')
    }

    function audioIdFromUrl(url) {
      try {
        const q = String(url || '').split('?')[1] || ''
        const m = /(?:^|&)id=([^&]+)/.exec(q)
        return m ? decodeURIComponent(m[1]) : ''
      } catch (err) { return '' }
    }

    // 片段列表：预设片段 + 用户自定义片段
    function audioFragmentsPayload() {
      const index = readAudioIndex()
      const presets = Object.keys(PRESET_FRAGMENTS).map((k) => ({
        id: k,
        name: PRESET_FRAGMENTS[k].name,
        preset: true,
      }))
      const custom = index.fragments.map((f) => ({
        id: f.id,
        name: String(f.name || f.id),
        preset: false,
        createdAt: f.createdAt || null,
      }))
      return presets.concat(custom)
    }

    // 音效组列表：预设组 + 用户自定义组（置顶优先，组内按创建时间倒序）
    function audioGroupsPayload() {
      const index = readAudioIndex()
      // 排序：置顶的自定义组最前，其次预设组，最后未置顶的自定义组（按创建时间倒序）
      const customs = index.groups.slice().map((g) => ({
        id: g.id,
        name: String(g.name || g.id),
        press: typeof g.press === 'string' ? g.press : null,
        release: typeof g.release === 'string' ? g.release : null,
        preset: false,
        pinned: !!(g.pinnedAt && g.pinnedAt > 0),
        pinnedAt: g.pinnedAt || null,
        createdAt: g.createdAt || 0,
      }))
      const pinned = customs.filter((g) => g.pinned).sort((a, b) => b.pinnedAt - a.pinnedAt)
      const unpinned = customs.filter((g) => !g.pinned).sort((a, b) => b.createdAt - a.createdAt)
      const presets = Object.keys(PRESET_GROUPS).map((k) => {
        const g = PRESET_GROUPS[k]
        return { id: g.id, name: g.name, press: g.press, release: g.release, preset: true, pinned: false, pinnedAt: null, createdAt: 0 }
      })
      return pinned.concat(presets, unpinned)
    }

    function audioPayload() {
      const groups = audioGroupsPayload(), fragments = audioFragmentsPayload()
      return {
        ok: true,
        ...libraryWarning(path.join(pickAudioDir(), AUDIO_INDEX_NAME)),
        groups,
        fragments,
      }
    }

    // 取片段音频字节：预设走 SOUND_SETS 文件，自定义走 whale-audio/<id>.wav
    function loadAudioFragmentBytes(fragId) {
      if (PRESET_FRAGMENTS[fragId]) {
        // 预设片段映射到对应音效文件：ya1->duck.press, ya2->duck.release, d1->fx1.press, d2->fx1.release
        const map = { ya1: ['duck', 'press'], ya2: ['duck', 'release'], d1: ['fx1', 'press'], d2: ['fx1', 'release'] }
        const [setName, slot] = map[fragId]
        const set = SOUND_SETS[setName]
        if (!set) return null
        return loadSound(set[slot])
      }
      const p = audioFragmentPath(fragId)
      if (!p) return null
      try {
        const bytes = readMediaBytes(p, MEDIA_POLICY.audioBytes)
        if (bytes && bytes.length > 0) return bytes
      } catch (err) { /* a missing optional file is handled by the caller */ }
      return null
    }

    // 组内实际使用的片段：若自定义组引用的片段被删，回退到预设
    // 返回 '' 表示该槽显式留空（该事件静音），调用方应据此不发音频
    function groupFragmentId(groupId, slot) {
      const custom = readAudioIndex().groups.find((g) => g && g.id === groupId)
      if (custom) {
        const fid = custom[slot]
        if (fid === '') return ''
        if (fid) {
          if (PRESET_FRAGMENTS[fid]) return fid
          if (customFragExists(fid)) return fid
        }
        // 无字段/引用失效 → 回退预设：新组无引用时用 duck
        return slot === 'press' ? PRESET_GROUPS.duck.press : PRESET_GROUPS.duck.release
      }
      const preset = PRESET_GROUPS[groupId]
      if (preset) return preset[slot]
      return slot === 'press' ? PRESET_GROUPS.duck.press : PRESET_GROUPS.duck.release
    }

    function customFragExists(id) {
      try {
        const p = audioFragmentPath(id)
        if (!p) return false
        const st = fs.statSync(p)
        return st.isFile()
      } catch (err) { return false }
    }

    disposers.push(ctx.declareRoute({
      path: '/dsh-whale/audio.json',
      methods: ['GET', 'HEAD', 'POST', 'PUT'],
      bodyLimit: BODY_LIMITS.audioUpload,
      handler: async (req) => {
        if (req.method === 'POST' || req.method === 'PUT') {
          try {
            const body = await readBodyMax(req, BODY_LIMITS.audioUpload)
            const parsed = JSON.parse(body)
            const action = parsed.action
            const index = readAudioIndex(true)
            if (action === 'upload-fragment') {
              const name = String(parsed.name || '').trim().slice(0, 40) || '未命名音频'
              const { bytes: buf } = decodeMediaDataUrl(parsed.audio, ['audio/wav'], MEDIA_POLICY.audioBytes)
              const media = validateWav(buf)
              mediaBudget(buf.length, index.fragments.length)
              const id = 'audio_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8)
              index.fragments.push({ id, name, duration: media.duration, createdAt: Date.now() })
              importResource(mediaPath(pickAudioDir(), id, 'wav'), buf, () => writeAudioIndex(index), { fs })
              return json({ ok: true, id, fragments: audioFragmentsPayload() })
            }
            if (action === 'save-group') {
              const id = String(parsed.id || '')
              const name = String(parsed.name || '').trim().slice(0, 20) || '未命名音效组'
              const press = String(parsed.press ?? '')
              const release = String(parsed.release ?? '')
              // 校验引用片段存在（预设或自定义）；空字符串=该槽留空(该事件静音)，允许保存
              const frags = audioFragmentsPayload().map((f) => f.id)
              const validPress = press === '' ? '' : (frags.includes(press) ? press : PRESET_GROUPS.duck.press)
              const validRelease = release === '' ? '' : (frags.includes(release) ? release : PRESET_GROUPS.duck.release)
              if (id && index.groups.some((g) => g.id === id)) {
                const g = index.groups.find((x) => x.id === id)
                g.name = name
                g.press = validPress
                g.release = validRelease
              } else {
                if (index.groups.length >= MEDIA_POLICY.maxItemsPerLibrary) throw new Error('自定义音效组最多 256 项')
                const gid = 'group_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8)
                index.groups.push({ id: gid, name, press: validPress, release: validRelease, pinnedAt: null, createdAt: Date.now() })
              }
              writeAudioIndex(index)
              return json({ ok: true, groups: audioGroupsPayload() })
            }
            if (action === 'delete-group') {
              const id = String(parsed.id || '')
              if (PRESET_GROUPS[id]) {
                return json({ ok: false, error: 'cannot delete preset group' }, 400)
              }
              index.groups = index.groups.filter((g) => g.id !== id)
              writeAudioIndex(index)
              return json({ ok: true, groups: audioGroupsPayload() })
            }
            if (action === 'delete-fragment') {
              const id = String(parsed.id || '')
              if (PRESET_FRAGMENTS[id]) {
                return json({ ok: false, error: 'cannot delete preset fragment' }, 400)
              }
              if (!validResourceId(id) || !index.fragments.some(f => f.id === id)) throw new Error('音频片段不存在')
              const original = structuredClone(index)
              const p = audioFragmentPath(id)
              if (!p) throw new Error('音频片段编号无效')
              index.fragments = index.fragments.filter((f) => f.id !== id)
              deleteResource(p, () => writeAudioIndex(index), () => writeAudioIndex(original), { fs })
              return json({ ok: true, fragments: audioFragmentsPayload(), groups: audioGroupsPayload() })
            }
            if (action === 'pin-group') {
              const id = String(parsed.id || '')
              const g = index.groups.find((x) => x.id === id)
              if (!g) {
                return json({ ok: false, error: 'group not found' }, 404)
              }
              g.pinnedAt = parsed.pinned === true ? Date.now() : null
              writeAudioIndex(index)
              return json({ ok: true, groups: audioGroupsPayload() })
            }
            return json({ ok: false, error: 'unknown action' }, 400)
          } catch (err) {
            return json({ ok: false, error: String((err && err.message) || err).slice(0, 200) }, 400)
          }
        }
        return json(audioPayload())
      },
    }))

    disposers.push(ctx.declareRoute({
      path: '/dsh-whale/audio-fragment.wav',
      methods: ['GET', 'HEAD'],
      handler: (req) => {
        try {
          const id = audioIdFromUrl(req.url)
          const bytes = loadAudioFragmentBytes(id)
          if (!bytes) throw new Error('bad fragment id')
          // 预设片段是 mp3（来自 assets），自定义片段是 wav —— Content-Type 必须与字节匹配，
          // 否则浏览器解码路径/加载行为异常（MIME 与字节不符会导致听感差异）
          const mime = PRESET_FRAGMENTS[id] ? 'audio/mpeg' : 'audio/wav'
          return raw(bytes, mime)
        } catch (err) {
          return text('audio fragment unavailable')
        }
      },
    }))

    function loadSound(candidates) {
      for (const p of candidates) {
        try {
          const bytes = fs.readFileSync(p)
          if (bytes && bytes.length > 0) return bytes
        } catch (err) { /* a missing optional file is handled by the caller */ }
      }
      return null
    }

    function serveSound(req, candidates) {
      const bytes = loadSound(candidates)
      if (!bytes) {
        return text('sound unavailable')
      }
      return raw(bytes, 'audio/mpeg')
    }

    disposers.push(ctx.declareRoute({
      path: '/dsh-whale/sound/press.mp3',
      methods: ['GET', 'HEAD'],
      handler: (req) => {
        const set = SOUND_SETS[soundSetFromUrl(req.url)] || SOUND_SETS.duck
        // 自定义音效组：set 为组 id 时按组内 press 片段取音频
        const setName = soundSetFromUrl(req.url)
        if (setName && !SOUND_SETS[setName]) {
          const fragId = groupFragmentId(setName, 'press')
          if (fragId === '') { return empty() } // 留空槽：该事件静音
          const bytes = loadAudioFragmentBytes(fragId)
          if (bytes) {
            return raw(bytes, PRESET_FRAGMENTS[fragId] ? 'audio/mpeg' : 'audio/wav')
          }
        }
        return serveSound(req, set.press)
      },
    }))

    disposers.push(ctx.declareRoute({
      path: '/dsh-whale/sound/release.mp3',
      methods: ['GET', 'HEAD'],
      handler: (req) => {
        const set = SOUND_SETS[soundSetFromUrl(req.url)] || SOUND_SETS.duck
        const setName = soundSetFromUrl(req.url)
        if (setName && !SOUND_SETS[setName]) {
          const fragId = groupFragmentId(setName, 'release')
          if (fragId === '') { return empty() } // 留空槽：该事件静音
          const bytes = loadAudioFragmentBytes(fragId)
          if (bytes) {
            return raw(bytes, PRESET_FRAGMENTS[fragId] ? 'audio/mpeg' : 'audio/wav')
          }
        }
        return serveSound(req, set.release)
      },
    }))

  return disposers;
}
