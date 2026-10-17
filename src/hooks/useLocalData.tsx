import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';

import { loadPreferences, savePreferences } from '@/data/database';
import { defaultPreferences, type Preferences } from '@/data/session';
import { colors } from '@/theme';

function useData() {
  const [preferences, setPreferences] = useState(defaultPreferences);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const current = useRef(preferences);
  const queue = useRef(Promise.resolve());
  const [revision, setRevision] = useState(0);
  const refresh = useCallback(() => setRevision(value => value + 1), []);
  const initialize = useCallback(() => loadPreferences().then(saved => {
      current.current = saved;
      setPreferences(saved);
      setReady(true);
      setError(null);
    }).catch((e: unknown) => {
      console.warn('Local data initialization failed', e);
      setError(e instanceof Error ? e.message : String(e));
    }), []);
  useEffect(() => { void initialize(); }, [initialize]);
  const updatePreferences = useCallback((patch: Partial<Preferences>) => {
    const next = queue.current.then(async () => {
      const updated = { ...current.current, ...patch };
      await savePreferences(updated);
      current.current = updated;
      setPreferences(updated);
    });
    queue.current = next.catch((e: unknown) => { console.warn('Preferences save failed', e); });
    return next;
  }, []);
  return { preferences, updatePreferences, ready, error, initialize, revision, refresh };
}
const Context = createContext<ReturnType<typeof useData> | null>(null);
export function LocalDataProvider({ children }: { children: ReactNode }) {
  const data = useData();
  if (!data.ready) return <View style={{ flex: 1, justifyContent: 'center', padding: 30, backgroundColor: colors.bg, gap: 20 }}>
    {data.error ? <>
      <Text style={{ color: colors.danger }}>Could not open local history / No se pudo abrir el historial: {data.error}</Text>
      <Pressable accessibilityRole="button" onPress={data.initialize} style={{ padding: 16 }}>
        <Text>Retry / Reintentar</Text>
      </Pressable>
    </> : <ActivityIndicator color={colors.accent} />}
  </View>;
  return <Context value={data}>{children}</Context>;
}
export function useLocalData() {
  const value = useContext(Context);
  if (!value) throw new Error('Local data provider missing.');
  return value;
}
