'use strict';

const { createHash } = require('node:crypto');

const PHASE_ONE_IDS = new Set([
  'size.scale', 'size.sound', 'size.vol', 'size.soundSet', 'size.bubbleOn',
  'size.turnCostCloseMs', 'size.scrollGapOn', 'size.scrollGapPx', 'size.menuBtnHide',
  'ui.accountView', 'ui.role', 'ui.displayCurrency', 'ui.bubbleShape', 'ui.feel',
  'ui.feedbackEvent', 'ui.pos', 'ui.snap',
  'usage.taskEndOn', 'usage.taskEndSel', 'usage.taskEndVol', 'usage.alertOn',
  'usage.alertBelow', 'usage.budgetOn', 'usage.budgetAmount', 'usage.alertMsg',
  'usage.alertAutoClose', 'usage.alertTtlSec', 'usage.reminderModules',
  'usage.alertModules', 'usage.budgetModules', 'usage.events.question',
  'usage.events.approval', 'usage.waitCharClose', 'bubble.sequences', 'bubble.lib',
]);

const clone = value => value === undefined ? undefined : JSON.parse(JSON.stringify(value));
const plain = value => !!value && typeof value === 'object' && !Array.isArray(value);
const digest = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const fail = (code, message, details) => ({ ok: false, code, error: message, ...(details ? { details } : {}) });

