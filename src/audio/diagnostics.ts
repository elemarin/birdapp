export function measureAudio(samples: Float32Array) {
  if (!samples.length) throw new Error('The microphone returned an empty audio buffer.');
  let sum = 0;
  let peak = 0;
  for (const sample of samples) {
    if (!Number.isFinite(sample)) throw new Error('The microphone returned invalid audio samples.');
    sum += sample * sample;
    peak = Math.max(peak, Math.abs(sample));
  }
  const rms = Math.sqrt(sum / samples.length);
  return { db: Math.max(-100, 20 * Math.log10(Math.max(rms, 0.00001))), peak };
}

export type InputHealth = 'waiting' | 'receiving' | 'quiet' | 'stalled';

export function inputHealth(now: number, startedAt: number, lastAudioAt: number, lastSoundAt: number): InputHealth {
  if (now - (lastAudioAt || startedAt) > 2000) return 'stalled';
  if (!lastAudioAt) return 'waiting';
  if (now - (lastSoundAt || startedAt) > 3000) return 'quiet';
  return 'receiving';
}
