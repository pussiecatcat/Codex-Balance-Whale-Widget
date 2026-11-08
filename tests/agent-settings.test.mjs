import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const { createAgentSettings } = require(path.join(root, 'desktop/agent-settings.cjs'));
const { catalog } = await import('../desktop/ui/settings-catalog.js');

const digest = value => crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');

function fixture() {
  const domains = {
    size: { scale: 1, sound: true, vol: .9, soundSet: 'duck', bubbleOn: true, turnCostCloseMs: 5000, scrollGapOn: false, scrollGapPx: 0, menuBtnHide: false },
    completion: { turnCostOn: true, on: false },
    ui: { 'dshw-role': 'default', 'dshw-display-currency': 'USD', 'dshw-bubble-shape': 'ellipse', 'dshw-v3-feedback': { feel: 'balanced', events: {} }, 'dshw-snap': { v: 3, mode: 'ratio', ratio: { L: 10, T: 0, R: 10, B: 15, F: 50 }, px: { L: 80, T: 0, R: 80, B: 80, F: -1 } } },
    displayMode: { mode: 'subscription' },
    usage: { taskEnd: { on: false }, alert: { on: true, below: .2, msg: '余额提醒', lines: [] }, budget: { on: false, amount: 10, msg: '预算提醒', lines: [] }, turnCost: { lines: [] }, events: { turnCost: { bubbleOn: true } }, wait: { charClose: false } },
  };
  let bubble = { v: 1, items: [{ kind: 'normal' }], subscriptionItems: [{ kind: 'custom', modules: [{ type: 'text', text: 'sub' }] }], lib: [] };
  let saves = 0;
  const settingsStore = {
    async read(domain) { return { [domain]: structuredClone(domains[domain]) }; },
    async save({ domain, changes, base }) {
      if (JSON.stringify(domains[domain]) !== JSON.stringify(base)) return { ok: false, error: 'conflict', conflicts: [{ key: 'changed' }] };
      domains[domain] = { ...domains[domain], ...structuredClone(changes) };
      saves++;
      return { ok: true, applied: changes, values: domains[domain] };
    },
  };
  const dispatcher = {
    async dispatch(route, { method, body } = {}) {
      if (route === '/dsh-whale/bubble.json') {
        if (method === 'GET') return response({ ok: true, config: structuredClone(bubble), revision: digest(bubble) });
        const input = JSON.parse(body.toString());
        if (input.expectedRevision !== digest(bubble)) return response({ ok: false, code: 'SETTINGS_CONFLICT', error: 'conflict' }, 409);
        if (input.editingMode === 'api') bubble = { ...bubble, items: input.items, lib: input.lib };
        else if (input.editingMode === 'subscription') bubble = { ...bubble, subscriptionItems: input.items, lib: input.lib };
        else bubble = { ...bubble, items: input.items, subscriptionItems: input.subscriptionItems, lib: input.lib };
        return response({ ok: true, config: structuredClone(bubble), revision: digest(bubble) });
      }
      if (route === '/dsh-whale/roles.json') return response({ ok: true, roles: [{ id: 'default', name: '默认' }] });
      if (route === '/dsh-whale/audio.json') return response({ ok: true, groups: [{ id: 'duck', name: '小黄鸭' }], fragments: [] });
      throw new Error('unexpected route ' + route);
    },
  };
  const api = createAgentSettings({ catalog, settingsStore, dispatcher, resetPosition: async () => true });
  return { api, domains, getBubble: () => bubble, getSaves: () => saves };
}

function response(value, status = 200) {
  return { status, body: Buffer.from(JSON.stringify(value)) };
}

test('catalog exposes the first-phase preferences and marks later domains excluded', async () => {
  const { api } = fixture();
  const result = await api.execute({ action: 'catalog' });
  assert.equal(result.ok, true);
  assert.ok(result.settings.some(item => item.id === 'bubble.sequences'));
  assert.ok(result.excluded.includes('api.provider'));
  assert.ok(result.excluded.includes('media.roles'));
});

