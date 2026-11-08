export function createTurnCostTemplateSaver({ getUsageSet, requestJson, saveUsage, settingsUrl, onError = () => {} }) {
  return async function saveTurnCostTemplate(config) {
    try {
      let settings = getUsageSet();
      if (!settings || !settings.turnCost) {
        const saved = await requestJson(settingsUrl);
        if (!saved?.ok || !saved.usage) throw new Error(saved?.error || '任务用量设置读取失败');
        settings = saved.usage;
      }
      const key = config.templateMode === 'subscription' ? 'subscriptionLines' : 'lines';
      const turnCost = { ...(settings.turnCost || {}), [key]: config.lines };
      return await saveUsage({ turnCost });
    } catch (error) {
      onError(error);
      return null;
    }
  };
}
