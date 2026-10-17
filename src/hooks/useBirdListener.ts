import * as Haptics from 'expo-haptics';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { AudioManager, AudioRecorder } from 'react-native-audio-api';
import { useSharedValue } from 'react-native-reanimated';

import { RingBuffer, loudness, resample } from '@/audio/buffer';
import { inputHealth, measureAudio, type InputHealth } from '@/audio/diagnostics';
import { requestForegroundRecordingPermission, shouldPauseRecording } from '@/audio/foreground';
import { LOCATION_THRESHOLD, SAMPLE_RATE, WINDOW_SAMPLES, loadAudioModel, predict, species, type Species } from '@/birdnet/birdnet';
import { rankPredictions, type Candidate } from '@/birdnet/results';

const HOP_SAMPLES = SAMPLE_RATE;
const NEW_BOUT_MS = 4000;

export type Status = 'idle' | 'starting' | 'warming' | 'listening' | 'error';
export type Detection = {
  species: Species;
  confidence: number;
  best: number;
  count: number;
  firstHeard: number;
  lastHeard: number;
};

export type AudioDiagnostics = {
  db: number;
  peak: number;
  history: number[];
  samples: number;
  sampleRate: number;
  health: InputHealth;
  checks: number;
  lastCheckAt: number;
  inferenceMs: number;
  inferenceStalled: boolean;
  strongest: Candidate | null;
};

function emptyDiagnostics(): AudioDiagnostics {
  return {
    db: -100, peak: 0, history: [], samples: 0, sampleRate: 0, health: 'waiting',
    checks: 0, lastCheckAt: 0, inferenceMs: 0, inferenceStalled: false, strongest: null,
  };
}

