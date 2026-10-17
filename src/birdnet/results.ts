import type { Species } from './birdnet';

export const MIN_CONFIDENCE = 0.5;

export type Candidate = {
  species: Species;
  confidence: number;
  reason: 'accepted' | 'confidence' | 'location';
};

export function rankPredictions(
  probabilities: Float32Array,
  labels: readonly (Species | null)[],
  location: Float32Array | null,
  locationThreshold: number,
) {
  if (probabilities.length !== labels.length) throw new Error('BirdNET returned the wrong number of scores.');
  if (location && (location.length !== labels.length || location.some((value) => !Number.isFinite(value)))) {
    throw new Error('BirdNET returned invalid location scores.');
  }
  let strongest: Candidate | null = null;
  const accepted: Candidate[] = [];
  for (let i = 0; i < probabilities.length; i++) {
    const confidence = probabilities[i];
    if (!Number.isFinite(confidence) || confidence < 0 || confidence > 1) {
      throw new Error('BirdNET returned an invalid confidence score.');
    }
    const species = labels[i];
    if (!species) continue;
    const reason = confidence < MIN_CONFIDENCE ? 'confidence'
      : location && location[i] < locationThreshold ? 'location' : 'accepted';
    const candidate: Candidate = { species, confidence, reason };
    if (!strongest || confidence > strongest.confidence) strongest = candidate;
    if (reason === 'accepted') accepted.push(candidate);
  }
  return { strongest, accepted };
}