function createAgentSettings({ catalog, settingsStore, dispatcher, resetPosition = async () => false, changeBus = null }) {
  const byId = catalog?.byId instanceof Map
    ? Object.fromEntries(catalog.byId.entries())
    : catalog?.byId || Object.fromEntries((catalog?.fields || []).map(field => [field.id, field]));

  function fieldFor(id) {
    if (typeof id !== 'string' || !PHASE_ONE_IDS.has(id) || !byId[id]) {
      throw Object.assign(new Error('该设置目前不支持 Agent 修改'), { code: 'UNSUPPORTED_SETTING' });
    }
    return byId[id];
  }

  function domainFor(id) {
    if (id.startsWith('size.')) return 'size';
    if (id === 'ui.accountView') return 'displayMode';
    if (id.startsWith('ui.')) return 'ui';
    if (id === 'usage.taskEndOn') return 'completion';
    if (id.startsWith('usage.')) return 'usage';
    if (id.startsWith('bubble.')) return 'bubble';
    return null;
  }

  async function bubbleRequest(method, body) {
    const result = await dispatcher.dispatch('/dsh-whale/bubble.json', {
      method,
      body: body === undefined ? null : Buffer.from(JSON.stringify(body)),
      headers: { 'content-type': 'application/json' },
    });
    let payload;
    try { payload = JSON.parse(result.body.toString('utf8')); } catch { throw new Error('气泡设置响应无效'); }
    if (result.status >= 400 || payload?.ok === false) {
      throw Object.assign(new Error(payload?.error || '气泡设置操作失败'), { code: payload?.code || 'BUBBLE_SETTINGS_FAILED', status: result.status });
    }
    return payload;
  }

  async function readContext(id, mode) {
    const field = fieldFor(id);
    const domain = domainFor(id);
    if (domain === 'bubble') {
      if (id === 'bubble.sequences' && !['api', 'subscription'].includes(mode)) {
        throw Object.assign(new Error('读取气泡序列时需要指定 api 或 subscription 模式'), { code: 'INVALID_MODE' });
      }
      const payload = await bubbleRequest('GET');
      const config = payload.config || {};
      const value = id === 'bubble.lib'
        ? clone(config.lib || [])
        : mode === 'subscription'
          ? clone(config.subscriptionItems || [])
          : clone(config.items || []);
      return { field, domain, value, revision: payload.revision, config };
    }
    const result = await settingsStore.read(domain);
    if (!result || !Object.hasOwn(result, domain)) throw new Error('设置尚未就绪');
    const state = result[domain];
    return { field, domain, state, value: readValue(id, state), revision: digest(readValue(id, state)) };
  }

  function feedbackRoot(state) {
    return clone(state['dshw-v3-feedback'] || { feel: 'balanced', events: {} });
  }

  function readValue(id, state) {
    if (id.startsWith('size.')) {
      const field = byId[id];
      const value = state[field.key];
      if (id === 'size.scale') return Math.round((Number(value) - (field.offset || 0)) / (field.scale || 1));
      if (id === 'size.turnCostCloseMs') return Number(value) / (field.scale || 1);
      return clone(value);
    }
    if (id === 'ui.accountView') return clone(state.mode);
    if (id === 'ui.role') return clone(state['dshw-role'] || 'default');
    if (id === 'ui.displayCurrency') return clone(state['dshw-display-currency'] || 'USD');
    if (id === 'ui.bubbleShape') return clone(state['dshw-bubble-shape'] || 'ellipse');
    if (id === 'ui.feel') return feedbackRoot(state).feel || 'balanced';
    if (id === 'ui.feedbackEvent') return feedbackRoot(state);
    if (id === 'ui.pos') return clone(state['dshw-pos'] || 'bottom-right');
    if (id === 'ui.snap') return clone(state['dshw-snap'] || byId[id].defaultValue);
    if (id === 'usage.taskEndOn') return state;
    if (id === 'usage.taskEndSel') return clone(state.taskEnd?.sel);
    if (id === 'usage.taskEndVol') return { vol: state.taskEnd?.vol ?? 1, volSet: state.taskEnd?.volSet === true };
    if (id === 'usage.alertOn') return state.alert?.on !== false;
    if (id === 'usage.alertBelow') return clone(state.alert?.below ?? byId[id].defaultValue);
    if (id === 'usage.budgetOn') return state.budget?.on !== false;
    if (id === 'usage.budgetAmount') return clone(state.budget?.amount ?? byId[id].defaultValue);
    if (id === 'usage.alertMsg') return { alert: state.alert?.msg || '', budget: state.budget?.msg || '' };
    if (id === 'usage.alertAutoClose') return { alert: state.alert?.autoClose !== false, budget: state.budget?.autoClose !== false };
    if (id === 'usage.alertTtlSec') return { alert: state.alert?.ttlSec ?? 0, budget: state.budget?.ttlSec ?? 0 };
    if (id === 'usage.reminderModules') return {
      lines: clone(state.turnCost?.lines || []), bubbleOn: state.events?.turnCost?.bubbleOn !== false,
    };
    if (id === 'usage.alertModules') return { lines: clone(state.alert?.lines || []), below: clone(state.alert?.below ?? 0) };
    if (id === 'usage.budgetModules') return { lines: clone(state.budget?.lines || []), amount: clone(state.budget?.amount ?? 0) };
    if (id === 'usage.events.question' || id === 'usage.events.approval') return clone(state.events?.[id.endsWith('question') ? 'question' : 'approval'] || {});
    if (id === 'usage.waitCharClose') return state.wait?.charClose === true;
    return undefined;
  }

  function validateJson(value, depth = 0) {
    if (depth > 12) return false;
    if (value === null || typeof value === 'string' || typeof value === 'boolean') return typeof value !== 'string' || value.length <= 4096;
    if (typeof value === 'number') return Number.isFinite(value);
    if (Array.isArray(value)) return value.length <= 200 && value.every(item => validateJson(item, depth + 1));
    if (!plain(value) || Object.keys(value).length > 100) return false;
    return Object.entries(value).every(([key, item]) => !['__proto__', 'prototype', 'constructor'].includes(key) && validateJson(item, depth + 1));
  }

  function validateNumber(field, value, id) {
    if (typeof value !== 'number' || !Number.isFinite(value)) return '请输入有效数字';
    if (field.min != null && value < field.min) return `数值不能小于 ${field.min}`;
    if (field.max != null && value > field.max) return `数值不能大于 ${field.max}`;
    if (typeof field.step === 'number' && Math.abs((value - (field.min || 0)) / field.step - Math.round((value - (field.min || 0)) / field.step)) > 1e-7) return `数值需按 ${field.step} 的步长填写`;
    if (id === 'size.scale' && !Number.isInteger(value)) return '大小需填写 1 到 20 的整数档位';
    if (id === 'size.turnCostCloseMs' && !Number.isInteger(value)) return '停留时间需填写整数秒';
    return null;
  }

  function validateValue(id, value, context) {
    const field = context.field;
    if (!validateJson(value)) return '设置内容过大或包含不支持的数据';
    if (['range', 'number'].includes(field.type)) return validateNumber(field, value, id);
    if (field.type === 'boolean') return typeof value === 'boolean' ? null : '该设置需要 true 或 false';
    if (field.type === 'select') {
      const values = (field.options || []).map(option => option.value);
      if (id === 'size.soundSet' && typeof value === 'string' && /^[a-zA-Z0-9_-]{1,80}$/.test(value)) return null;
      if (id === 'usage.taskEndSel' && typeof value === 'string' && /^(?:preset:[a-zA-Z0-9_-]{1,64}:(?:press|release)|(?:grp|frag):[a-zA-Z0-9_-]{1,64})$/.test(value)) return null;
      return values.includes(value) ? null : `可选值为：${values.join('、')}`;
    }
    if (id === 'ui.role') return typeof value === 'string' && /^[a-zA-Z0-9_-]{1,80}$/.test(value) ? null : '请填写已导入角色的素材 ID';
    if (id === 'usage.taskEndOn') return ['off', 'bubble', 'both'].includes(value) ? null : '完成提醒可选 off、bubble 或 both';
    if (id === 'usage.taskEndVol') return plain(value) && Object.keys(value).every(key => ['vol', 'volSet'].includes(key)) && typeof value.vol === 'number' && value.vol >= 0 && value.vol <= 1 && (value.volSet === undefined || typeof value.volSet === 'boolean') ? null : '音量需要在 0 到 1 之间，volSet 需为 true 或 false';
    if (id === 'usage.alertMsg') return plain(value) && Object.keys(value).every(key => ['alert', 'budget'].includes(key)) && ['alert', 'budget'].some(key => value[key] !== undefined) && ['alert', 'budget'].every(key => value[key] === undefined || typeof value[key] === 'string' && value[key].length <= 240) ? null : '提醒文字最多 240 个字符';
    if (id === 'usage.alertAutoClose') return plain(value) && Object.keys(value).every(key => ['alert', 'budget'].includes(key)) && ['alert', 'budget'].some(key => value[key] !== undefined) && ['alert', 'budget'].every(key => value[key] === undefined || typeof value[key] === 'boolean') ? null : '自动关闭需要 true 或 false';
    if (id === 'usage.alertTtlSec') return plain(value) && Object.keys(value).every(key => ['alert', 'budget'].includes(key)) && ['alert', 'budget'].some(key => value[key] !== undefined) && ['alert', 'budget'].every(key => value[key] === undefined || Number.isInteger(value[key]) && value[key] >= 0 && value[key] <= 3600) ? null : '停留时间需为 0 到 3600 秒的整数';
    if (id === 'usage.events.question' || id === 'usage.events.approval') return validateEvent(value);
    if (id === 'ui.feel') return ['balanced', 'crisp', 'soft'].includes(value) ? null : '按压手感可选 balanced、crisp 或 soft';
    if (id === 'ui.feedbackEvent') return validateFeedback(value);
    if (id === 'ui.snap') return validateSnap(value);
    if (id === 'ui.pos') return '位置通过“移回右下角”或拖动调整，不能直接填写坐标';
    if (id === 'bubble.sequences') return validateBubbleSequence(value);
    if (id === 'bubble.lib') return validateBubbleLibrary(value);
    if (['usage.reminderModules', 'usage.alertModules', 'usage.budgetModules'].includes(id)) return validateReminderGroup(id, value);
    return null;
  }

  function validateEvent(value) {
    if (!plain(value)) return '提醒设置需要一个对象';
    if (!Object.keys(value).every(key => ['on', 'bubbleOn', 'soundOn', 'sel', 'vol', 'lines'].includes(key))) return '提醒设置包含不支持的字段';
    for (const key of ['on', 'bubbleOn', 'soundOn']) if (value[key] !== undefined && typeof value[key] !== 'boolean') return `${key} 需要 true 或 false`;
    if (value.lines !== undefined && (!Array.isArray(value.lines) || value.lines.length > 40 || !value.lines.every(line => plain(line) && typeof (line.text ?? line.t) === 'string'))) return '提醒内容需要由最多 40 行文字模块组成';
    if (value.vol !== undefined && (typeof value.vol !== 'number' || value.vol < 0 || value.vol > 1)) return '音量需要在 0 到 1 之间';
    return null;
  }

  function validateFeedback(value) {
    if (!plain(value) || !plain(value.events)) return '音效设置需要 feel 和 events';
    if (!Object.keys(value).every(key => ['feel', 'events'].includes(key))) return '音效设置包含不支持的字段';
    if (value.feel !== undefined && !['balanced', 'crisp', 'soft'].includes(value.feel)) return '按压手感可选 balanced、crisp 或 soft';
    const allowed = new Set(['original', 'pearl', 'bubble', 'glass', 'silent']);
    for (const [event, item] of Object.entries(value.events)) {
      if (!['press', 'release', 'success', 'cancelled', 'failed'].includes(event) || !plain(item)) return '事件名称或设置格式无效';
      if (!Object.keys(item).every(key => ['preset', 'volume'].includes(key))) return '事件设置包含不支持的字段';
      if (item.preset !== undefined && (!allowed.has(item.preset) || (item.preset === 'original' && !['press', 'release', 'success'].includes(event)))) return '该事件的音色无效';
      if (item.volume !== undefined && (typeof item.volume !== 'number' || item.volume < 0 || item.volume > 1)) return '事件音量需要在 0 到 1 之间';
    }
    return null;
  }

  function validateSnap(value) {
    if (!plain(value) || !['ratio', 'px', 'off'].includes(value.mode)) return '贴边模式需为 ratio、px 或 off';
    for (const section of ['ratio', 'px']) {
      if (!plain(value[section])) return `缺少 ${section} 参数`;
      for (const key of ['L', 'T', 'R', 'B', 'F']) {
        const number = value[section][key];
        if (typeof number !== 'number' || !Number.isFinite(number)) return `${section}.${key} 需要是数字`;
        const upper = section === 'ratio' ? 100 : 100000;
        if (number < (key === 'F' && section === 'px' ? -1 : 0) || number > upper) return `${section}.${key} 超出范围`;
      }
    }
    return null;
  }

  function validateReminderGroup(id, value) {
    if (!plain(value)) return '提醒模块需要一个对象';
    const allowed = id === 'usage.reminderModules' ? ['lines', 'bubbleOn']
      : id === 'usage.alertModules' ? ['lines', 'below'] : ['lines', 'amount'];
    if (!Object.keys(value).every(key => allowed.includes(key))) return '提醒模块设置包含不支持的字段';
    if (value.lines !== undefined && (!Array.isArray(value.lines) || value.lines.length > 40 || !value.lines.every(line => plain(line) && typeof (line.text ?? line.t) === 'string'))) return '提醒内容需为最多 40 行文字模块';
    if (value.bubbleOn !== undefined && typeof value.bubbleOn !== 'boolean') return 'bubbleOn 需要 true 或 false';
    for (const key of ['below', 'amount']) if (value[key] !== undefined && (typeof value[key] !== 'number' || value[key] < 0)) return `${key} 需要为非负数字`;
    return null;
  }

  function validateBubbleSequence(value) {
    if (!plain(value) || !['api', 'subscription'].includes(value.mode) || !Array.isArray(value.items) || value.items.length > 100) return '气泡序列需要 mode 和最多 100 个 items';
    for (const item of value.items) {
      if (!plain(item) || !['normal', 'random', 'custom', 'choice'].includes(item.kind)) return '气泡序列包含不支持的气泡类型';
      if (item.modules !== undefined && (!Array.isArray(item.modules) || item.modules.length > 100 || !item.modules.every(module => plain(module) && typeof module.type === 'string'))) return '每个气泡的 modules 格式无效';
      if (item.kind === 'choice' && (!Array.isArray(item.options) || item.options.length < 2 || item.options.length > 2)) return '分支气泡需要两个 options';
    }
    return null;
  }

  function validateBubbleLibrary(value) {
    if (!Array.isArray(value) || value.length > 200) return '模块库需为最多 200 项的数组';
    const ids = new Set();
    for (const item of value) {
      if (!plain(item) || typeof item.id !== 'string' || !/^[a-zA-Z0-9_-]{1,80}$/.test(item.id) || ids.has(item.id) || !plain(item.module)) return '模块库条目需有不重复 ID 和 module';
      ids.add(item.id);
    }
    return null;
  }

  async function optionsFor(id) {
    if (id === 'ui.role') {
      const result = await dispatcher.dispatch('/dsh-whale/roles.json', { method: 'GET' });
      const body = JSON.parse(result.body.toString('utf8'));
      return (body.roles || []).map(role => ({ value: role.id, label: role.name || role.id }));
    }
    if (id === 'size.soundSet') {
      const result = await dispatcher.dispatch('/dsh-whale/audio.json', { method: 'GET' });
      const body = JSON.parse(result.body.toString('utf8'));
      return (body.groups || []).map(group => ({ value: group.id, label: group.name || group.id }));
    }
    if (id === 'usage.taskEndSel') {
      const result = await dispatcher.dispatch('/dsh-whale/audio.json', { method: 'GET' });
      const body = JSON.parse(result.body.toString('utf8'));
      return [
        ...(byId[id]?.options || []),
        ...(body.groups || []).map(group => ({ value: 'grp:' + group.id, label: group.name || group.id })),
        ...(body.fragments || []).filter(fragment => !fragment.preset).map(fragment => ({ value: 'frag:' + fragment.id, label: fragment.name || fragment.id })),
      ];
    }
    return byId[id]?.options || [];
  }

  async function validateDynamicChoice(id, value) {
    if (['ui.role', 'size.soundSet', 'usage.taskEndSel'].includes(id)) {
      const options = await optionsFor(id);
      return options.some(option => option.value === value) ? null : '请选择当前已安装的素材或音效';
    }
    if ((id === 'usage.events.question' || id === 'usage.events.approval') && value.sel !== undefined) {
      const options = await optionsFor('usage.taskEndSel');
      return options.some(option => option.value === value.sel) ? null : '请选择当前已安装的素材或音效';
    }
    return null;
  }

  function changesFor(id, value, state) {
    if (id.startsWith('size.')) {
      const field = byId[id];
      const stored = id === 'size.scale' ? value * (field.scale || 1) + (field.offset || 0)
        : id === 'size.turnCostCloseMs' ? value * (field.scale || 1) : value;
      return { [field.key]: stored };
    }
    if (id === 'ui.accountView') return { mode: value };
    if (id === 'ui.role') return { 'dshw-role': value };
    if (id === 'ui.displayCurrency') return { 'dshw-display-currency': value };
    if (id === 'ui.bubbleShape') return { 'dshw-bubble-shape': value };
    if (id === 'ui.pos') return {};
    if (id === 'ui.snap') return { 'dshw-snap': value };
    if (id === 'ui.feel') return { 'dshw-v3-feedback': { ...feedbackRoot(state), feel: value } };
    if (id === 'ui.feedbackEvent') {
      const current = feedbackRoot(state);
      const next = { ...current, ...value, events: { ...current.events, ...(value.events || {}) } };
      return { 'dshw-v3-feedback': next };
    }
    if (id === 'usage.taskEndOn') {
      const completion = value === 'off' ? { turnCostOn: false, on: false }
        : value === 'both' ? { turnCostOn: true, on: true } : { turnCostOn: true, on: false };
      return completion;
    }
    if (id === 'usage.taskEndSel') return { taskEnd: { ...state.taskEnd, sel: value } };
    if (id === 'usage.taskEndVol') return { taskEnd: { ...state.taskEnd, vol: value.vol, volSet: value.volSet !== false } };
    if (id === 'usage.alertOn') return { alert: { ...state.alert, on: value } };
    if (id === 'usage.alertBelow') return { alert: { ...state.alert, below: value } };
    if (id === 'usage.budgetOn') return { budget: { ...state.budget, on: value } };
    if (id === 'usage.budgetAmount') return { budget: { ...state.budget, amount: value } };
    if (id === 'usage.alertMsg') return {
      ...(value.alert !== undefined ? { alert: { ...state.alert, msg: value.alert } } : {}),
      ...(value.budget !== undefined ? { budget: { ...state.budget, msg: value.budget } } : {}),
    };
    if (id === 'usage.alertAutoClose') return {
      ...(value.alert !== undefined ? { alert: { ...state.alert, autoClose: value.alert } } : {}),
      ...(value.budget !== undefined ? { budget: { ...state.budget, autoClose: value.budget } } : {}),
    };
    if (id === 'usage.alertTtlSec') return {
      ...(value.alert !== undefined ? { alert: { ...state.alert, ttlSec: value.alert } } : {}),
      ...(value.budget !== undefined ? { budget: { ...state.budget, ttlSec: value.budget } } : {}),
    };
    if (id === 'usage.reminderModules') return {
      ...(value.lines !== undefined ? { turnCost: { ...state.turnCost, lines: value.lines } } : {}),
      ...(value.bubbleOn !== undefined ? { events: { ...state.events, turnCost: { ...state.events?.turnCost, bubbleOn: value.bubbleOn } } } : {}),
    };
    if (id === 'usage.alertModules') return { alert: { ...state.alert, ...value } };
    if (id === 'usage.budgetModules') return { budget: { ...state.budget, ...value } };
    if (id === 'usage.events.question' || id === 'usage.events.approval') {
      const event = id.endsWith('question') ? 'question' : 'approval';
      return { events: { ...state.events, [event]: { ...state.events?.[event], ...value } } };
    }
    if (id === 'usage.waitCharClose') return { wait: { ...state.wait, charClose: value } };
    return {};
  }

  function publicValue(id, context) {
    if (id === 'usage.taskEndOn') {
      const { on, turnCostOn } = context.value;
      return !turnCostOn ? 'off' : on ? 'both' : 'bubble';
    }
    return clone(context.value);
  }

  function catalogOutput() {
    return [...PHASE_ONE_IDS].map(id => {
      const field = byId[id];
      const { id: settingId, label, purpose, type, unit, min, max, step, options, subFields, dependsOn, hotReload, help } = field;
      const operations = id === 'ui.pos' ? ['get', 'reset'] : ['get', 'preview', 'apply', 'reset'];
      return { id: settingId, label, purpose, type, unit, min, max, step, options, subFields, dependsOn, hotReload, help, operations };
    });
  }

  async function catalogListing() {
    const settings = catalogOutput();
    for (const item of settings) {
      if (['ui.role', 'size.soundSet', 'usage.taskEndSel'].includes(item.id)) item.options = await optionsFor(item.id);
    }
    return { ok: true, version: catalog.version, settings, excluded: (catalog.fields || []).filter(field => !PHASE_ONE_IDS.has(field.id)).map(field => field.id) };
  }

  async function inspect(id, mode) {
    const context = await readContext(id, mode);
    const value = publicValue(id, context);
    return { context, value, revision: context.revision };
  }

  async function get(id, mode) {
    const { context, value, revision } = await inspect(id, mode);
    return { ok: true, settingId: id, label: context.field.label, value, revision, mode: id === 'bubble.sequences' ? mode : undefined };
  }

  async function preview(input) {
    const { settingId: id, value, mode, expectedRevision } = input;
    const { context, value: before, revision } = await inspect(id, mode);
    if (expectedRevision && expectedRevision !== revision) return fail('SETTINGS_CONFLICT', '设置在读取后已改变，请重新读取再修改');
    const validation = validateValue(id, value, context);
    if (validation) return fail('INVALID_VALUE', validation);
    const optionValidation = await validateDynamicChoice(id, value);
    if (optionValidation) return fail('INVALID_VALUE', optionValidation);
    let after = clone(value);
    if (id === 'bubble.sequences') after = clone(value.items);
    return { ok: true, settingId: id, label: context.field.label, before, after, revision, mode: id === 'bubble.sequences' ? mode : undefined };
  }

  async function apply(input) {
    const { settingId: id, value, mode, expectedRevision } = input;
    const { context, revision } = await inspect(id, mode);
    if (typeof expectedRevision !== 'string' || !expectedRevision) return fail('MISSING_REVISION', '请先读取当前设置，再提交修改');
    if (expectedRevision !== revision) return fail('SETTINGS_CONFLICT', '设置在读取后已改变，请重新读取再修改');
    const validation = validateValue(id, value, context);
    if (validation) return fail('INVALID_VALUE', validation);
    const optionValidation = await validateDynamicChoice(id, value);
    if (optionValidation) return fail('INVALID_VALUE', optionValidation);
    if (id === 'ui.pos') {
      const ok = await resetPosition();
      if (!ok) return fail('POSITION_RESET_FAILED', '鲸鱼当前位置未能复位');
      changeBus?.publish({ domain: 'ui', kind: 'position-reset' });
      return { ok: true, settingId: id, value: 'bottom-right', verified: true };
    }
    if (context.domain === 'bubble') {
      const body = id === 'bubble.sequences'
        ? { ...context.config, expectedRevision: revision, editingMode: mode, items: value.items, lib: context.config.lib || [] }
        : { ...context.config, expectedRevision: revision, lib: value };
      await bubbleRequest('POST', body);
      const result = await get(id, mode);
      return { ...result, verified: true, saved: true };
    }
    const changes = changesFor(id, value, context.state);
    const result = await settingsStore.save({ domain: context.domain, changes, base: context.state });
    if (!result?.ok) return fail(result?.conflicts?.length ? 'SETTINGS_CONFLICT' : 'SAVE_FAILED', result?.error || '设置未能保存', result?.conflicts);
    const check = await get(id, mode);
    return { ...check, verified: true, saved: true };
  }

  async function reset(id, mode, expectedRevision) {
    const field = fieldFor(id);
    if (id === 'bubble.sequences') {
      if (!['api', 'subscription'].includes(mode)) return fail('INVALID_MODE', '恢复气泡序列时需要指定 api 或 subscription 模式');
      const { context, revision } = await inspect(id, mode);
      if (expectedRevision && expectedRevision !== revision) return fail('SETTINGS_CONFLICT', '气泡序列已改变，请重新读取再恢复');
      const { bubbleDefaultQueue } = await import('../desktop/ui/shared/bubble-config/defaults.js');
      return apply({ settingId: id, mode, value: { mode, items: bubbleDefaultQueue(mode === 'subscription') }, expectedRevision: context.revision });
    }
    if (id === 'bubble.lib') {
      const current = await inspect(id, mode);
      if (expectedRevision && expectedRevision !== current.revision) return fail('SETTINGS_CONFLICT', '模块库在读取后已改变，请重新读取再恢复');
      return apply({ settingId: id, value: [], expectedRevision: current.revision });
    }
    if (id === 'ui.pos') {
      const ok = await resetPosition();
      return ok ? { ok: true, settingId: id, value: 'bottom-right', verified: true } : fail('POSITION_RESET_FAILED', '鲸鱼当前位置未能复位');
    }
    if (id === 'ui.feedbackEvent') {
      const { UI_DEFAULTS } = await import('../desktop/ui/shared/ui-defaults.js');
      const current = await inspect(id, mode);
      if (expectedRevision && expectedRevision !== current.revision) return fail('SETTINGS_CONFLICT', '音效设置在读取后已改变，请重新读取再恢复');
      return apply({ settingId: id, value: clone(UI_DEFAULTS.feedback), expectedRevision: current.revision });
    }
    if (id === 'ui.snap') {
      const current = await inspect(id, mode);
      if (expectedRevision && expectedRevision !== current.revision) return fail('SETTINGS_CONFLICT', '贴边设置在读取后已改变，请重新读取再恢复');
      const value = { v: 3, ...clone(field.defaultValue) };
      return apply({ settingId: id, value, expectedRevision: current.revision });
    }
    if (field.defaultValue === undefined || field.defaultValue === null || typeof field.defaultValue === 'string' && (field.defaultValue.startsWith('按下/松开') || field.defaultValue === '右下角')) return fail('RESET_UNAVAILABLE', '该设置没有可直接恢复的单项默认值');
    const current = await inspect(id, mode);
    if (expectedRevision && expectedRevision !== current.revision) return fail('SETTINGS_CONFLICT', '设置在读取后已改变，请重新读取再恢复');
    return apply({ settingId: id, mode, value: field.defaultValue, expectedRevision: current.revision });
  }

  return {
    catalog: catalogListing,
    async execute(input) {
      if (!plain(input) || typeof input.action !== 'string') return fail('INVALID_REQUEST', '请求需要包含 action');
      try {
        if (input.action === 'catalog') return await catalogListing();
        if (input.action === 'get') return await get(input.settingId, input.mode);
        if (input.action === 'preview') return await preview(input);
        if (input.action === 'apply') return await apply(input);
        if (input.action === 'reset') return await reset(input.settingId, input.mode, input.expectedRevision);
        return fail('UNKNOWN_ACTION', '支持 catalog、get、preview、apply、reset');
      } catch (error) {
        return fail(error?.code || 'SETTINGS_OPERATION_FAILED', error?.message || '设置操作失败');
      }
    },
  };
}

module.exports = { PHASE_ONE_IDS, createAgentSettings };
