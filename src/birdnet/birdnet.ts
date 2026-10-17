import { Asset } from 'expo-asset';
import { loadTensorflowModel, type TfliteModel } from 'react-native-fast-tflite';

import audioModelAsset from '../../assets/models/birdnet-audio.tflite';
import metaModelAsset from '../../assets/models/birdnet-meta.tflite';
import rawLabels from './labels.json';
import { localModelSource } from './modelAsset';

// BirdNET v2.4 expects 3 s of mono audio at 48 kHz.
export const SAMPLE_RATE = 48000;
export const WINDOW_SAMPLES = SAMPLE_RATE * 3;
export const LOCATION_THRESHOLD = 0.03;

export type Species = { index: number; scientific: string; common: string };

// Non-species classes (noise, human voice, engines...) are null in labels.json.
export const species: (Species | null)[] = (rawLabels as ([string, string] | null)[]).map(
  (l, index) => (l ? { index, scientific: l[0], common: l[1] } : null),
);

function once(load: () => Promise<TfliteModel>) {
  let p: Promise<TfliteModel> | null = null;
  return () =>
    (p ??= load().catch((e) => {
      p = null;
      throw e;
    }));
}

async function loadBundledModel(moduleId: number) {
  const source = await localModelSource(Asset.fromModule(moduleId));
  return loadTensorflowModel(source, []);
}

export const loadAudioModel = once(() => loadBundledModel(audioModelAsset));
const loadMetaModel = once(() => loadBundledModel(metaModelAsset));

/** Returns a confidence (0..1) per label for a 3 s window. */
export async function predict(window: Float32Array<ArrayBuffer>): Promise<Float32Array> {
  if (window.length !== WINDOW_SAMPLES) throw new Error('BirdNET needs exactly 3 seconds of audio.');
  const model = await loadAudioModel();
  const [out] = await model.run([window.buffer]);
  if (!out || out.byteLength !== species.length * 4) throw new Error('BirdNET returned an invalid output tensor.');
  const logits = new Float32Array(out);
  const probs = new Float32Array(logits.length);
  for (let i = 0; i < logits.length; i++) {
    if (!Number.isFinite(logits[i])) throw new Error('BirdNET returned a non-finite prediction.');
    const x = Math.max(-15, Math.min(15, logits[i]));
    probs[i] = 1 / (1 + Math.exp(-x));
  }
  return probs;
}

/** BirdNET week of year: 4 weeks per month, 1..48. */
export function birdnetWeek(date = new Date()) {
  return date.getMonth() * 4 + Math.min(4, Math.ceil(date.getDate() / 7));
}

/** Likelihood (0..1) of each label occurring at this place and week. */
export async function locationScores(lat: number, lon: number, week = birdnetWeek()): Promise<Float32Array> {
  const model = await loadMetaModel();
  const [out] = await model.run([new Float32Array([lat, lon, week]).buffer]);
  return new Float32Array(out);
}
