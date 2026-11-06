'use strict';

// The single place a persisted change becomes a renderer notification. Both
// settings writes and resource routes publish here, so every open window sees
// the same revision and the same payload shape.
function createChangeBus({ targets }) {
  let revision = 0;
  return {
    publish(change) {
      const message = { ...change, revision: ++revision };
      for (const target of targets() || []) {
        if (target && !target.isDestroyed() && !target.webContents.isDestroyed()) {
          target.webContents.send('whale-settings-changed', message);
        }
      }
      return message.revision;
    },
  };
}

module.exports = { createChangeBus };
