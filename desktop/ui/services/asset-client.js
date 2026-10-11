import { requestJson } from './request.js';
// Browser-side data boundary for character, sound, and bubble assets.
// Validation belongs here so editor views only receive recognized catalogues.
export function createAssetClient(fetchImpl, { signal } = {}) {
  const request = (url, payload) => requestJson(url, { fetchImpl, signal, method: payload === undefined ? 'GET' : 'POST', body: payload });
  return {
    async roles() {
      const data = await request('/dsh-whale/roles.json');
      return data?.ok && Array.isArray(data.roles) ? data : null;
    },
    async audio() {
      const data = await request('/dsh-whale/audio.json');
      return data?.ok ? data : null;
    },
    async bubbleImages() {
      const data = await request('/dsh-whale/bubble-imgs.json');
      return data?.ok && Array.isArray(data.images) ? data : null;
    },
    async bubbleConfig() {
      const data = await request('/dsh-whale/bubble.json');
      return data?.ok ? data : null;
    },
    saveBubbleConfig(config) { return request('/dsh-whale/bubble.json', config); },
    uploadBubbleImage(name, dataUrl) {
      return request('/dsh-whale/bubble-img-upload.json', { action: 'upload', name, data: dataUrl });
    },
    uploadAudioFragment(name, dataUrl) {
      return request('/dsh-whale/audio.json', { action: 'upload-fragment', name, audio: dataUrl });
    },
    deleteRole(id) { return request('/dsh-whale/role-delete.json', { id }); },
    pinRole(id, pinned) { return request('/dsh-whale/role-pin.json', { id, pinned }); },
    deleteBubbleImage(id) { return request('/dsh-whale/bubble-img-upload.json', { action: 'delete', id }); },
    deleteAudioGroup(id) { return request('/dsh-whale/audio.json', { action: 'delete-group', id }); },
    deleteAudioFragment(id) { return request('/dsh-whale/audio.json', { action: 'delete-fragment', id }); },
  };
}
