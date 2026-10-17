import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { Pressable, ScrollView, Switch, Text, TextInput, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button, Card, duration, Stat, ui } from '@/components/ui';
import { totals } from '@/data/database';
import type { Preferences } from '@/data/session';
import { useLocalData } from '@/hooks/useLocalData';
import { useTranslation } from '@/i18n';
import { colors } from '@/theme';

const avatars = ['bird', 'leaf', 'flower', 'pine-tree'] as const;
export default function Profile() {
  const { preferences, updatePreferences, revision } = useLocalData();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const [name, setName] = useState(preferences.name);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [stats, setStats] = useState<Awaited<ReturnType<typeof totals>>>(null);
  const load = useCallback(() => {
    let alive = true;
    void revision;
    void totals().then(value => { if (alive) setStats(value); }).catch((e: unknown) => {
      console.warn('Profile stats failed', e);
      if (alive) setError(String(e));
    });
    return () => { alive = false; };
  }, [revision]);
  useFocusEffect(load);
  const save = async (patch: Partial<Preferences>) => {
    setError(null); setSaved(false);
    try { await updatePreferences(patch); setSaved(true); }
    catch (e) { console.warn('Profile save failed', e); setError(e instanceof Error ? e.message : String(e)); }
  };
  return <ScrollView style={ui.screen} contentContainerStyle={[ui.content, { paddingTop: insets.top + 12 }]}>
    <Text style={ui.title}>{t('profile')}</Text>
    <Card>
      <View style={ui.row}>
        <MaterialCommunityIcons name={avatars[preferences.avatar]} size={50} color={colors.accent} />
        <View style={{ flex: 1 }}><Text style={ui.heading}>{preferences.name || t('explorer')}</Text><Text style={ui.note}>{t('localProfile')}</Text></View>
      </View>
      <Text style={ui.note}>{t('localOnly')}</Text>
      <Text style={ui.body}>{t('name')}</Text>
      <TextInput value={name} onChangeText={value => { setName(value); setSaved(false); }} maxLength={60} style={ui.input} accessibilityLabel={t('name')} />
      <Button label={t('save')} onPress={() => { void save({ name: name.trim() }); }} />
      <Text style={ui.body}>{t('avatar')}</Text>
      <View style={ui.row}>{avatars.map((avatar, index) => <Pressable key={avatar}
        accessibilityRole="button" accessibilityLabel={`${t('avatar')} ${index + 1}`}
        accessibilityState={{ selected: preferences.avatar === index }}
        onPress={() => { void save({ avatar: index }); }}
        style={{ minWidth: 48, minHeight: 48, alignItems: 'center', justifyContent: 'center', borderRadius: 14,
          backgroundColor: preferences.avatar === index ? colors.accent : colors.accentSoft }}>
        <MaterialCommunityIcons name={avatar} size={28} color={preferences.avatar === index ? '#fff' : colors.accent} />
      </Pressable>)}</View>
    </Card>
    {stats && <Card><View style={ui.row}>
      <Stat value={stats.sessions} label={t('sessions')} /><Stat value={stats.species} label={t('species')} />
      <Stat value={stats.encounters} label={t('encounters')} />
    </View><Text style={ui.note}>{t('listeningTime')}: {duration(stats.listeningMs)}</Text></Card>}
    <Card>
      <Text style={ui.heading}>{t('settings')}</Text>
      <Text style={ui.body}>{t('language')}</Text>
      <View style={ui.row}>{(['system', 'es', 'en'] as const).map(language => <Button key={language}
        label={language === 'system' ? t('system') : language === 'es' ? 'Español' : 'English'}
        secondary={preferences.language !== language} onPress={() => { void save({ language }); }} />)}</View>
      <View style={[ui.row, { flexWrap: 'nowrap', justifyContent: 'space-between' }]}>
        <Text style={[ui.body, { flex: 1 }]}>{t('routeSetting')}</Text>
        <Switch value={preferences.trackEnabled} accessibilityLabel={t('routeSetting')}
          onValueChange={trackEnabled => { void save({ trackEnabled }); }} trackColor={{ true: colors.accent }} />
      </View>
      <Text style={ui.note}>{t('routeHint')}</Text>
      <View style={[ui.row, { flexWrap: 'nowrap', justifyContent: 'space-between' }]}>
        <Text style={[ui.body, { flex: 1 }]}>{t('filterSetting')}</Text>
        <Switch value={preferences.filterEnabled} accessibilityLabel={t('filterSetting')}
          onValueChange={filterEnabled => { void save({ filterEnabled }); }} trackColor={{ true: colors.accent }} />
      </View>
      <Text style={ui.note}>{t('filterHint')}</Text>
    </Card>
    {saved && <Text style={ui.note}>{t('saved')}</Text>}
    {error && <><Text style={ui.error}>{t('actionError')}: {error}</Text><Button label={t('retry')} onPress={() => { load(); }} secondary /></>}
  </ScrollView>;
}
