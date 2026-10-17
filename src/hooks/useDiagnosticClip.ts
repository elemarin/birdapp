import { File, Paths } from 'expo-file-system';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { AudioContext, AudioManager, type AudioBufferSourceNode } from 'react-native-audio-api';

import { encodeWav } from '@/audio/wav';
import { SAMPLE_RATE } from '@/birdnet/birdnet';

const clipFile = () => new File(Paths.document, 'birdsong-diagnostic.wav');

export function useDiagnosticClip(snapshot: () => Float32Array, stopListening: () => Promise<void>) {
  const [initial] = useState(() => {
    try {
      const file = clipFile();
      return { savedAt: file.exists ? file.modificationTime ?? Date.now() : null, error: null };
    } catch (e) {
      return { savedAt: null, error: e instanceof Error ? e.message : String(e) };
    }
  });
  const [savedAt, setSavedAt] = useState<number | null>(initial.savedAt);
  const [playing, setPlaying] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(initial.error);
  const context = useRef<AudioContext | null>(null);
  const source = useRef<AudioBufferSourceNode | null>(null);
  const generation = useRef(0);
  const locked = useRef(false);

  const report = useCallback((e: unknown) => {
    console.warn('Diagnostic clip failed', e);
    setError(e instanceof Error ? e.message : String(e));
  }, []);

  const stopPlayback = useCallback(async () => {
    generation.current++;
    const currentSource = source.current;
    const currentContext = context.current;
    source.current = null;
    context.current = null;
    setPlaying(false);
    try {
      if (currentSource) {
        currentSource.onEnded = null;
        currentSource.stop();
      }
    } finally {
      if (currentContext) {
        try {
          await currentContext.close();
        } finally {
          await AudioManager.setAudioSessionActivity(false);
        }
      }
    }
  }, []);

  const run = useCallback(async (action: () => Promise<void> | void) => {
    if (locked.current) return;
    locked.current = true;
    setBusy(true);
    setError(null);
    try {
      await action();
    } catch (e) {
      report(e);
    } finally {
      locked.current = false;
      setBusy(false);
    }
  }, [report]);

  const save = useCallback(() => run(async () => {
    const bytes = encodeWav(snapshot(), SAMPLE_RATE);
    await stopPlayback();
    const file = clipFile();
    file.write(bytes);
    setSavedAt(file.modificationTime ?? Date.now());
  }), [run, snapshot, stopPlayback]);

  const play = useCallback(() => run(async () => {
    await stopPlayback();
    const token = generation.current;
    await stopListening();
    if (token !== generation.current || AppState.currentState !== 'active') return;
    const file = clipFile();
    if (!file.exists) throw new Error('Save a diagnostic clip first.');
    const bytes = await file.bytes();
    if (token !== generation.current) return;
    AudioManager.setAudioSessionOptions({ iosCategory: 'playback', iosMode: 'default', iosOptions: [] });
    const audio = new AudioContext({ sampleRate: SAMPLE_RATE });
    context.current = audio;
    try {
      const buffer = await audio.decodeAudioData(bytes.buffer);
      if (token !== generation.current) return;
      await AudioManager.setAudioSessionActivity(true);
      if (token !== generation.current) {
        await AudioManager.setAudioSessionActivity(false);
        return;
      }
      await audio.resume();
      if (token !== generation.current) return;
      const node = audio.createBufferSource();
      node.buffer = buffer;
      node.connect(audio.destination);
      node.onEnded = () => {
        if (token !== generation.current) return;
        source.current = null;
        void stopPlayback().catch(report);
      };
      source.current = node;
      node.start();
      setPlaying(true);
    } catch (e) {
      await stopPlayback();
      throw e;
    }
  }), [run, stopListening, stopPlayback, report]);

  const remove = useCallback(() => run(async () => {
    await stopPlayback();
    const file = clipFile();
    if (file.exists) file.delete();
    setSavedAt(null);
  }), [run, stopPlayback]);

  useEffect(() => {
    const end = () => { void stopPlayback().catch(report); };
    const subscription = AppState.addEventListener('change', (state) => {
      if (state !== 'active') end();
    });
    return () => { subscription.remove(); end(); };
  }, [report, stopPlayback]);

  const stopReplay = useCallback(() => run(stopPlayback), [run, stopPlayback]);

  return { savedAt, playing, busy, error, save, play, remove, stopReplay, stopPlayback };
}
