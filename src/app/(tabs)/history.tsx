import { useCallback, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { SavedBirdRow } from '@/components/SavedBirdRow';
import { Button, duration, ui } from '@/components/ui';
import { listBirds, listSessions } from '@/data/database';
import { useHistoryQuery } from '@/hooks/useHistoryQuery';
import { useLocalData } from '@/hooks/useLocalData';
import { useTranslation } from '@/i18n';
import { colors } from '@/theme';

export default function History() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const [mode, setMode] = useState<'sessions' | 'allBirds'>('sessions');
  return <View style={[ui.screen, { paddingTop: insets.top + 12 }]}>
    <View style={{ paddingHorizontal: 20, gap: 14, paddingBottom: 12 }}>
      <Text style={ui.title}>{t('history')}</Text>
      <View style={ui.row}>
        <Button label={t('sessions')} onPress={() => setMode('sessions')} secondary={mode !== 'sessions'} />
        <Button label={t('allBirds')} onPress={() => setMode('allBirds')} secondary={mode !== 'allBirds'} />
      </View>
    </View>
    {mode === 'sessions' ? <SessionList /> : <BirdList />}
  </View>;
}
function SessionList() {
  const { t, locale } = useTranslation();
  const { revision } = useLocalData();
  const query = useCallback((offset: number) => { void revision; return listSessions(offset); }, [revision]);
  const data = useHistoryQuery(query, 30);
  return <FlatList data={data.rows} keyExtractor={item => item.id}
    contentContainerStyle={ui.content} ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
    renderItem={({ item, index }) => {
      const day = new Date(item.startedAt).toLocaleDateString(locale, { dateStyle: 'long' });
      const previousDay = data.rows[index - 1] && new Date(data.rows[index - 1].startedAt).toLocaleDateString(locale, { dateStyle: 'long' });
      return <View style={{ gap: 10 }}>
        {day !== previousDay && <Text style={ui.heading}>{day}</Text>}
        <Pressable accessibilityRole="button"
          onPress={() => router.push({ pathname: '/session/[id]', params: { id: item.id } })}
          style={({ pressed }) => [ui.card, { opacity: pressed ? 0.7 : 1 }]}>
          <View style={[ui.row, { justifyContent: 'space-between' }]}>
            <Text style={[ui.body, { fontWeight: '800' }]}>{new Date(item.startedAt).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })}</Text>
            <Text style={ui.note}>{t(item.status === 'running' ? 'running' : item.status === 'paused' ? 'paused' : item.status === 'interrupted' ? 'interrupted' : 'ended')}</Text>
          </View>
          <Text style={ui.note}>{item.speciesCount} {t('species')} · {item.encounterCount} {t('encounters')} · {duration(item.listeningMs)}</Text>
        </Pressable>
      </View>;
    }}
    ListEmptyComponent={!data.loading && !data.error ? <View style={ui.card}>
      <Text style={ui.heading}>{t('noHistory')}</Text><Text style={ui.note}>{t('noHistoryHint')}</Text>
    </View> : null}
    ListFooterComponent={<QueryFooter {...data} />} />;
}
function BirdList() {
  const { t, language } = useTranslation();
  const { revision } = useLocalData();
  const [search, setSearch] = useState('');
  const query = useCallback((offset: number) => { void revision; return listBirds(search.trim(), offset); }, [search, revision]);
  const data = useHistoryQuery(query, 40);
  return <View style={{ flex: 1 }}>
    <View style={{ paddingHorizontal: 20, gap: 10, paddingBottom: 12 }}>
      <TextInput accessibilityLabel={t('search')} placeholder={t('search')} value={search} onChangeText={setSearch}
        style={ui.input} placeholderTextColor={colors.muted} autoCorrect={false} />
      {language === 'es' && <Text style={ui.note}>{t('scientificFallback')}</Text>}
    </View>
    <FlatList data={data.rows} keyExtractor={item => item.scientific} contentContainerStyle={ui.content}
      ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
      renderItem={({ item }) => <SavedBirdRow bird={item} />}
      ListEmptyComponent={!data.loading && !data.error ? <Text style={ui.note}>{t('noBirds')}</Text> : null}
      ListFooterComponent={<QueryFooter {...data} />} />
  </View>;
}
function QueryFooter({ loading, error, retry, hasMore, more }: {
  loading: boolean; error: string | null; retry: () => void; hasMore: boolean; more: () => void;
}) {
  const { t } = useTranslation();
  return <View style={{ paddingVertical: 12, gap: 12 }}>
    {error && <><Text style={ui.error}>{t('loadFailed')}: {error}</Text><Button label={t('retry')} onPress={retry} /></>}
    {loading && <ActivityIndicator color={colors.accent} />}
    {hasMore && !loading && <Button label={t('loadMore')} onPress={more} secondary />}
  </View>;
}
