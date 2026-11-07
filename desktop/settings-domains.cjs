const path = require('node:path');

// Domain adapters for the one SettingsStore. size/usage come from the sound
// service, ui from UiStateStore, displayMode mirrors the dashboard route's file.
function createSettingsDomains({ dispatcher, values, uiStore, read, save, dataDir, createSoundSettingsDomains }) {
  return {
    ...createSoundSettingsDomains(dispatcher.soundSettings),
    ui: {
      // 值在磁盘上是字符串，对象字段是 JSON 文本。这里解析出来给界面用，
      // 键名保持真实的 dshw-* ，便于回读和文档核对。
      read: () => {
        const parsed = {};
        for (const [key, value] of Object.entries({ ...values() })) {
          try { parsed[key] = JSON.parse(value); } catch { parsed[key] = value; }
        }
        return parsed;
      },
      write: async (_next, { changes }) => {
        const encoded = {};
        for (const [key, value] of Object.entries(changes)) {
          if (typeof value === 'string') { encoded[key] = value; continue; }
          if (value === null) { encoded[key] = null; continue; }
          encoded[key] = JSON.stringify(value);
        }
        uiStore.setKeys(encoded);
        await uiStore.flush();
      },
    },
    displayMode: {
      read: () => ({ mode: read(path.join(dataDir, 'display-mode.json')).mode === 'api' ? 'api' : 'subscription' }),
      write: values2 => {
        if (!['api', 'subscription'].includes(values2.mode)) throw new Error('请选择 API 或会员订阅额度模式');
        // 与 /api/display-mode 路由写同一份文件、同一格式；不经路由是为了
        // 保持 SettingsStore 的同步写入契约。
        save(path.join(dataDir, 'display-mode.json'), { version: 1, mode: values2.mode });
        // dshw-account-view 是渲染器侧的缓存，两处保持一致。
        uiStore.setKeys({ 'dshw-account-view': values2.mode });
      },
    },
    api: {
      read: () => dispatcher.whale.config.settingsInfo().settings,
      write: (_next, { changes }) => dispatcher.whale.config.save(changes),
    },
    bubble: { read: () => ({}), write: () => { throw new Error('请在气泡编辑器中保存'); } },
    media: { read: () => ({}), write: () => { throw new Error('请在素材编辑器中保存'); } },
    apiModels: { read: () => ({}), write: () => { throw new Error('请在 API 编辑器中保存'); } },
  };
}

module.exports = { createSettingsDomains };
