import assert from 'node:assert/strict';
import { test } from 'node:test';

import { RingBuffer, resample } from '../src/audio/buffer.ts';
import { inputHealth, measureAudio } from '../src/audio/diagnostics.ts';
import { requestForegroundRecordingPermission, shouldPauseRecording } from '../src/audio/foreground.ts';
import { encodeWav } from '../src/audio/wav.ts';
import { rankPredictions } from '../src/birdnet/results.ts';
import { localModelSource } from '../src/birdnet/modelAsset.ts';
import { formatCoordinates } from '../src/birdnet/coordinates.ts';

test('offline GPS labels show hemisphere and reject invalid fixes', () => {
  assert.equal(formatCoordinates(9.9281, -84.0907), '9.928 N, 84.091 W');
  assert.equal(formatCoordinates(-33.8688, 151.2093), '33.869 S, 151.209 E');
  assert.equal(formatCoordinates(0, 0), '0.000 N, 0.000 E');
  for (const [lat, lon] of [[NaN, 0], [0, Infinity], [91, 0], [0, -181]]) {
    assert.throws(() => formatCoordinates(lat, lon), /invalid GPS/);
  }
});

test('bundled models are materialized locally before the native URL loader runs', async () => {
  let copied = false;
  const source = await localModelSource({
    async downloadAsync() {
      copied = true;
      return { localUri: 'file:///cache/ExponentAsset-model.tflite' };
    },
  });
  assert.equal(copied, true);
  assert.deepEqual(source, { url: 'file:///cache/ExponentAsset-model.tflite' });
});

test('unresolved resource names and remote model URLs are rejected explicitly', async () => {
  for (const localUri of [null, '', 'assets_models_birdnetaudio', 'https://example.test/model.tflite']) {
    await assert.rejects(localModelSource({ async downloadAsync() { return { localUri }; } }), /local file/);
  }
  await assert.rejects(
    localModelSource({ async downloadAsync() { throw new Error('Asset copy failed'); } }),
    /Asset copy failed/,
  );
});

function appState(initial = 'active') {
  const listeners = new Set();
  return {
    currentState: initial,
    addEventListener(event, listener) {
      assert.equal(event, 'change');
      listeners.add(listener);
      return { remove: () => listeners.delete(listener) };
    },
    change(state) {
      this.currentState = state;
      for (const listener of [...listeners]) listener(state);
    },
    get listenerCount() { return listeners.size; },
  };
}

test('permission dialogs do not cancel startup, but real background capture pauses', () => {
  for (const state of ['background', 'inactive']) {
    assert.equal(shouldPauseRecording(state, false, false, false), false);
    assert.equal(shouldPauseRecording(state, false, true, true), false);
    assert.equal(shouldPauseRecording(state, false, true, false), true);
    assert.equal(shouldPauseRecording(state, true, false, false), true);
    assert.equal(shouldPauseRecording(state, true, false, true), true);
  }
  assert.equal(shouldPauseRecording('active', true, false, false), false);
});

test('first-run microphone grant waits until the permission activity returns to Birdsong', async () => {
  const source = appState();
  let settled = false;
  const permission = requestForegroundRecordingPermission(source, async () => {
    source.change('background');
    return 'Granted';
  }).then(result => { settled = true; return result; });
  await Promise.resolve();
  assert.equal(settled, false);
  assert.equal(source.listenerCount, 1);
  source.change('inactive');
  assert.equal(settled, false);
  source.change('active');
  assert.equal(await permission, 'Granted');
  assert.equal(source.listenerCount, 0);
});

test('already granted foreground permission does not add a lifecycle listener', async () => {
  const source = appState();
  assert.equal(await requestForegroundRecordingPermission(source, async () => 'Granted'), 'Granted');
  assert.equal(source.listenerCount, 0);
});

test('denied microphone permission and native request errors are preserved', async () => {
  const source = appState('background');
  assert.equal(await requestForegroundRecordingPermission(source, async () => 'Denied'), 'Denied');
  await assert.rejects(
    requestForegroundRecordingPermission(source, async () => { throw new Error('Permission request failed'); }),
    /Permission request failed/,
  );
  assert.equal(source.listenerCount, 0);
});

test('leaving during permission request fails explicitly and releases its listener', async () => {
  const source = appState('background');
  await assert.rejects(requestForegroundRecordingPermission(source, async () => 'Granted', 10), /Return to Birdsong/);
  assert.equal(source.listenerCount, 0);
});

test('foreground return between permission resolution and subscription is not missed', async () => {
  const source = appState('background');
  const subscribe = source.addEventListener;
  source.addEventListener = (event, listener) => {
    source.currentState = 'active';
    return subscribe(event, listener);
  };
  assert.equal(await requestForegroundRecordingPermission(source, async () => 'Granted'), 'Granted');
  assert.equal(source.listenerCount, 0);
});

