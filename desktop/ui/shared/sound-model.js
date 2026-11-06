// One conversion for the four completion-reminder combinations. Both settings
// surfaces and the sound panel must agree on what "only sound" means.
export const COMPLETION_DEFAULT = 'bubble';

export function completionMode({ turnCostOn, taskEndOn } = {}) {
  const bubble = turnCostOn !== false;
  const sound = taskEndOn === true;
  return bubble ? (sound ? 'both' : 'bubble') : (sound ? 'custom' : 'off');
}

export function completionPatch(mode) {
  return {
    turnCostOn: mode === 'bubble' || mode === 'both',
    taskEndOn: mode === 'custom' || mode === 'both',
  };
}
