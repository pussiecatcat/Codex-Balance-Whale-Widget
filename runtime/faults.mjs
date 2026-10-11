// Unexpected failures get a short reference instead of a misleading message.
//
// Before this, the dispatcher answered every uncaught exception with 400 and
// "操作失败，请检查设置或导入文件": the user was told to go and fix a setting that
// was not wrong, and the defect stayed invisible to whoever could fix it. Now
// the detail goes to stderr where a developer will see it, and /api/status
// carries the recent entries so a bug report can quote one.
//
// A ring buffer rather than a log file: this is diagnostic state for the current
// process, and nothing here may grow without bound or block the request that
// produced it. Messages are truncated because they may quote user data.
export function createFaultLog({ limit = 24, clock = Date.now } = {}) {
  const entries = [];
  let counter = 0;
  return {
    record(error, context = '') {
      counter += 1;
      const ref = 'f' + counter.toString(36);
      entries.push({
        ref,
        at: new Date(clock()).toISOString(),
        context: String(context).slice(0, 120),
        message: String(error?.message ?? error).slice(0, 300),
      });
      if (entries.length > limit) entries.shift();
      return ref;
    },
    list() { return entries.map(entry => ({ ...entry })); },
    clear() { entries.length = 0; },
  };
}
