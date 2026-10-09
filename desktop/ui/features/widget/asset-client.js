// Browser-side data boundary for character, sound, and bubble assets.
// Validation belongs here so editor views only receive recognized catalogues.
export function createAssetClient(fetchImpl = fetch) {
  async function request(url, payload) {
    const response = await fetchImpl(url, payload === undefined
      ? { cache: 'no-store' }
      : { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    return response.json();
  }
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
  };
}
