import { serviceRequest } from '../runtime/process.mjs';

const [command, ...args] = process.argv.slice(2);

function usage() {
  throw new Error('用法：catalog [关键词]；get <settingId> [api|subscription]；preview|apply（从标准输入读取 JSON）；reset <settingId> [api|subscription] [revision]');
}

async function readInput() {
  const chunks = [];
  let bytes = 0;
  for await (const chunk of process.stdin) {
    bytes += chunk.length;
    if (bytes > 48 * 1024) throw new Error('设置请求不能超过 48 KB');
    chunks.push(chunk);
  }
  const text = Buffer.concat(chunks).toString('utf8').trim();
  if (!text) throw new Error('请通过标准输入提供 JSON 请求');
  return JSON.parse(text);
}

function print(value) {
  process.stdout.write(JSON.stringify(value, null, 2) + '\n');
  if (value?.ok === false) process.exitCode = 1;
}

try {
  let request;
  if (command === 'catalog') {
    request = { action: 'catalog' };
  } else if (command === 'get') {
    if (!args[0]) usage();
    request = { action: 'get', settingId: args[0], ...(args[1] ? { mode: args[1] } : {}) };
  } else if (command === 'preview' || command === 'apply') {
    request = await readInput();
    if (!request || typeof request !== 'object' || Array.isArray(request)) usage();
    request.action = command;
  } else if (command === 'reset') {
    if (!args[0]) usage();
    request = { action: 'reset', settingId: args[0] };
    if (args[1]) request.mode = args[1];
    if (args[2]) request.expectedRevision = args[2];
  } else usage();

  const result = await serviceRequest('/api/agent-settings', { method: 'POST', body: request });
  if (command === 'catalog' && args[0] && Array.isArray(result.settings)) {
    const query = args.join(' ').toLocaleLowerCase();
    result.settings = result.settings.filter(item => [item.id, item.label, item.purpose].join(' ').toLocaleLowerCase().includes(query));
  }
  print(result);
} catch (error) {
  process.stderr.write(String(error?.message || error) + '\n');
  process.exitCode = 1;
}
