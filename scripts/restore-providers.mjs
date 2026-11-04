import path from 'node:path';
import { DATA_HOME } from '../runtime/paths.mjs';
import { ProviderStore } from '../runtime/provider-store.mjs';

const dataDir = process.env.WHALE_HOME ? path.resolve(process.env.WHALE_HOME) : DATA_HOME;
const store = new ProviderStore({ dataDir });
try {
  if (!store.restoreBackup()) {
    console.error('没有可用的服务商配置备份：' + path.join(dataDir, 'providers.json.bak'));
    process.exitCode = 1;
  } else {
    console.log('已从备份恢复服务商配置：' + path.join(dataDir, 'providers.json'));
  }
} catch (error) {
  console.error('恢复服务商配置失败：' + (error?.message || error));
  process.exitCode = 1;
}
