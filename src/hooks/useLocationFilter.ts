import * as Location from 'expo-location';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Linking } from 'react-native';

import { LOCATION_THRESHOLD, locationScores } from '@/birdnet/birdnet';
import { formatCoordinates } from '@/birdnet/coordinates';

export type LocationState =
  | { status: 'locating' }
  | { status: 'denied'; canAskAgain: boolean; message: string }
  | { status: 'unavailable'; message: string }
  | { status: 'ready'; scores: Float32Array; speciesCount: number; coordinates: string };

async function withTimeout<T>(promise: Promise<T>, ms: number) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error('No GPS fix yet. Try again outside or near a window.')), ms);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}

async function findLocalSpecies(): Promise<LocationState> {
  try {
    const { granted, canAskAgain } = await Location.requestForegroundPermissionsAsync();
    if (!granted) return {
      status: 'denied', canAskAgain,
      message: canAskAgain ? 'Location permission denied. Tap to retry.' : 'Location permission denied. Tap to open settings.',
    };
    if (!await Location.hasServicesEnabledAsync()) {
      return { status: 'unavailable', message: 'Device location is off. Enable it, then tap to retry.' };
    }

    // GPS works without a data connection; a recent cached fix is good enough for species ranges.
    const pos =
      (await Location.getLastKnownPositionAsync({ maxAge: 6 * 60 * 60 * 1000 })) ??
      (await withTimeout(Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }), 20000));
    const coordinates = formatCoordinates(pos.coords.latitude, pos.coords.longitude);
    const scores = await locationScores(pos.coords.latitude, pos.coords.longitude);
    const speciesCount = scores.reduce((n, s) => (s >= LOCATION_THRESHOLD ? n + 1 : n), 0);
    return { status: 'ready', scores, speciesCount, coordinates };
  } catch (e) {
    console.warn('Location filter failed', e);
    return { status: 'unavailable', message: e instanceof Error ? e.message : String(e) };
  }
}

export function useLocationFilter(enabled = true) {
  const [state, setState] = useState<LocationState>({ status: 'locating' });
  const generation = useRef(0);
  const locating = useRef(false);

  const locate = useCallback(async () => {
    if (locating.current) return;
    locating.current = true;
    const token = ++generation.current;
    setState({ status: 'locating' });
    try {
      const result = await findLocalSpecies();
      if (token === generation.current) setState(result);
    } finally {
      locating.current = false;
    }
  }, []);

  const cancel = useCallback(() => { generation.current++; locating.current = false; }, []);
  useEffect(() => {
    if (enabled) void locate();
    return cancel;
  }, [cancel, enabled, locate]);

  const retry = useCallback(() => {
    if (state.status === 'denied' && !state.canAskAgain) {
      void Linking.openSettings().catch((e: unknown) => {
        console.warn('Could not open location settings', e);
        setState({ status: 'unavailable', message: 'Could not open settings. Enable location permission in Android or iOS settings, then retry.' });
      });
    } else {
      void locate();
    }
  }, [locate, state]);

  const scores = enabled && state.status === 'ready' ? state.scores : null;
  return { state, enabled, scores, retry };
}
