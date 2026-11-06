import test from 'node:test';
import assert from 'node:assert/strict';
import { createSoundService } from '../desktop/ui/services/sound.js';

function fixture() {
  const plays = [], stopped = [];
  const service = createSoundService({ engine: { play: command => plays.push(command), stop: channel => stopped.push(channel) } });
  service.reload({ size: { sound: true, soundSet: 'g', vol: .8 }, catalog: { groups: [{ id: 'g', press: 'old', release: '' }] } });
  return { service, plays, stopped };
}

test('sound URLs identify the current fragment, preserve escaping and represent empty slots as silence', () => {
  const { service } = fixture();
  assert.equal(service.urlFor({ groupId: 'g' }), '/dsh-whale/sound/press.mp3?set=g&frag=old');
  assert.equal(service.urlFor({ groupId: 'g', slot: 'release' }), '');
  service.reload({ catalog: { groups: [{ id: 'g', press: 'new clip', release: 'tail' }] } });
  assert.equal(service.urlFor({ groupId: 'g' }), '/dsh-whale/sound/press.mp3?set=g&frag=new%20clip');
  assert.equal(service.referenceUrl('preset:g:release'), '/dsh-whale/sound/release.mp3?set=g&frag=tail');
});

test('one reload updates the next playback and subscriptions without flushing an unrelated cache', async () => {
  const { service, plays } = fixture();
  let changes = 0;
  const unsubscribe = service.subscribe(snapshot => { changes++; snapshot.size.vol = 0; });
  await service.play('press');
  service.reload({ size: { sound: true, soundSet: 'g', vol: .4 }, catalog: { groups: [{ id: 'g', press: 'edited' }] } });
  await service.play('press');
  assert.equal(plays[0].url, '/dsh-whale/sound/press.mp3?set=g&frag=old');
  assert.equal(plays[1].url, '/dsh-whale/sound/press.mp3?set=g&frag=edited');
  assert.equal(plays[1].volume, .4);
  assert.equal(plays[1].channel, 'gesture');
  assert.equal(changes, 1);
  unsubscribe(); service.reload({ feedback: {} });
  assert.equal(changes, 1);
});

test('preview and event playback share the engine while applying independent channels and feedback presets', async () => {
  const { service, plays, stopped } = fixture();
  service.reload({ feedback: { events: { press: { preset: 'pearl', volume: .5 }, failed: { preset: 'silent', volume: 1 } } } });
  await service.play('press');
  assert.equal(plays[0].preset, 'pearl');
  assert.equal(plays[0].volume, .4);
  await service.preview('frag:preview', .6, { channel: 'audio-group-preview' });
  assert.equal(plays[1].url, '/dsh-whale/audio-fragment.wav?id=preview');
  assert.equal(plays[1].channel, 'audio-group-preview');
  assert.equal(plays[1].volume, .6);
  await service.play('failed');
  assert.equal(plays[2].volume, 0);
  service.stop('audio-group-preview');
  assert.deepEqual(stopped, ['audio-group-preview']);
});

test('empty press preview completes without loading an empty fragment', async () => {
  const { service, plays, stopped } = fixture();
  let ended = false;
  await service.preview({ kind: 'fragment', id: '' }, 1, { onended: () => { ended = true; } });
  assert.equal(ended, true);
  assert.equal(plays.length, 0);
  assert.deepEqual(stopped, ['preview']);
});