export function useBirdListener(locationScores: Float32Array | null) {
  const [status, setStatus] = useState<Status>('idle');
  const [error, setError] = useState<string | null>(null);
  const [pauseReason, setPauseReason] = useState<string | null>(null);
  const [detections, setDetections] = useState<Detection[]>([]);
  const [warmup, setWarmup] = useState(0);
  const [diagnostics, setDiagnostics] = useState(emptyDiagnostics);
  const level = useSharedValue(0);
  const recorder = useRef<AudioRecorder | null>(null);
  const ring = useRef(new RingBuffer(WINDOW_SAMPLES));
  const sinceLast = useRef(0);
  const busy = useRef(false);
  const active = useRef(false);
  const starting = useRef(false);
  const requestingPermission = useRef(false);
  const keepAwake = useRef(false);
  const stopping = useRef<Promise<void> | null>(null);
  const session = useRef(0);
  const found = useRef(new Map<number, Detection>());
  const scores = useRef(locationScores);
  const stats = useRef(emptyDiagnostics());
  const timing = useRef({ startedAt: 0, lastAudioAt: 0, lastSoundAt: 0, inferenceAt: 0 });
  useEffect(() => { scores.current = locationScores; }, [locationScores]);

  const publish = useCallback(() => {
    setDetections([...found.current.values()].sort((a, b) => b.lastHeard - a.lastHeard));
  }, []);

  const stop = useCallback((reason = 'Listening stopped. Tap to start again.'): Promise<void> => {
    if (stopping.current) return stopping.current;
    active.current = false;
    session.current++;
    level.set(0);
    setPauseReason(reason);
    setStatus('idle');
    const cleanup = async () => {
      try {
        const r = recorder.current;
        r?.clearOnAudioReady();
        r?.clearOnError();
        if (r?.isRecording()) {
          const result = await r.stop();
          if (result.status === 'error') throw new Error(result.message);
        }
      } finally {
        try {
          await AudioManager.setAudioSessionActivity(false);
        } finally {
          if (keepAwake.current) {
            keepAwake.current = false;
            await deactivateKeepAwake('listening');
          }
        }
      }
    };
    stopping.current = cleanup().catch((e: unknown) => {
      console.warn('Could not stop audio capture', e);
      setError(e instanceof Error ? e.message : String(e));
      setStatus('error');
      throw e;
    }).finally(() => { stopping.current = null; });
    return stopping.current;
  }, [level]);

  const fail = useCallback(async (e: unknown, token: number) => {
    if (token !== session.current) return;
    console.warn('BirdNET listening failed', e);
    const cleanup = stop();
    const failureSession = session.current;
    try {
      await cleanup;
    } catch {
      // stop() already reports its cleanup error; retain the original capture failure too.
    }
    if (failureSession === session.current) {
      setError(e instanceof Error ? e.message : String(e));
      setStatus('error');
    }
  }, [stop]);

  const analyze = useCallback(async (token: number) => {
    busy.current = true;
    sinceLast.current = 0;
    const startedAt = Date.now();
    timing.current.inferenceAt = startedAt;
    try {
      const probs = await predict(ring.current.snapshot());
      if (!active.current || token !== session.current) return;
      const now = Date.now();
      const { strongest, accepted } = rankPredictions(probs, species, scores.current, LOCATION_THRESHOLD);
      stats.current.checks++;
      stats.current.lastCheckAt = now;
      stats.current.inferenceMs = now - startedAt;
      stats.current.strongest = strongest;
      let isNew = false;
      for (const { species: sp, confidence } of accepted) {
        const prev = found.current.get(sp.index);
        if (!prev) isNew = true;
        found.current.set(sp.index, {
          species: sp, confidence, best: Math.max(prev?.best ?? 0, confidence),
          count: !prev ? 1 : now - prev.lastHeard > NEW_BOUT_MS ? prev.count + 1 : prev.count,
          firstHeard: prev?.firstHeard ?? now, lastHeard: now,
        });
      }
      setStatus('listening');
      publish();
      if (isNew) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
          .catch((e: unknown) => console.warn('Detection haptic failed', e));
      }
    } catch (e) {
      await fail(e, token);
    } finally {
      busy.current = false;
      if (token === session.current) timing.current.inferenceAt = 0;
    }
  }, [fail, publish]);

  const start = useCallback(async () => {
    if (active.current) return;
    if (starting.current || busy.current) {
      setError('Audio is still finishing. Wait a moment, then try again.');
      setStatus('error');
      return;
    }
    starting.current = true;
    const token = ++session.current;
    setError(null);
    setPauseReason(null);
    setStatus('starting');
    try {
      if (stopping.current) await stopping.current;
      requestingPermission.current = true;
      try {
        const permission = await requestForegroundRecordingPermission(
          AppState, () => AudioManager.requestRecordingPermissions(),
        );
        if (permission !== 'Granted') throw new Error('Microphone access is needed to hear birds.');
      } finally {
        requestingPermission.current = false;
      }
      if (token !== session.current) return;
      await loadAudioModel();
      if (token !== session.current) return;
      if (AppState.currentState !== 'active') throw new Error('Return to Birdsong and tap the microphone again.');
      AudioManager.setAudioSessionOptions({ iosCategory: 'record', iosMode: 'measurement', iosOptions: [] });
      await AudioManager.setAudioSessionActivity(true);
      if (token !== session.current) {
        await AudioManager.setAudioSessionActivity(false);
        return;
      }
      const r = (recorder.current ??= new AudioRecorder());
      ring.current.reset();
      sinceLast.current = 0;
      stats.current = emptyDiagnostics();
      timing.current = { startedAt: Date.now(), lastAudioAt: 0, lastSoundAt: 0, inferenceAt: 0 };
      setDiagnostics(emptyDiagnostics());
      setWarmup(0);
      r.onError((e) => { void fail(new Error(e.message), token); });
      const cb = r.onAudioReady({ sampleRate: SAMPLE_RATE, bufferLength: SAMPLE_RATE / 10, channelCount: 1 }, (e) => {
        if (!active.current || token !== session.current) return;
        try {
          const chunk = resample(e.buffer.getChannelData(0), e.buffer.sampleRate, SAMPLE_RATE);
          const { db, peak } = measureAudio(chunk);
          const now = Date.now();
          timing.current.lastAudioAt = now;
          if (db > -65) timing.current.lastSoundAt = now;
          const s = stats.current;
          s.db = db;
          s.peak = peak;
          s.samples += chunk.length;
          s.sampleRate = e.buffer.sampleRate;
          s.history = [...s.history.slice(-29), Math.max(0, Math.min(1, (db + 65) / 65))];
          ring.current.push(chunk);
          sinceLast.current += chunk.length;
          level.set(loudness(chunk));
          if (ring.current.filled === WINDOW_SAMPLES && sinceLast.current >= HOP_SAMPLES && !busy.current) {
            void analyze(token);
          }
        } catch (e) {
          void fail(e, token);
        }
      });
      if (cb.status === 'error') throw new Error(cb.message);
      active.current = true;
      const result = await r.start();
      if (result.status === 'error') throw new Error(result.message);
      if (token !== session.current) {
        if (r.isRecording()) {
          const stopped = await r.stop();
          if (stopped.status === 'error') throw new Error(stopped.message);
        }
        return;
      }
      await activateKeepAwakeAsync('listening');
      keepAwake.current = true;
      if (token === session.current) setStatus('warming');
      else {
        keepAwake.current = false;
        await deactivateKeepAwake('listening');
      }
    } catch (e) {
      await fail(e, token);
    } finally {
      starting.current = false;
    }
  }, [analyze, fail, level]);

  useEffect(() => {
    if (status !== 'warming' && status !== 'listening') return;
    const timer = setInterval(() => {
      const now = Date.now();
      const t = timing.current;
      setWarmup(ring.current.filled / WINDOW_SAMPLES);
      setDiagnostics({
        ...stats.current,
        health: inputHealth(now, t.startedAt, t.lastAudioAt, t.lastSoundAt),
        inferenceStalled: t.inferenceAt > 0 && now - t.inferenceAt > 5000,
      });
    }, 250);
    return () => clearInterval(timer);
  }, [status]);

  const snapshot = useCallback(() => {
    if (ring.current.filled < WINDOW_SAMPLES) throw new Error('Wait for 3 seconds of microphone audio first.');
    return ring.current.snapshot();
  }, []);

  const clear = useCallback(() => { found.current.clear(); publish(); }, [publish]);

  useEffect(() => {
    const end = () => {
      void stop('Listening paused when the app left the foreground. Tap to start again.')
        .catch((e: unknown) => console.warn('Audio cleanup failed', e));
    };
    const sub = AppState.addEventListener('change', (state) => {
      if (shouldPauseRecording(state, active.current, starting.current, requestingPermission.current)) end();
    });
    return () => { sub.remove(); end(); };
  }, [stop]);

  return { status, error, pauseReason, detections, warmup, level, diagnostics, snapshot, start, stop, clear };
}
