import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { parse } from '../vendor/smol-toml/dist/index.js';
import { CODEX_HOME, DATA_HOME, readJson, writeJson } from './paths.mjs';
import { domainError } from '../lib/errors.mjs';

export const DEFAULT_CONFIG = {
  provider: 'auto', baseUrl: '', keyEnv: '', profile: '', projectDir: '', currency: 'USD',
  balancePath: '', balanceField: 'data.balance', usedField: '', balanceScale: 1,
  billingUsageDivisor: 100, quotaPerUnit: 500000,
  dashboardUrl: '', monitorSessions: true, refreshSeconds: 60,
  models: {},
};

// These values remain local to the service. The settings editor receives only
// presence flags and submits a value only when the user explicitly changes it.
export const PRIVATE_SETTING_FIELDS = Object.freeze(['baseUrl', 'keyEnv', 'profile', 'projectDir', 'dashboardUrl', 'balancePath', 'balanceField', 'usedField', 'models']);

export function cleanUrl(value, { allowEmpty = false } = {}) {
  if (!value && allowEmpty) return '';
  let u;
  try { u = new URL(value); } catch { throw domainError('API 地址无效'); }
  if (u.username || u.password || u.search || u.hash) throw domainError('API 地址不能包含密钥、查询参数或片段');
  const host = u.hostname.replace(/^\[|\]$/g, '').toLowerCase();
  const local = ['localhost', '::1'].includes(host) || /^127\./.test(host) || /^10\./.test(host) || /^192\.168\./.test(host) || /^172\.(?:1[6-9]|2\d|3[01])\./.test(host) || /^f[cd][0-9a-f]{2}:/i.test(host);
  if (host === 'metadata.google.internal' || host === 'metadata.goog' || host === '100.100.100.200' ||
      /^169\.254\./.test(host) || /^0\./.test(host) || /^fe[89ab][0-9a-f]:/i.test(host) || /^::ffff:(?:a9fe:|6464:64c8|0:)/i.test(host)) {
    throw domainError('API 地址不能指向云元数据或链路本地服务');
  }
  if (u.protocol !== 'https:' && !(local && u.protocol === 'http:')) throw domainError('API 地址须使用 HTTPS（本机服务除外）');
  return u.toString().replace(/\/$/, '');
}

function numberIn(value, min, max, label) {
  const n = Number(value);
  if (!Number.isFinite(n) || n < min || n > max) throw domainError(label + '超出有效范围');
  return n;
}

function fileStamp(file) {
  try { return fs.statSync(file).mtimeMs; } catch { return 0; }
}

