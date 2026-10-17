import { useCallback, useState } from 'react';
import { Link, router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { ActivityIndicator, Platform, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { species } from '@/birdnet/birdnet';
import { BirdSticker } from '@/components/BirdSticker';
import { Button, Card, Stat, ui } from '@/components/ui';
import { listBirds, loadEncounters } from '@/data/database';
import { summarizeBirds, type BirdSummary } from '@/data/session';
import { useBirdSession } from '@/hooks/useBirdSession';
import { useTranslation } from '@/i18n';
import { colors } from '@/theme';

export default function BirdDetails() {
  const { id, sessionId } = useLocalSearchParams<{ id: string; sessionId?: string }>();
  const { t, locale, language, birdName } = useTranslation();
  const active = useBirdSession();
  const [bird, setBird] = useState<BirdSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);
  const insets = useSafeAreaInsets();
  const scientific = typeof id === 'string' && /^\d+$/.test(id) ? species[Number(id)]?.scientific : id;
  useFocusEffect(useCallback(() => {
    void retry;
    let alive = true;
    setError(null); setLoading(true);
    const load = async () => {
      if (typeof scientific !== 'string') throw new Error('Invalid bird ID');
      const result = sessionId ? summarizeBirds(await loadEncounters(sessionId)).find(b => b.scientific === scientific)
        : (await listBirds('', 0, scientific))[0];
      if (alive) setBird(result ?? null);
    };
    void load().catch((e: unknown) => { console.warn('Bird details failed', e); if (alive) setError(String(e)); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [scientific, sessionId, retry]));
  const live = active.current?.id === sessionId ? active.birds.find(b => b.scientific === scientific) : null;
  const value = live ?? bird;
  const close = () => router.canGoBack() ? router.back() : router.replace('/');
  return <ScrollView style={ui.screen} contentContainerStyle={[ui.content, { paddingBottom: insets.bottom + 24 }]}>
    {Platform.OS === 'android' && <View style={{ alignSelf: 'center', width: 36, height: 4, borderRadius: 2, backgroundColor: colors.line }} />}
    <View style={[ui.row, { flexWrap: 'nowrap' }]}>
      {value && <BirdSticker name={value.scientific} compact />}
      <View style={{ flex: 1 }}><Text style={ui.heading}>{value ? birdName(value) : t('birdNotFound')}</Text>
        {value && language === 'en' && <Text style={ui.note}>{value.scientific}</Text>}</View>
      <Button label={t('close')} onPress={close} secondary />
    </View>
    {loading && <ActivityIndicator color={colors.accent} />}
    {error && <><Text style={ui.error}>{t('loadFailed')}: {error}</Text><Button label={t('retry')} onPress={() => setRetry(v => v + 1)} /></>}
    {!loading && !error && !value && <Text style={ui.note}>{t('notFound')}</Text>}
    {value && <>
      <Card><View style={ui.row}><Stat value={`${Math.round(value.best * 100)}%`} label={t('confidence')} /><Stat value={value.count} label={t('encounters')} /></View></Card>
      <Text style={ui.body}>{t('first')}: {new Date(value.firstHeard).toLocaleString(locale)}</Text>
      <Text style={ui.body}>{t('latest')}: {new Date(value.lastHeard).toLocaleString(locale)}</Text>
      <Card><Text style={ui.note}>{t('audioCaveat')} {t('boutCaveat')}</Text></Card>
      {language === 'es' && <Text style={ui.note}>{t('scientificFallback')}</Text>}
      <Text style={ui.note}>{t('artwork')}</Text>
      <Link href={`https://${language}.wikipedia.org/wiki/Special:Search?search=${encodeURIComponent(value.scientific)}`}
        style={{ color: colors.accent, paddingVertical: 16, fontWeight: '700' }}>{t('wikipedia')}</Link>
      <Text style={ui.note}>{t('needsInternet')}</Text>
    </>}
  </ScrollView>;
}
