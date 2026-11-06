// Roles that ship with the package, next to the default whale.
//
// They live in assets/, are listed for every user, and cannot be deleted or
// overwritten (pin and rename still work: those only touch roles.json). Their
// ids share a prefix so every place that reads role files from the data folder
// (the media pack export, file paths) can skip them with one check.
export const BUILTIN_ROLE_PREFIX = 'builtin_'

export const BUILTIN_ROLES = Object.freeze([
  Object.freeze({ id: 'builtin_xiaolongniang', name: '小龙娘', file: 'role-xiaolongniang.png', format: 'png', width: 610, height: 610, frames: 1 }),
  Object.freeze({ id: 'builtin_frieren', name: '芙莉莲', file: 'role-frieren.png', format: 'png', width: 610, height: 610, frames: 1 }),
])

export const isBuiltinRoleId = id => typeof id === 'string' && id.startsWith(BUILTIN_ROLE_PREFIX)
export const builtinRole = id => BUILTIN_ROLES.find(role => role.id === id) || null
