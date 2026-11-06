import test from 'node:test';
import assert from 'node:assert/strict';
import { encodeWav } from '../desktop/ui/features/widget/audio-crop-editor.js';

test('encodeWav writes a mono 16-bit PCM header and clamps samples', async () => {
  const buffer = {
    numberOfChannels: 1, sampleRate: 8000, length: 2,
    getChannelData: () => Float32Array.from([0, 1.5]),
  };
  const blob = encodeWav(buffer);
  const bytes = new Uint8Array(await blob.arrayBuffer());
  assert.equal(String.fromCharCode(...bytes.slice(0, 4)), 'RIFF');
  assert.equal(String.fromCharCode(...bytes.slice(8, 12)), 'WAVE');
  assert.equal(String.fromCharCode(...bytes.slice(12, 16)), 'fmt ');
  assert.equal(new DataView(bytes.buffer).getUint16(22, true), 1);
  assert.equal(new DataView(bytes.buffer).getUint32(24, true), 8000);
  assert.equal(bytes.length, 44 + 2 * 2);
  assert.equal(new DataView(bytes.buffer).getInt16(46, true), 0x7fff);
});

test('choosing an audio file validates it and opens the crop dialog; cancel and errors do not', async () => {
  const { bindAudioImport } = await import('../desktop/ui/features/widget/audio-import.js');
  const handlers = new Map();
  const input = { value: 'picked', files: [], addEventListener: (name, callback) => handlers.set(name, callback), removeEventListener: name => handlers.delete(name) };
  const opened = [], errors = [], order = [];
  const dispose = bindAudioImport({ input,
    validate: async file => { order.push('validate'); if (file.invalid) throw Error('invalid audio'); },
    open: async (bytes, name) => { order.push('open'); opened.push({ bytes, name }); },
    onError: error => errors.push(error.message),
  });
  const bytes = new ArrayBuffer(4);
  input.files = [{ name: 'clip.wav', arrayBuffer: async () => { order.push('read'); return bytes; } }];
  await handlers.get('change')();
  assert.deepEqual(order, ['validate', 'read', 'open']);
  assert.deepEqual(opened, [{ bytes, name: 'clip.wav' }]);
  assert.equal(input.value, '');
  input.files = []; await handlers.get('change')();
  input.files = [{ invalid: true }]; await handlers.get('change')();
  assert.equal(opened.length, 1); assert.deepEqual(errors, ['invalid audio']);
  dispose(); assert.equal(handlers.has('change'), false);
});
