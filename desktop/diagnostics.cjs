'use strict';
const path = require('node:path');
const { createVisibilityRecorder } = require('./visibility-recorder.cjs');

// Diagnostics for a window whose visibility is the whole product: the widget has
// to be visible when it should be and out of the way when it should not, and
// when that goes wrong there is nothing to see afterwards unless it was written
// down. This used to sit inline in main.cjs, interleaved with window creation.
//
// `snapshot()` is supplied by the caller because every field belongs to the main
// process's live state. It returns two shapes on purpose: `record` is null when
// there is no window to sample, while `entry` is written in every case so a
// diagnose() call from before the window exists still leaves a trace.
function createDiagnostics({ dataDir, save, snapshot, clock = () => new Date() }) {
  const history = [];
  let lastReport = null;

  const recorder = createVisibilityRecorder({
    read: () => snapshot().record,
    write: (name, value) => save(path.join(dataDir, name), value),
  });

  function diagnose(reason) {
    try {
      const { entry } = snapshot();
      const item = { reason, ...entry, at: clock().toISOString() };
      history.push(item);
      if (history.length > 24) history.shift();
      save(path.join(dataDir, 'visibility-status.json'), { ...item, history });
    } catch {}
  }

  function report() {
    try { lastReport = recorder.report(); return lastReport; }
    catch { return { saved: false }; }
  }

  return { diagnose, report, sample: () => recorder.sample(), history: () => history.map(item => ({ ...item })), lastReport: () => lastReport };
}

module.exports = { createDiagnostics };