test('input meter measures samples, not elapsed time', () => {
  assert.deepEqual(measureAudio(new Float32Array(4800)), { db: -100, peak: 0 });
  const signal = measureAudio(new Float32Array([0.5, -0.5]));
  assert.ok(Math.abs(signal.db + 6.0206) < 0.001);
  assert.equal(signal.peak, 0.5);
  assert.throws(() => measureAudio(new Float32Array()), /empty/);
  assert.throws(() => measureAudio(new Float32Array([NaN])), /invalid/);
});

test('capture health distinguishes waiting, silence, sound and missing callbacks', () => {
  assert.equal(inputHealth(1100, 1000, 0, 0), 'waiting');
  assert.equal(inputHealth(3101, 1000, 0, 0), 'stalled');
  assert.equal(inputHealth(1500, 1000, 1400, 1400), 'receiving');
  assert.equal(inputHealth(5000, 1000, 4900, 0), 'quiet');
  assert.equal(inputHealth(7501, 1000, 5500, 5500), 'stalled');
  assert.equal(inputHealth(6000, 1000, 5900, 5800), 'receiving');
});

test('rolling snapshot keeps the latest full window in time order', () => {
  const ring = new RingBuffer(4);
  ring.push(new Float32Array([1, 2, 3]));
  assert.equal(ring.filled, 3);
  ring.push(new Float32Array([4, 5, 6]));
  assert.deepEqual([...ring.snapshot()], [3, 4, 5, 6]);
  ring.push(new Float32Array([7, 8, 9, 10, 11]));
  assert.deepEqual([...ring.snapshot()], [8, 9, 10, 11]);
  ring.reset();
  assert.equal(ring.filled, 0);
});

test('resampling preserves same-rate PCM and interpolates other input rates', () => {
  const input = new Float32Array([0, 1, 0, -1]);
  assert.equal(resample(input, 48000, 48000), input);
  assert.deepEqual([...resample(input, 24000, 48000)], [0, 0.5, 1, 0.5, 0, -0.5, -1, -1]);
});

test('saved WAV has exactly three seconds of mono 48 kHz PCM16', () => {
  const samples = new Float32Array(144000);
  samples.set([-2, -0.5, 0, 0.5, 2]);
  const wav = encodeWav(samples, 48000);
  const view = new DataView(wav.buffer);
  const text = (start, length) => new TextDecoder().decode(wav.subarray(start, start + length));
  assert.equal(wav.length, 288044);
  assert.equal(text(0, 4), 'RIFF');
  assert.equal(text(8, 4), 'WAVE');
  assert.equal(text(12, 4), 'fmt ');
  assert.equal(text(36, 4), 'data');
  assert.equal(view.getUint32(4, true), wav.length - 8);
  assert.equal(view.getUint16(20, true), 1);
  assert.equal(view.getUint16(22, true), 1);
  assert.equal(view.getUint32(24, true), 48000);
  assert.equal(view.getUint32(28, true), 96000);
  assert.equal(view.getUint16(32, true), 2);
  assert.equal(view.getUint16(34, true), 16);
  assert.equal(view.getUint32(40, true) / view.getUint32(28, true), 3);
  assert.deepEqual(Array.from({ length: 5 }, (_, i) => view.getInt16(44 + i * 2, true)), [-32768, -16384, 0, 16384, 32767]);
  assert.ok(wav.subarray(54).every((byte) => byte === 0), 'silence must not be boosted');
  assert.throws(() => encodeWav(new Float32Array(), 48000), /Invalid/);
  assert.throws(() => encodeWav(new Float32Array([0]), 0), /Invalid/);
  assert.throws(() => encodeWav(new Float32Array([Infinity]), 48000), /invalid/);
});

const labels = [
  null,
  { index: 1, common: 'Bird A', scientific: 'Species A' },
  { index: 2, common: 'Bird B', scientific: 'Species B' },
];

test('strongest bird is shown even when confidence or location rejects it', () => {
  const low = rankPredictions(new Float32Array([0.99, 0.3, 0.1]), labels, null, 0.03);
  assert.equal(low.strongest.species.index, 1);
  assert.equal(low.strongest.reason, 'confidence');
  assert.equal(low.accepted.length, 0);
  const filtered = rankPredictions(new Float32Array([0, 0.9, 0.6]), labels, new Float32Array([1, 0, 1]), 0.03);
  assert.equal(filtered.strongest.reason, 'location');
  assert.equal(filtered.accepted[0].species.index, 2);
  const threshold = rankPredictions(new Float32Array([0, 0.5, 0]), labels, null, 0.03);
  assert.equal(threshold.accepted[0].confidence, 0.5);
});

test('malformed model scores fail visibly instead of producing empty success', () => {
  assert.throws(() => rankPredictions(new Float32Array(1), labels, null, 0.03), /number/);
  for (const value of [NaN, Infinity, -0.1, 1.1]) {
    assert.throws(() => rankPredictions(new Float32Array([0, value, 0]), labels, null, 0.03), /invalid/);
  }
  assert.throws(() => rankPredictions(new Float32Array(3), labels, new Float32Array(1), 0.03), /location/);
  assert.throws(() => rankPredictions(new Float32Array(3), labels, new Float32Array([0, NaN, 1]), 0.03), /location/);
});
