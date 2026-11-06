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

test('choosing an audio file opens the crop dialog', async () => {
  const fs = await import('node:fs');
  const source = fs.readFileSync(new URL('../assets/whale-widget.js', import.meta.url), 'utf8');
  assert.match(source, /audioCropFileInput\.addEventListener\('change'[\s\S]{0,400}?validateAudioFile\(f\)[\s\S]{0,120}?audioCropEditor\.open\(await f\.arrayBuffer\(\), f\.name\)/,
    'the file picker has a change listener that opens the crop dialog');
});', start));
  assert.match(handler, /validateAudioFile\(f\)/);
  assert.match(handler, /audioCropEditor\.open\(await f\.arrayBuffer\(\), f\.name\)/);
});