test('scale writes are validated, transformed to storage units and read back', async () => {
  const { api, domains, getSaves } = fixture();
  const current = await api.execute({ action: 'get', settingId: 'size.scale' });
  assert.equal(current.value, 5);
  const preview = await api.execute({ action: 'preview', settingId: 'size.scale', value: 8, expectedRevision: current.revision });
  assert.equal(preview.before, 5);
  assert.equal(preview.after, 8);
  const saved = await api.execute({ action: 'apply', settingId: 'size.scale', value: 8, expectedRevision: current.revision });
  assert.equal(saved.ok, true);
  assert.equal(saved.verified, true);
  assert.equal(domains.size.scale, 1.3);
  assert.equal(saved.value, 8);
  assert.equal(getSaves(), 1);
});

test('invalid and stale edits do not write settings', async () => {
  const { api, getSaves } = fixture();
  const current = await api.execute({ action: 'get', settingId: 'size.scale' });
  const invalid = await api.execute({ action: 'apply', settingId: 'size.scale', value: 21, expectedRevision: current.revision });
  assert.equal(invalid.code, 'INVALID_VALUE');
  const missing = await api.execute({ action: 'apply', settingId: 'size.scale', value: 8, expectedRevision: '' });
  assert.equal(missing.code, 'MISSING_REVISION');
  const stale = await api.execute({ action: 'apply', settingId: 'size.scale', value: 8, expectedRevision: 'stale' });
  assert.equal(stale.code, 'SETTINGS_CONFLICT');
  assert.equal(getSaves(), 0);
});

test('bubble sequence writes require a mode and preserve the other mode', async () => {
  const { api, getBubble } = fixture();
  const current = await api.execute({ action: 'get', settingId: 'bubble.sequences', mode: 'api' });
  const saved = await api.execute({ action: 'apply', settingId: 'bubble.sequences', mode: 'api', expectedRevision: current.revision,
    value: { mode: 'api', items: [{ kind: 'custom', modules: [{ type: 'text', text: 'new api' }] }] } });
  assert.equal(saved.ok, true);
  assert.equal(getBubble().items[0].modules[0].text, 'new api');
  assert.equal(getBubble().subscriptionItems[0].modules[0].text, 'sub');
  const missingMode = await api.execute({ action: 'get', settingId: 'bubble.sequences' });
  assert.equal(missingMode.code, 'INVALID_MODE');
});

test('position reset is an explicit action and never accepts coordinate writes', async () => {
  const { api } = fixture();
  const result = await api.execute({ action: 'reset', settingId: 'ui.pos' });
  assert.equal(result.ok, true);
  assert.equal(result.value, 'bottom-right');
  const current = await api.execute({ action: 'get', settingId: 'ui.pos' });
  const unsupported = await api.execute({ action: 'apply', settingId: 'ui.pos', value: { x: 1, y: 2 }, expectedRevision: current.revision });
  assert.equal(unsupported.code, 'INVALID_VALUE');
});

test('alert module updates preserve the rest of the alert settings', async () => {
  const { api, domains } = fixture();
  const current = await api.execute({ action: 'get', settingId: 'usage.alertModules' });
  const saved = await api.execute({ action: 'apply', settingId: 'usage.alertModules',
    value: { below: 0.1 }, expectedRevision: current.revision });
  assert.equal(saved.ok, true);
  assert.equal(domains.usage.alert.below, 0.1);
  assert.equal(domains.usage.alert.msg, '余额提醒');
  assert.equal(domains.usage.alert.on, true);
});

test('event sound selections must exist in the installed sound catalog', async () => {
  const { api, domains } = fixture();
  const current = await api.execute({ action: 'get', settingId: 'usage.events.question' });
  const invalid = await api.execute({ action: 'apply', settingId: 'usage.events.question',
    value: { soundOn: true, sel: 'frag:missing' }, expectedRevision: current.revision });
  assert.equal(invalid.code, 'INVALID_VALUE');
  assert.equal(domains.usage.events.question, undefined);

  const saved = await api.execute({ action: 'apply', settingId: 'usage.events.question',
    value: { soundOn: true, sel: 'grp:duck' }, expectedRevision: current.revision });
  assert.equal(saved.ok, true);
  assert.equal(domains.usage.events.question.sel, 'grp:duck');
});
