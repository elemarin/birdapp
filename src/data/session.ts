export type SessionStatus = 'running' | 'paused' | 'interrupted' | 'ended';
export type Session = {
  id: string;
  startedAt: number;
  updatedAt: number;
  endedAt: number | null;
  listeningMs: number;
  activeStartedAt: number | null;
  status: SessionStatus;
  trackEnabled: boolean;
  segment: number;
};
export type TrackPoint = {
  sessionId: string;
  at: number;
  latitude: number;
  longitude: number;
  accuracy: number;
  segment: number;
};
export type Encounter = {
  id: string;
  sessionId: string;
  scientific: string;
  common: string;
  modelIndex: number;
  firstHeard: number;
  lastHeard: number;
  best: number;
  segment: number;
  latitude: number | null;
  longitude: number | null;
  accuracy: number | null;
};
export type BirdSummary = {
  scientific: string;
  common: string;
  modelIndex: number;
  count: number;
  best: number;
  firstHeard: number;
  lastHeard: number;
};
export type SessionSummary = Session & { speciesCount: number; encounterCount: number };
export type Preferences = {
  language: 'system' | 'en' | 'es';
  name: string;
  avatar: number;
  trackEnabled: boolean;
  filterEnabled: boolean;
};
export const defaultPreferences: Preferences = {
  language: 'system', name: '', avatar: 0, trackEnabled: false, filterEnabled: true,
};

export function listeningTime(session: Session, now: number) {
  return session.listeningMs + (session.activeStartedAt === null ? 0 : Math.max(0, now - session.activeStartedAt));
}

export function pauseSession(session: Session, at: number): Session {
  return { ...session, listeningMs: listeningTime(session, at), activeStartedAt: null, status: 'paused', updatedAt: at };
}

export function resumeSession(session: Session, at: number): Session {
  if (session.status === 'ended') throw new Error('Cannot resume an ended session.');
  if (session.activeStartedAt !== null) return session;
  return { ...session, status: 'running', activeStartedAt: at, updatedAt: at, segment: session.segment + 1 };
}

export function usableFix(point: TrackPoint | null, now: number, session: Session): TrackPoint | null {
  if (!point || point.sessionId !== session.id || point.segment !== session.segment ||
      now - point.at > 60000 || point.at > now + 5000 || point.at < (session.activeStartedAt ?? session.startedAt) ||
      !Number.isFinite(point.latitude) || Math.abs(point.latitude) > 90 ||
      !Number.isFinite(point.longitude) || Math.abs(point.longitude) > 180 ||
      !Number.isFinite(point.accuracy) || point.accuracy < 0 || point.accuracy > 100) return null;
  return point;
}

export function recordEncounter(
  previous: Encounter | undefined, session: Session,
  bird: { index: number; scientific: string; common: string }, confidence: number, at: number, point: TrackPoint | null,
): Encounter {
  if (!Number.isFinite(confidence) || confidence < 0.5 || confidence > 1) throw new Error('Invalid accepted prediction.');
  const same = previous && previous.segment === session.segment && at - previous.lastHeard <= 4000;
  if (same) return { ...previous, lastHeard: at, best: Math.max(previous.best, confidence) };
  const fix = usableFix(point, at, session);
  return {
    id: `${session.id}:${bird.scientific}:${at}`, sessionId: session.id,
    scientific: bird.scientific, common: bird.common, modelIndex: bird.index,
    firstHeard: at, lastHeard: at, best: confidence, segment: session.segment,
    latitude: fix?.latitude ?? null, longitude: fix?.longitude ?? null, accuracy: fix?.accuracy ?? null,
  };
}

export function summarizeBirds(encounters: Encounter[]): BirdSummary[] {
  const birds = new Map<string, BirdSummary>();
  for (const e of encounters) {
    const old = birds.get(e.scientific);
    birds.set(e.scientific, {
      scientific: e.scientific, common: e.common, modelIndex: e.modelIndex,
      count: (old?.count ?? 0) + 1, best: Math.max(old?.best ?? 0, e.best),
      firstHeard: Math.min(old?.firstHeard ?? e.firstHeard, e.firstHeard),
      lastHeard: Math.max(old?.lastHeard ?? e.lastHeard, e.lastHeard),
    });
  }
  return [...birds.values()].sort((a, b) => b.lastHeard - a.lastHeard);
}

export function parsePreferences(raw: string): Preferences {
  const value: unknown = JSON.parse(raw);
  if (!value || typeof value !== 'object' ||
      !('language' in value) || !['system', 'en', 'es'].includes(String(value.language)) ||
      !('name' in value) || typeof value.name !== 'string' ||
      !('avatar' in value) || !Number.isInteger(value.avatar) || Number(value.avatar) < 0 || Number(value.avatar) > 3 ||
      !('trackEnabled' in value) || typeof value.trackEnabled !== 'boolean' ||
      !('filterEnabled' in value) || typeof value.filterEnabled !== 'boolean') throw new Error('Invalid local preferences.');
  return { language: value.language as Preferences['language'], name: value.name.slice(0, 60),
    avatar: Number(value.avatar), trackEnabled: value.trackEnabled, filterEnabled: value.filterEnabled };
}
