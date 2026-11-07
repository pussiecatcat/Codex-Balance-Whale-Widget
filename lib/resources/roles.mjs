import path from 'node:path';
import { BUILTIN_ROLES, builtinRole, isBuiltinRoleId } from '../builtin-roles.mjs';
import { MEDIA_POLICY, decodeMediaDataUrl, validateImage } from '../media-validation.mjs';
import { pickResourceDirectory, importResource, deleteResource } from '../resource-store.mjs';
import { json, raw, text } from '../route-response.mjs';
import { ROLE_DEFAULT_ID } from '../widget-defaults.mjs';
import { BODY_LIMITS, idFromUrl } from './shared.mjs';

export function declareRoutes(ctx, deps) {
  const { fs, dataRoot, readLibrary, libraryWarning, validEntries, mediaPath, mediaBudget, readMediaBytes, readBodyMax, writeResourceJson } = deps;
  const ROLE_DIR_CANDIDATES = [path.join(dataRoot, 'whale-roles'), path.join(dataRoot, 'profiles', 'web', 'whale-roles')];
  const ROLE_INDEX_NAME = 'roles.json';
  function pickRoleDir() { return pickResourceDirectory(ROLE_DIR_CANDIDATES, ROLE_INDEX_NAME, { fs }); }
  function defaultRolesIndex() {
    return { version: 1, roles: [{ id: ROLE_DEFAULT_ID, name: '小鲸鱼', pinnedAt: 1, createdAt: 0 }] };
  }
  function readRolesIndex(strict = false) {
    const dir = pickRoleDir();
    const parsed = readLibrary(path.join(dir, ROLE_INDEX_NAME), defaultRolesIndex(), value => value && validEntries(value.roles), strict);
    if (!parsed.roles.some(role => role.id === ROLE_DEFAULT_ID)) parsed.roles.unshift(defaultRolesIndex().roles[0]);
    for (const role of BUILTIN_ROLES) {
      if (!parsed.roles.some(item => item && item.id === role.id)) {
        parsed.roles.push({ id: role.id, name: role.name, format: role.format, width: role.width, height: role.height, frames: role.frames, pinnedAt: null, createdAt: 0 });
      }
    }
    return parsed;
  }
  function writeRolesIndex(index) {
    const dir = pickRoleDir();
    readRolesIndex(true);
    return writeResourceJson(path.join(dir, ROLE_INDEX_NAME), index, { fs });
  }
  function sortRoles(roles) {
    return roles.slice().sort((a, b) => {
      const ap = a.pinnedAt && a.pinnedAt > 0 ? a.pinnedAt : 0;
      const bp = b.pinnedAt && b.pinnedAt > 0 ? b.pinnedAt : 0;
      if (ap && bp) return bp - ap;
      if (ap) return -1;
      if (bp) return 1;
      return (b.createdAt || 0) - (a.createdAt || 0);
    });
  }
  function rolesPayload() {
    const index = readRolesIndex();
    return {
      ok: true,
      ...libraryWarning(path.join(pickRoleDir(), ROLE_INDEX_NAME)),
      roles: sortRoles(index.roles).map(role => ({
        id: role.id,
        name: String(role.name || role.id),
        url: role.id === ROLE_DEFAULT_ID ? '/dsh-whale/image.png' : '/dsh-whale/role-image.png?id=' + encodeURIComponent(role.id),
        builtin: role.id === ROLE_DEFAULT_ID || isBuiltinRoleId(role.id),
        pinned: !!(role.pinnedAt && role.pinnedAt > 0),
        pinnedAt: role.pinnedAt || null,
        createdAt: role.createdAt || null,
        format: ['gif', 'apng', 'jpeg', 'webp'].includes(role.format) ? role.format : 'png',
      })),
    };
  }
  function roleFileExt(format) { return format === 'gif' ? 'gif' : format === 'jpeg' ? 'jpg' : format === 'webp' ? 'webp' : 'png'; }
  function roleFilePath(id, format) {
    if (!validEntries([{ id }]) || id === ROLE_DEFAULT_ID || isBuiltinRoleId(id)) return null;
    return mediaPath(pickRoleDir(), id, roleFileExt(format));
  }
  function roleIndexFind(id, strict = false) {
    const index = readRolesIndex(strict);
    return { index, role: index.roles.find(role => role && role.id === id) };
  }
  function roleImagePath(id) {
    const shipped = builtinRole(id);
    if (shipped) return path.join(deps.packageRoot, 'assets', shipped.file);
    const { role } = roleIndexFind(id);
    if (!role) return null;
    return roleFilePath(id, role.format || 'png');
  }

  const disposers = [];
  disposers.push(ctx.declareRoute({
    path: '/dsh-whale/roles.json', methods: ['GET', 'HEAD', 'POST', 'PUT'], bodyLimit: BODY_LIMITS.roleImage,
    handler: async (req) => {
      if (req.method === 'POST' || req.method === 'PUT') {
        try {
          const body = await readBodyMax(req, BODY_LIMITS.roleImage);
          const parsed = JSON.parse(body);
          const name = String(parsed.name || '').trim().slice(0, 20) || '新角色';
          const { bytes: buf, mime } = decodeMediaDataUrl(parsed.image, ['image/png', 'image/jpeg', 'image/webp', 'image/gif'], MEDIA_POLICY.roleBytes);
          const media = validateImage(buf, { mime }), fmt = media.format;
          if (['gif', 'apng'].includes(parsed.format) && parsed.format !== fmt) throw new Error('声明的动画格式与文件不一致');
          const id = 'role_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
          const dir = pickRoleDir();
          const index = readRolesIndex(true);
          mediaBudget(buf.length, index.roles.filter(role => role.id !== ROLE_DEFAULT_ID && !isBuiltinRoleId(role.id)).length);
          index.roles.push({ id, name, format: fmt, width: media.width, height: media.height, frames: media.frames, pinnedAt: null, createdAt: Date.now() });
          importResource(mediaPath(dir, id, roleFileExt(fmt)), buf, () => writeRolesIndex(index), { fs });
          return json(rolesPayload());
        } catch (err) {
          return json({ ok: false, error: String((err && err.message) || err).slice(0, 200) }, 400);
        }
      }
      return json(rolesPayload());
    },
  }));
  disposers.push(ctx.declareRoute({
    path: '/dsh-whale/role-pin.json', methods: ['POST', 'PUT'], bodyLimit: BODY_LIMITS.rolePin,
    handler: async (req) => {
      try {
        const parsed = JSON.parse(await readBodyMax(req, BODY_LIMITS.rolePin));
        const { index, role } = roleIndexFind(String(parsed.id || ''), true);
        if (!role) return json({ ok: false, error: 'role not found' }, 404);
        role.pinnedAt = parsed.pinned === true ? Date.now() : null;
        writeRolesIndex(index);
        return json(rolesPayload());
      } catch (err) {
        return json({ ok: false, error: String((err && err.message) || err).slice(0, 200) }, 400);
      }
    },
  }));
  disposers.push(ctx.declareRoute({
    path: '/dsh-whale/role-delete.json', methods: ['POST', 'PUT'], bodyLimit: BODY_LIMITS.rolePin,
    handler: async (req) => {
      try {
        const parsed = JSON.parse(await readBodyMax(req, BODY_LIMITS.rolePin));
        const id = String(parsed.id || '');
        if (id === ROLE_DEFAULT_ID || isBuiltinRoleId(id)) {
          return json({ ok: false, error: id === ROLE_DEFAULT_ID ? 'cannot delete default role' : '内置角色不能删除' }, 400);
        }
        const { index, role } = roleIndexFind(id, true);
        if (!role) return json({ ok: false, error: 'role not found' }, 404);
        const p = roleFilePath(id, role.format || 'png');
        if (!p) throw new Error('角色编号无效');
        const original = structuredClone(index);
        index.roles = index.roles.filter(item => item.id !== id);
        deleteResource(p, () => writeRolesIndex(index), () => writeRolesIndex(original), { fs });
        return json(rolesPayload());
      } catch (err) {
        return json({ ok: false, error: String((err && err.message) || err).slice(0, 200) }, 400);
      }
    },
  }));
  disposers.push(ctx.declareRoute({
    path: '/dsh-whale/role-image.png', methods: ['GET', 'HEAD'],
    handler: (req) => {
      try {
        const id = idFromUrl(req.url);
        const p = roleImagePath(id);
        if (!p) throw new Error('bad role id');
        const bytes = readMediaBytes(p, MEDIA_POLICY.roleBytes);
        const { role } = roleIndexFind(id);
        const mime = role && role.format === 'gif' ? 'image/gif' : role?.format === 'jpeg' ? 'image/jpeg' : role?.format === 'webp' ? 'image/webp' : 'image/png';
        return raw(bytes, mime);
      } catch (err) {
        return text('role image unavailable');
      }
    },
  }));
  return disposers;
}
