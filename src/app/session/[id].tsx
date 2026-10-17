import { useCallback, useState } from 'react';
import { useFocusEffect, useLocalSearchParams, router } from 'expo-router';
import { ActivityIndicator, FlatList, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { RouteTrace } from '@/components/RouteTrace';
import { SavedBirdRow } from '@/components/SavedBirdRow';
import { Button, Card, duration, Stat, ui } from '@/components/ui';
import { loadEncounters, loadSession, loadTrack } from '@/data/database';
import { listeningTime, summarizeBirds, type Encounter, type Session, type TrackPoint } from '@/data/session';
import { useBirdSession } from '@/hooks/useBirdSession';
import { useTranslation } from '@/i18n';
import { colors } from '@/theme';

export default function SessionDetails() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t, locale, birdName } = useTranslation();
  const active = useBirdSession();
  const insets = useSafeAreaInsets();
  const [data, setData] = useState<{ session: Session | null; encounters: Encounter[]; points: TrackPoint[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);
  useFocusEffect(useCallback(() => {
    void retry;
    let alive = true;
    setError(null); setData(null);
    if (typeof id !== 'string') { setError('Invalid session ID'); return; }
    void Promise.all([loadSession(id), loadEncounters(id), loadTrack(id)]).then(([session, encounters, points]) => {
      if (alive) setData({ session, encounters, points });
    }).catch((e: unknown) => { console.warn('Session details failed', e); if (alive) setError(String(e)); });
    return () => { alive = false; };
  }, [id, retry]));
  const s = active.current?.id === id ? active.current : data?.session;
  const encounters = active.current?.id === id ? active.encounters : data?.encounters ?? [];
  const birds = summarizeBirds(encounters);
  const close = () => router.canGoBack() ? router.back() : router.replace('/history');
  const time = (at: number) => new Date(at).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  return <View style={[ui.screen, { paddingTop: insets.top + 8 }]}>
    <FlatList data={encounters} keyExtractor={item => item.id} contentContainerStyle={ui.content}
      ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
      ListHeaderComponent={<View style={{ gap: 16, marginBottom: 12 }}>
        <View style={[ui.row, { justifyContent: 'space-between' }]}><Text style={ui.title}>{t('summary')}</Text><Button label={t('close')} onPress={close} secondary /></View>
        {error ? <><Text style={ui.error}>{t('loadFailed')}: {error}</Text><Button label={t('retry')} onPress={() => setRetry(v => v + 1)} /></>
          : !data ? <ActivityIndicator color={colors.accent} /> : !s ? <Text style={ui.note}>{t('notFound')}</Text> : <>
            <Text style={ui.body}>{new Date(s.startedAt).toLocaleString(locale)}</Text>
            <Card><View style={ui.row}><Stat value={birds.length} label={t('species')} /><Stat value={encounters.length} label={t('encounters')} /></View>
              <View style={ui.row}>
                <Stat value={duration(listeningTime(s, active.now))} label={t('listeningTime')} />
                <Stat value={duration((s.endedAt ?? (s.status === 'interrupted' ? s.updatedAt : active.now)) - s.startedAt)} label={t('duration')} />
              </View>
              <Text style={ui.note}>{t(s.status === 'running' ? 'running' : s.status === 'paused' ? 'paused' : s.status === 'interrupted' ? 'interrupted' : 'ended')}</Text>
            </Card>
            <Text style={ui.heading}>{t('allBirds')}</Text>
            {birds.map(bird => <SavedBirdRow key={bird.scientific} bird={bird} sessionId={s.id} />)}
            {s.trackEnabled && <RouteTrace points={data.points} encounters={encounters} />}
            <Text style={ui.note}>{t('audioCaveat')} {t('boutCaveat')}</Text>
            <Text style={ui.heading}>{t('timeline')}</Text>
          </>}
      </View>}
      renderItem={({ item }) => <View style={[ui.card, { padding: 14 }]}>
        <Text style={[ui.body, { fontWeight: '700' }]}>{birdName(item)}</Text>
        <Text style={ui.note}>{time(item.firstHeard)} – {time(item.lastHeard)} · {Math.round(item.best * 100)}%</Text>
        {item.accuracy !== null && <Text style={ui.note}>{t('GPS')}: {item.latitude?.toFixed(4)}, {item.longitude?.toFixed(4)} · ±{Math.round(item.accuracy)} m</Text>}
      </View>} />
  </View>;
}
