import { requestJson } from './request.js';

const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const copy = value => value === undefined ? null : structuredClone(value);

/**
 * @typedef {{schemaVersion: 2, base: Object, patch: Object}} SettingsCommand
 * Each patch leaf has a matching base leaf for optimistic conflict checks.
 * Arrays are one editable value; object leaves are independent settings.
 * @param {{size?: Object, usage?: Object}} snapshot Confirmed server values.
 * @param {{size?: Object, usage?: Object}} proposed Only the user's edited fields.
 * @returns {SettingsCommand|null} Null means no write is needed.
 */
export function settingsCommand(snapshot, proposed) {
  function changes(before, after) {
    const base = {}, patch = {};
    for (const [key, value] of Object.entries(after)) {
      if (['__proto__', 'prototype', 'constructor'].includes(key)) throw new Error('无效设置字段');
      if (object(value)) {
        const nested = changes(before?.[key] || {}, value);
        if (Object.keys(nested.patch).length) { base[key] = nested.base; patch[key] = nested.patch; }
      } else if (JSON.stringify(before?.[key] ?? null) !== JSON.stringify(value ?? null)) {
        base[key] = copy(before?.[key]); patch[key] = copy(value);
      }
    }
    return { base, patch };
  }
  const { base, patch } = changes(snapshot, proposed);
  return Object.keys(patch).length ? { schemaVersion: 2, base, patch } : null;
}

export function createSettingsClient(request = requestJson) {
  let tail = Promise.resolve();
  const enqueue = operation => {
    const job = tail.then(operation, operation);
    tail = job.catch(() => {});
    return job;
  };
  const load = options => request('/api/sound-settings', options);
  const commit = (command, options) => request('/api/sound-settings', { ...options, method: 'PUT', body: command });
  return Object.freeze({
    load,
    save(command, options) {
      const intent = command && structuredClone(command);
      return enqueue(() => intent ? commit(intent, options) : load(options));
    },
    update(proposed, options) {
      // Capture user intent now, not when a preceding network request completes.
      const intent = structuredClone(proposed);
      return enqueue(async () => {
        const snapshot = await load(options);
        const command = settingsCommand(snapshot, intent);
        return command ? commit(command, options) : snapshot;
      });
    },
  });
}

export const settingsClient = createSettingsClient();
