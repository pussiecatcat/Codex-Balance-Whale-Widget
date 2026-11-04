// 大肥鱼设置的唯一写入者。
//
// 挂件窗口和设置窗口都只能通过这里改配置，避免两边各自提交整份快照互相覆盖。
// 存储后端通过构造参数注入，所以本文件不碰文件系统，可以直接做单元测试。
//
// 每个域适配器的形状：
//   {
//     name: 'size',
//     read():  object          读出该域的完整当前值
//     write(values): void      写入（values 已由本模块按「只改真实改动的键」合并好）
//     // 可选：只有 writeSubset(values) 能表达「按键局部更新」时提供它，
//     // 否则一律走 read→merge→write。
//   }
'use strict';

const clone = value => (value === undefined ? undefined : JSON.parse(JSON.stringify(value)));

/** 按结构深比较两个值是否相同。配置值都是 JSON 可序列化的。 */
function sameValue(a, b) {
  if (a === b) return true;
  if (a === null || b === null || typeof a !== 'object' || typeof b !== 'object') {
    return Number.isNaN(a) && Number.isNaN(b);
  }
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  const aKeys = Object.keys(a);
  const bKeys = Object.keys(b);
  if (aKeys.length !== bKeys.length) return false;
  return aKeys.every(key => Object.hasOwn(b, key) && sameValue(a[key], b[key]));
}

class SettingsStore {
  /**
   * @param {object} options
   * @param {Record<string, object>} options.domains 域适配器
   * @param {(change: {domain: string, values: object, keys: string[]}) => void} [options.onChange]
   */
  constructor({ domains, onChange } = {}) {
    this.domains = domains || {};
    this.onChange = typeof onChange === 'function' ? onChange : () => {};
    this.writes = Promise.resolve();
  }

  has(domain) { return Object.hasOwn(this.domains, domain); }

  /** 读出一个或多个域的当前值。 */
  async read(domains) {
    await this.writes;
    const names = Array.isArray(domains) ? domains : [domains];
    const values = {};
    const missing = [];
    for (const name of names) {
      if (!this.has(name)) { missing.push(name); continue; }
      values[name] = clone(await this.domains[name].read());
    }
    if (missing.length) throw new Error('未知的设置域：' + missing.join('、'));
    return values;
  }

  /**
   * 按键保存。
   *
   * @param {object} input
   * @param {string} input.domain          目标域
   * @param {object} input.changes         {key: value}，只包含用户真正改动的键
   * @param {object} [input.base]          打开页面时看到的值，用来发现别人改过的键
   * @param {boolean} [input.force]        true 表示已知冲突仍要覆盖（用户选择「保留我的」）
   * @param {string[]} [input.keep]        冲突时选择「用对方的」的键，其余键仍然写入
   * @returns {Promise<{ok: boolean, applied?: object, conflicts?: object[]}>}
   *          主线上的域写入（音效事务）是异步队列，所以保存整体是异步的；
   *          成功确认后才回报 ok，失败时错误消息原样带出。
   */
  save(input) {
    const job = this.writes.then(() => this.saveOnce(input));
    this.writes = job.catch(() => {});
    return job;
  }

  async saveOnce({ domain, changes, base, force = false, keep = [] } = {}) {
    if (!this.has(domain)) return { ok: false, error: '未知的设置域：' + domain };
    if (!changes || typeof changes !== 'object' || Array.isArray(changes)) {
      return { ok: false, error: '没有要保存的修改' };
    }
    const keys = Object.keys(changes);
    if (!keys.length) return { ok: false, error: '没有要保存的修改' };

    const adapter = this.domains[domain];
    const current = clone(await adapter.read());

    // 冲突判定：只对「用户改了的键」和「开页后被别人改了的键」取交集。
    // 别人改了同一页的其它键不算冲突，那些键的当前值会原样保留。
    // keep 是用户在冲突对话框里选择「用对方的」的键，这些键不再算冲突。
    const keepSet = new Set(Array.isArray(keep) ? keep : []);
    const conflicts = [];
    if (base && !force) {
      for (const key of keys) {
        if (keepSet.has(key)) continue;
        if (!Object.hasOwn(base, key)) continue;
        if (!sameValue(current[key], base[key])) {
          conflicts.push({ key, yours: changes[key], theirs: current[key], openedAs: base[key] });
        }
      }
    }
    if (conflicts.length) {
      return {
        ok: false,
        error: '这些设置在你编辑期间被改过',
        conflicts,
      };
    }

    // 只覆盖真实改动的键。base 中存在但 changes 没有的键保持 current 的值。
    const next = { ...current };
    const applied = {};
    for (const key of keys) {
      if (keepSet.has(key)) continue;
      next[key] = changes[key];
      applied[key] = changes[key];
    }

    await adapter.write(next, { changes: applied, base: current });
    const saved = clone(await adapter.read());
    this.onChange({ domain, values: saved, keys: Object.keys(applied) });
    return { ok: true, applied, values: saved };
  }

  /**
   * 预览：只读地算出「保存后会变成什么」，不落盘。用于保存前确认和帮助文案。
   * 与 save 共用同一套合并规则，保证预览和真实结果一致。
   */
  async preview({ domain, changes } = {}) {
    await this.writes;
    if (!this.has(domain)) return { ok: false, error: '未知的设置域：' + domain };
    const current = clone(await this.domains[domain].read());
    const merged = { ...current };
    const applied = {};
    for (const [key, value] of Object.entries(changes || {})) {
      merged[key] = value;
      applied[key] = value;
    }
    const changedKeys = Object.keys(applied).filter(key => !sameValue(merged[key], current[key]));
    return { ok: true, values: merged, changedKeys };
  }
}

// Both domains use the service's existing transaction and revision checks.
// Apply only changed keys to a fresh snapshot, never a pre-await full document.
function createSoundSettingsDomains(service) {
  const view = (snapshot, domain) => domain === 'completion'
    ? { turnCostOn: snapshot.size.turnCostOn, on: snapshot.usage.taskEnd.on } : snapshot[domain];
  return Object.fromEntries(['size', 'usage', 'completion'].map(domain => [domain, {
    read: async () => view(await service.load(), domain),
    write: async (_next, { changes, base }) => {
      const current = await service.load();
      for (const key of Object.keys(changes)) {
        if (!sameValue(view(current, domain)[key], base[key])) throw new Error('设置已改变，请重新加载后重试');
      }
      const command = { schemaVersion: current.schemaVersion, revision: current.revision,
        size: current.size, usage: current.usage,
      };
      if (domain === 'completion') {
        command.size = { ...current.size, turnCostOn: changes.turnCostOn ?? current.size.turnCostOn };
        command.usage = { ...current.usage, taskEnd: { ...current.usage.taskEnd, on: changes.on ?? current.usage.taskEnd.on } };
      } else command[domain] = { ...current[domain], ...changes };
      await service.save(command);
    },
  }]));
}

module.exports = { SettingsStore, sameValue, createSoundSettingsDomains };
