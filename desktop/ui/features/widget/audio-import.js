// Own the file-picker listener together with its validation/open chain.
export function bindAudioImport({ input, validate, open, onError }) {
  async function chosen() {
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    try {
      await validate(file);
      await open(await file.arrayBuffer(), file.name);
    } catch (error) { onError(error); }
  }
  input.addEventListener('change', chosen);
  return () => input.removeEventListener('change', chosen);
}
