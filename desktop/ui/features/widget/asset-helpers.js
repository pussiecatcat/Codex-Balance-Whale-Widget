// Toast, warning de-duplication and media reading shared by role, bubble and
// audio imports. Keeping them here stops each importer from inventing its own
// failure wording.
export function createAssetHelpers({ window, FileReader }) {
  const warnings = Object.create(null);
  function notice(message) {
    if (window.whaleToast) window.whaleToast(String(message || '素材操作未完成，请重试'));
  }
  function warning(data) {
    if (data && data.warning && !warnings[data.warning]) {
      warnings[data.warning] = true;
      notice(data.warning);
    }
  }
  function requireSaved(data) {
    if (!data || data.ok !== true) throw new Error(data && data.error || '保存未完成，请重试');
    warning(data);
    return data;
  }
  function failure(error) { notice(error && error.message || '保存未完成，请重试'); }
  function mediaDataUrl(blob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => { resolve(String(reader.result || '')); };
      reader.onerror = () => { reject(new Error('文件读取失败，请重新选择')); };
      reader.readAsDataURL(blob);
    });
  }
  return { notice, warning, requireSaved, failure, mediaDataUrl };
}
