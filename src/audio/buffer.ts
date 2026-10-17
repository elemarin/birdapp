/** Fixed-size circular buffer that always holds the most recent audio. */
export class RingBuffer {
  private data: Float32Array;
  private pos = 0;
  filled = 0;

  constructor(readonly size: number) {
    this.data = new Float32Array(size);
  }

  push(chunk: Float32Array) {
    const src = chunk.length > this.size ? chunk.subarray(chunk.length - this.size) : chunk;
    const first = Math.min(src.length, this.size - this.pos);
    this.data.set(src.subarray(0, first), this.pos);
    this.data.set(src.subarray(first), 0);
    this.pos = (this.pos + src.length) % this.size;
    this.filled = Math.min(this.size, this.filled + src.length);
  }

  /** Oldest-to-newest copy of the buffer. */
  snapshot() {
    const out = new Float32Array(this.size);
    out.set(this.data.subarray(this.pos));
    out.set(this.data.subarray(0, this.pos), this.size - this.pos);
    return out;
  }

  reset() {
    this.pos = 0;
    this.filled = 0;
    this.data.fill(0);
  }
}

export function resample(input: Float32Array, from: number, to: number) {
  if (from === to) return input;
  const ratio = from / to;
  const out = new Float32Array(Math.floor(input.length / ratio));
  for (let i = 0; i < out.length; i++) {
    const x = i * ratio;
    const j = Math.floor(x);
    const next = input[Math.min(j + 1, input.length - 1)];
    out[i] = input[j] + (next - input[j]) * (x - j);
  }
  return out;
}

/** Perceptual 0..1 loudness for UI feedback. */
export function loudness(chunk: Float32Array) {
  let sum = 0;
  for (let i = 0; i < chunk.length; i++) sum += chunk[i] * chunk[i];
  const rms = Math.sqrt(sum / Math.max(1, chunk.length));
  return Math.min(1, Math.sqrt(rms) * 2.5);
}
