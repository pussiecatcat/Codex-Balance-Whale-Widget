// Model-facing MCP output is an allow-list. Local paths, provider endpoints,
// account ids and session labels must never reach the model provider even
// though the local UI and diagnostics still use them. Full diagnostics stay
// on local commands and the widget itself.
const pick = (value, keys) => keys.reduce((out, key) => {
  if (value && Object.hasOwn(value, key)) out[key] = value[key];
  return out;
}, {});

const models = list => (Array.isArray(list) ? list : []).map(item => pick(item, ['model', 'cost']));
const day = value => value && { ...pick(value, ['date', 'total', 'totalState']), models: models(value.models) };

function status(output) {
  return {
    ...pick(output, ['ok', 'version', 'buildVersion', 'transport', 'webpage', 'followCodex', 'desktopMode', 'rendererReady', 'platform']),
    provider: output?.provider && {
      ...pick(output.provider, ['hasKey']),
      settings: pick(output.provider.settings, ['currency', 'monitorSessions', 'refreshSeconds']),
      configured: pick(output.provider.configured, ['baseUrl', 'keyEnv']),
    },
    monitor: output?.monitor && pick(output.monitor, ['watching', 'activeTurns', 'initializing', 'catchingUp']),
  };
}

function balance(output) {
  return pick(output, ['ok', 'code', 'error', 'currency', 'totalBalance', 'totalGranted', 'totalUsed', 'unlimited',
    'adapter', 'balanceScope', 'balanceLabel', 'unitNote', 'updatedAt']);
}

function usage(output) {
  return {
    ...pick(output, ['ok', 'error', 'currency', 'total7', 'total7Complete']),
    today: output?.today && { ...pick(output.today, ['total', 'since', 'source']), models: models(output.today.models) },
    days7: (Array.isArray(output?.days7) ? output.days7 : []).map(day),
    all: output?.all && {
      ...pick(output.all, ['total', 'totalComplete', 'missingSummaryDays']),
      days: (Array.isArray(output.all.days) ? output.all.days : []).map(day),
    },
  };
}

const projectors = {
  whale_status: status,
  whale_balance: balance,
  whale_usage: usage,
  whale_open: output => pick(output, ['ok', 'error', 'code']),
};

export function projectToolOutput(name, output) {
  if (!output || typeof output !== 'object') return output;
  const projector = projectors[name];
  if (!projector) throw new Error('未知工具');
  return projector(output);
}
