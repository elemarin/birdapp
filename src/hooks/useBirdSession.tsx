import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { AppState } from 'react-native';
import * as Location from 'expo-location';

import * as store from '@/data/database';
import { pauseSession, recordEncounter, resumeSession, summarizeBirds, usableFix, type Encounter, type Session, type TrackPoint } from '@/data/session';
import { useBirdListener } from '@/hooks/useBirdListener';
import { useDiagnosticClip } from '@/hooks/useDiagnosticClip';
import { useLocalData } from '@/hooks/useLocalData';
import { useLocationFilter } from '@/hooks/useLocationFilter';

function useSession() {
  const { preferences, refresh } = useLocalData();
  const location = useLocationFilter(preferences.filterEnabled);
  const [current, setCurrent] = useState<Session | null>(null);
  const currentRef = useRef<Session | null>(null);
  const encountersRef = useRef(new Map<string, Encounter>());
  const [encounters, setEncounters] = useState<Encounter[]>([]);
  const lastEncounter = useRef(new Map<string, Encounter>());
  const pending = useRef(new Map<string, Encounter>());
  const pendingPoints = useRef<TrackPoint[]>([]);
  const fix = useRef<TrackPoint | null>(null);
  const [ready, setReady] = useState(false);
  const [savingError, setSavingError] = useState<string | null>(null);
  const [gpsError, setGpsError] = useState<'waiting' | 'denied' | string | null>(null);
  const [changing, setChanging] = useState(false);
  const lock = useRef(false);
  const endedRef = useRef(false);
  const [now, setNow] = useState(Date.now);

  const publish = useCallback((value: Session | null) => {
    currentRef.current = value;
    setCurrent(value);
  }, []);
  const report = useCallback((e: unknown) => {
    console.warn('Session persistence failed', e);
    setSavingError(e instanceof Error ? e.message : String(e));
  }, []);
  const flush = useCallback(async () => {
    const s = currentRef.current;
    if (!s) return;
    const changed = [...pending.current.values()];
    const points = [...pendingPoints.current];
    await store.saveSession(s, changed, points);
    for (const e of changed) if (pending.current.get(e.id) === e) pending.current.delete(e.id);
    const flushed = new Set(points);
    pendingPoints.current = pendingPoints.current.filter(p => !flushed.has(p));
    setSavingError(null);
  }, []);
  const persist = useCallback(() => { void flush().catch(report); }, [flush, report]);

  const pause = useCallback(() => {
    const s = currentRef.current;
    if (!s || s.status !== 'running') return;
    publish(pauseSession(s, Date.now()));
    fix.current = null;
    persist();
    refresh();
  }, [persist, publish, refresh]);

  const listener = useBirdListener(location.scores, {
    onStarted: async () => {
      const s = currentRef.current;
      if (!s) throw new Error('No listening session.');
      publish(resumeSession(s, Date.now()));
      endedRef.current = false;
      await flush();
    },
    onStopped: pause,
    onMatches: (matches, at) => {
      const s = currentRef.current;
      if (!s || s.status !== 'running') return;
      for (const match of matches) {
        const encounter = recordEncounter(lastEncounter.current.get(match.species.scientific),
          s, match.species, match.confidence, at, fix.current);
        lastEncounter.current.set(match.species.scientific, encounter);
        encountersRef.current.set(encounter.id, encounter);
        pending.current.set(encounter.id, encounter);
      }
      if (matches.length) {
        setEncounters([...encountersRef.current.values()]);
        persist();
      }
    },
  });
  const clip = useDiagnosticClip(listener.snapshot, listener.stop);

  const restore = useCallback(() => store.loadOpenSession().then(async s => {
      const saved = s ? await store.loadEncounters(s.id) : [];
      encountersRef.current = new Map(saved.map(e => [e.id, e]));
      lastEncounter.current = new Map(saved.map(e => [e.scientific, e]));
      setEncounters(saved);
      publish(s);
      setReady(true);
      setSavingError(null);
    }).catch(report), [publish, report]);
  useEffect(() => { void restore(); }, [restore]);

  useEffect(() => {
    if (!current) return;
    const timer = setInterval(() => {
      setNow(Date.now());
      if (!endedRef.current && currentRef.current?.status === 'running') persist();
    }, 5000);
    return () => clearInterval(timer);
  }, [current, persist]);

  const recording = listener.status === 'warming' || listener.status === 'listening';
  useEffect(() => {
    if (!current?.trackEnabled || !recording || current.status !== 'running') return;
    const sessionId = current.id;
    const segment = current.segment;
    let disposed = false;
    let subscription: Location.LocationSubscription | null = null;
    fix.current = null;
    const start = async () => {
      const permission = await Location.getForegroundPermissionsAsync();
      if (!permission.granted) {
        if (!disposed) setGpsError('denied');
        return;
      }
      if (disposed) return;
      setGpsError('waiting');
      subscription = await Location.watchPositionAsync({
        accuracy: Location.Accuracy.Balanced, timeInterval: 10000, distanceInterval: 10,
      }, position => {
        const s = currentRef.current;
        if (disposed || AppState.currentState !== 'active' || !s || s.status !== 'running' || s.id !== sessionId) return;
        const point: TrackPoint = { sessionId, segment, at: position.timestamp, latitude: position.coords.latitude,
          longitude: position.coords.longitude, accuracy: position.coords.accuracy ?? Infinity };
        const accepted = usableFix(point, Date.now(), s);
        if (!accepted) return;
        fix.current = accepted;
        setGpsError(null);
        if (pendingPoints.current.some(p => p.at === point.at)) return;
        pendingPoints.current.push(accepted);
        persist();
      }, reason => {
        if (!disposed) { console.warn('Session GPS failed', reason); setGpsError(reason); }
      });
      if (disposed) subscription.remove();
    };
    void start().catch((e: unknown) => {
      if (!disposed) { console.warn('Session GPS failed', e); setGpsError(e instanceof Error ? e.message : String(e)); }
    });
    return () => { disposed = true; subscription?.remove(); fix.current = null; };
  }, [current?.id, current?.segment, current?.status, current?.trackEnabled, persist, recording]);

  const start = useCallback(async () => {
    if (lock.current || !ready) return;
    lock.current = true;
    setChanging(true);
    try {
      await clip.stopPlayback();
      if (preferences.trackEnabled && !currentRef.current) {
        try {
          const permission = await Location.requestForegroundPermissionsAsync();
          if (!permission.granted) setGpsError('denied');
        } catch (e) {
          console.warn('Session GPS permission failed', e);
          setGpsError(e instanceof Error ? e.message : String(e));
        }
      }
      if (!currentRef.current) {
        const at = Date.now();
        const s: Session = { id: `${at}-${Math.random().toString(36).slice(2, 12)}`, startedAt: at, updatedAt: at,
          endedAt: null, activeStartedAt: null, listeningMs: 0, status: 'paused', trackEnabled: preferences.trackEnabled, segment: 0 };
        await store.saveSession(s);
        encountersRef.current.clear(); lastEncounter.current.clear(); pending.current.clear(); pendingPoints.current = [];
        listener.clear();
        setEncounters([]);
        publish(s);
      }
      const started = await listener.start();
      if (!started && currentRef.current) {
        // Startup may have been cancelled before the recorder acquired resources.
        publish(pauseSession(currentRef.current, Date.now()));
        await flush();
      }
    } catch (e) { report(e); }
    finally { lock.current = false; setChanging(false); }
  }, [clip, flush, listener, preferences.trackEnabled, publish, ready, report]);

  const end = useCallback(async (): Promise<string | null> => {
    if (lock.current) return null;
    lock.current = true;
    setChanging(true);
    try {
      await listener.stop();
      await clip.stopPlayback();
      const s = currentRef.current;
      if (!s) return null;
      const ended: Session = { ...pauseSession(s, Date.now()), status: 'ended', endedAt: Date.now() };
      publish(ended);
      await flush();
      const hasBirds = encountersRef.current.size > 0;
      if (!hasBirds) await store.discardSession(s.id);
      endedRef.current = true;
      publish(null);
      fix.current = null;
      refresh();
      return hasBirds ? s.id : null;
    } catch (e) { report(e); throw e; }
    finally { lock.current = false; setChanging(false); }
  }, [clip, flush, listener, publish, refresh, report]);

  const birds = useMemo(() => summarizeBirds(encounters), [encounters]);
  return { location, listener, clip, current, encounters, birds,
    start, end, ready, changing, savingError, retrySave: ready ? persist : restore, gpsError, now };
}
const BirdSessionContext = createContext<ReturnType<typeof useSession> | null>(null);
export function BirdSessionProvider({ children }: { children: ReactNode }) {
  const session = useSession();
  return <BirdSessionContext value={session}>{children}</BirdSessionContext>;
}
export function useBirdSession() {
  const session = useContext(BirdSessionContext);
  if (!session) throw new Error('Bird session must be used inside the provider.');
  return session;
}