export function validateConfig(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw domainError('设置必须是 JSON 对象');
  const c = structuredClone(DEFAULT_CONFIG);
  for (const k of Object.keys(c)) if (Object.hasOwn(input, k)) c[k] = input[k];
  if (!['auto', 'billing', 'newapi', 'custom-json', 'deepseek'].includes(c.provider)) throw domainError('未知余额接口类型');
  c.baseUrl = cleanUrl(String(c.baseUrl || ''), { allowEmpty: true });
  c.dashboardUrl = cleanUrl(String(c.dashboardUrl || ''), { allowEmpty: true });
  c.keyEnv = String(c.keyEnv || '').trim();
  if (c.keyEnv && !/^[A-Za-z_][A-Za-z0-9_]*$/.test(c.keyEnv)) throw domainError('密钥环境变量名称无效');
  c.profile = String(c.profile || '').slice(0, 128);
  c.projectDir = String(c.projectDir || '');
  c.currency = String(c.currency || 'USD').toUpperCase();
  if (!/^[A-Z]{3}$/.test(c.currency)) throw domainError('币种须使用 USD、CNY 等三位代码');
  c.refreshSeconds = numberIn(c.refreshSeconds, 15, 3600, '刷新间隔');
  c.monitorSessions = c.monitorSessions === true;
  c.billingUsageDivisor = numberIn(c.billingUsageDivisor, 0.000001, 1e12, '用量单位换算');
  c.quotaPerUnit = numberIn(c.quotaPerUnit, 0.000001, 1e12, '额度单位换算');
  c.balanceScale = numberIn(c.balanceScale, 0.000000001, 1e12, '余额系数');
  c.balancePath = String(c.balancePath || '');
  if (c.balancePath && (!c.balancePath.startsWith('/') || c.balancePath.startsWith('//') || /[\\#\r\n]/.test(c.balancePath))) throw domainError('余额路径须为当前 API 域名下的绝对路径');
  for (const k of ['balanceField', 'usedField']) {
    c[k] = String(c[k] || '');
    if (c[k] && !/^[A-Za-z0-9_.]+$/.test(c[k])) throw domainError('字段路径仅支持字母、数字、下划线和点');
    if (c[k].split('.').some(x => ['__proto__', 'constructor', 'prototype'].includes(x))) throw domainError('字段路径无效');
  }
  if (!c.models || typeof c.models !== 'object' || Array.isArray(c.models)) throw domainError('模型价格须为 JSON 对象');
  const models = {};
  for (const [model, prices] of Object.entries(c.models)) {
    if (!model || model.length > 150 || ['__proto__', 'constructor', 'prototype'].includes(model)) throw domainError('模型名称无效');
    if (!prices || typeof prices !== 'object') throw domainError('模型价格无效');
    models[model] = {};
    for (const field of ['input', 'cachedInput', 'output']) models[model][field] = numberIn(prices[field], 0, 1e9, '模型价格');
    if (prices.cacheWrite !== undefined) models[model].cacheWrite = numberIn(prices.cacheWrite, 0, 1e9, '缓存写入价格');
  }
  c.models = models;
  return c;
}

export class ConfigStore {
  constructor({ dataDir = DATA_HOME, codexHome = CODEX_HOME, env = process.env } = {}) {
    this.dataDir = dataDir; this.codexHome = codexHome; this.env = env;
    this.file = path.join(dataDir, 'api-settings.json');
    // resolve() reads four files, parses TOML and hashes the credential. It runs
    // on the session monitor's tick and on every usage request, so its result is
    // memoised until one of those inputs actually changes. Writes through save()
    // invalidate explicitly; edits made outside this process are caught by the
    // mtime fingerprint.
    this.settingCache = null;
    this.resolveCache = null;
    this.usedEnvNames = [];
  }

  invalidate() { this.settingCache = null; this.resolveCache = null; }

  load() {
    const stamp = fileStamp(this.file);
    if (this.settingCache && this.settingCache.stamp === stamp) return this.settingCache.value;
    const value = validateConfig(readJson(this.file, DEFAULT_CONFIG));
    this.settingCache = { stamp, value };
    return value;
  }

  save(patch) {
    if (!patch || typeof patch !== 'object' || Array.isArray(patch)) throw domainError('设置必须是 JSON 对象');
    if (Object.keys(patch).some(k => /secret|token|api.?key|password/i.test(k) && k !== 'keyEnv')) throw domainError('请填写密钥环境变量名；插件设置中不保存密钥');
    const current = this.load(), input = { ...current, ...patch };
    if (Object.hasOwn(patch, 'pricingUpdate')) {
      const update = patch.pricingUpdate;
      if (!update || typeof update !== 'object' || Array.isArray(update) || typeof update.model !== 'string' || !update.model.trim() || update.model.length > 150 || ['__proto__', 'prototype', 'constructor'].includes(update.model)) throw domainError('模型名称无效');
      input.models = { ...current.models };
      if (update.prices === null) delete input.models[update.model];
      else input.models[update.model] = update.prices;
    }
    const c = validateConfig(input);
    writeJson(this.file, c);
    this.invalidate();
    return c;
  }

  settingsInfo() {
    const current = this.load(), settings = {}, configured = {};
    for (const key of Object.keys(DEFAULT_CONFIG)) {
      if (PRIVATE_SETTING_FIELDS.includes(key)) configured[key] = key === 'models' ? Object.keys(current.models).length > 0 : !!current[key];
      else settings[key] = current[key];
    }
    return { settings, configured };
  }

  resolve() {
    const key = this.cacheKey();
    if (this.resolveCache && this.resolveCache.key === key) return this.resolveCache.value;
    const value = this.resolveUncached();
    this.resolveCache = { key, value };
    return value;
  }

  // Every input resolve() reads, plus the environment variables it consulted on
  // the previous run. A changed config.toml alters the mtime even when it only
  // introduces a new env_key, so the memorised name list cannot go stale.
  cacheKey() {
    const parts = [fileStamp(this.file), fileStamp(path.join(this.codexHome, 'config.toml')), fileStamp(path.join(this.codexHome, 'auth.json'))];
    let projectDir = '';
    try { projectDir = this.load().projectDir; } catch {}
    if (projectDir) parts.push(fileStamp(path.join(path.resolve(projectDir), '.codex', 'config.toml')));
    for (const name of ['CODEX_PROFILE', 'OPENAI_BASE_URL', 'OPENAI_API_KEY']) parts.push(name, this.env[name] ?? '');
    for (const name of this.usedEnvNames) parts.push(name, this.env[name] ?? '');
    return parts.join('\u0000');
  }

  resolveUncached() {
    const setting = this.load();
    const seen = [];
    const envOf = name => { if (name) seen.push(name); return name ? this.env[name] : undefined; };
    const file = path.join(this.codexHome, 'config.toml');
    let config = {};
    if (fs.existsSync(file)) {
      try { config = parse(fs.readFileSync(file, 'utf8')); }
      catch { throw domainError('Codex config.toml 无法解析，请检查配置文件'); }
    }
    // A project file may come from a downloaded repository. Keep the trusted
    // user's endpoint before overlaying it; project values cannot authorize a
    // different destination to receive the user's global/environment key.
    const trustedProfileName = setting.profile || this.env.CODEX_PROFILE || config.profile || '';
    const trustedEffective = { ...config, ...(trustedProfileName ? config.profiles?.[trustedProfileName] : {}) };
    const trustedProvider = trustedEffective.model_providers?.[trustedEffective.model_provider || 'openai'] || {};
    const trustedOrigin = new URL(cleanUrl(trustedProvider.base_url || this.env.OPENAI_BASE_URL || 'https://api.openai.com/v1')).origin;
    let projectLoaded = false;
    if (setting.projectDir) {
      const projectFile = path.join(path.resolve(setting.projectDir), '.codex', 'config.toml');
      if (fs.existsSync(projectFile)) {
        let local;
        try { local = parse(fs.readFileSync(projectFile, 'utf8')); } catch { throw domainError('项目 .codex/config.toml 无法解析'); }
        config = { ...config, ...local, model_providers: { ...config.model_providers, ...local.model_providers }, profiles: { ...config.profiles, ...local.profiles } };
        projectLoaded = true;
      }
    }
    const profileName = setting.profile || this.env.CODEX_PROFILE || config.profile || '';
    if (profileName && !config.profiles?.[profileName]) throw domainError('找不到所选 Codex profile');
    const effective = { ...config, ...(profileName ? config.profiles[profileName] : {}) };
    const id = effective.model_provider || 'openai';
    const provider = effective.model_providers?.[id] || {};
    const originalBase = cleanUrl(provider.base_url || this.env.OPENAI_BASE_URL || 'https://api.openai.com/v1');
    const baseUrl = cleanUrl(setting.baseUrl || originalBase);
    if (!setting.keyEnv && projectLoaded && new URL(originalBase).origin !== trustedOrigin) throw domainError('项目配置更换 API 域名时，请在挂件设置中明确指定该服务专用的密钥环境变量；不会转发全局密钥');
    if (!setting.keyEnv && new URL(baseUrl).origin !== new URL(originalBase).origin) throw domainError('更换 API 域名时请指定该服务自己的密钥环境变量，不能复用原服务密钥');
    let key = '', keySource = 'none';
    const envName = setting.keyEnv || provider.env_key || '';
    const configuredKey = envOf(envName);
    if (envName && configuredKey) { key = configuredKey; keySource = 'environment'; }
    else if (!setting.keyEnv && provider.experimental_bearer_token) { key = provider.experimental_bearer_token; keySource = 'codex-provider'; }
    else if (!setting.keyEnv && !provider.env_key) {
      if (this.env.OPENAI_API_KEY) { key = this.env.OPENAI_API_KEY; keySource = 'environment'; }
      else {
        const auth = readJson(path.join(this.codexHome, 'auth.json'), {});
        if (typeof auth.OPENAI_API_KEY === 'string') { key = auth.OPENAI_API_KEY; keySource = 'codex-auth'; }
      }
    }
    key = String(key || '').trim().replace(/^Bearer\s+/i, '');
    if (/[\r\n]/.test(key)) throw domainError('API 密钥格式无效');
    const accountId = crypto.createHash('sha256').update(baseUrl + '\0' + key).digest('hex').slice(0, 24);
    const host = new URL(baseUrl).hostname;
    const providerName = '当前 API';
    const dashboardUrl = setting.dashboardUrl || (host === 'api.openai.com' ? 'https://platform.openai.com/settings/organization/billing/overview' : new URL(baseUrl).origin);
    // Remember which environment names this resolution consulted so the next
    // cacheKey() can tell whether any of their values changed.
    this.usedEnvNames = seen;
    return { setting, id, model: effective.model || '', profileName, providerName, baseUrl, key, keySource, accountId, dashboardUrl };
  }
  publicInfo() {
    const c = this.resolve();
    return { providerName: '当前 API', hasKey: !!c.key, ...this.settingsInfo() };
  }
}
