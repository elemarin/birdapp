import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, FadeOut, useReducedMotion } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AudioDiagnostics } from '@/components/AudioDiagnostics';
import { BirdSticker } from '@/components/BirdSticker';
import { ListenButton } from '@/components/ListenButton';
import { LocationChip } from '@/components/LocationChip';
import { Button, duration, ui } from '@/components/ui';
import { listeningTime } from '@/data/session';
import { useBirdSession } from '@/hooks/useBirdSession';
import { useLocalData } from '@/hooks/useLocalData';
import { useTranslation } from '@/i18n';
import { colors } from '@/theme';

export default function Listen() {
  const session = useBirdSession();
  const { listener, clip, current } = session;
  const { preferences, updatePreferences } = useLocalData();
  const { t, birdName, errorText } = useTranslation();
  const insets = useSafeAreaInsets();
  const reducedMotion = useReducedMotion();
  const [now, setNow] = useState(Date.now);
  const [actionError, setActionError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const recording = listener.status === 'warming' || listener.status === 'listening';
  const starting = listener.status === 'starting' || session.changing;
  useEffect(() => {
    if (!current) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [current]);
  const bubbles = recording ? session.birds.filter(b => now - b.lastHeard < 8000).slice(0, 3) : [];
  const act = async (operation: () => Promise<unknown>) => {
    setActionError(null); setNotice(null);
    try { await operation(); }
    catch (e) { console.warn('Listen action failed', e); setActionError(e instanceof Error ? e.message : String(e)); }
  };
  const end = () => act(async () => {
    const id = await session.end();
    if (id) router.push({ pathname: '/session/[id]', params: { id } });
    else setNotice(t('emptySession'));
  });
  const title = starting ? t('gettingReady') : recording ? t('waiting')
    : current ? t(current.status === 'interrupted' ? 'interrupted' : 'paused') : t('start');

  return <LinearGradient colors={[colors.bgTop, colors.bg]} style={ui.screen}>
    <ScrollView contentContainerStyle={[ui.content, { paddingTop: insets.top + 12 }]}>
      <View style={[ui.row, { justifyContent: 'space-between' }]}>
        <Text style={ui.title}>Birdsong<Text style={{ color: colors.live }}>.</Text></Text>
        <View style={styles.offline}><Ionicons name="leaf" size={12} color={colors.accent} /><Text style={styles.offlineText}>{t('offline')}</Text></View>
      </View>
      <LocationChip state={session.location.state} enabled={preferences.filterEnabled}
        onToggle={() => { void act(() => updatePreferences({ filterEnabled: !preferences.filterEnabled })); }}
        onRetry={session.location.retry} />
      <View style={styles.stage}>
        <View style={styles.orbit} />
        <View style={styles.mic}>
          <ListenButton status={listener.status} level={listener.level}
            label={t(recording ? 'end' : current ? 'resume' : 'start')}
            onPress={() => { void (recording ? end() : act(session.start)); }}
            disabled={!session.ready || starting || clip.busy} />
        </View>
        {bubbles.map((bird, index) => <Animated.View key={bird.scientific}
          entering={reducedMotion ? undefined : FadeIn.duration(220)}
          exiting={reducedMotion ? undefined : FadeOut.duration(180)}
          style={[styles.bubble, index === 0 ? styles.left : index === 1 ? styles.right : styles.bottom]}>
          <Pressable accessibilityRole="button" onPress={() => router.navigate({
            pathname: '/bird/[id]', params: { id: bird.scientific, sessionId: current?.id },
          })} style={styles.bubbleButton}>
            <BirdSticker name={bird.scientific} compact />
            <Text style={styles.bubbleName} numberOfLines={2}>{birdName(bird)}</Text>
          </Pressable>
        </Animated.View>)}
      </View>
      <Text style={[ui.heading, { textAlign: 'center' }]}>{title}</Text>
      <Text style={[ui.note, { textAlign: 'center' }]}>{recording ? t('waitingMatch') : current ? t('sessionPausedHint') : t('tapStart')}</Text>
      {current && <View style={[ui.row, { justifyContent: 'center' }]}>
        <Text style={ui.note}>{duration(listeningTime(current, now))} · {session.birds.length} {t('species')}</Text>
        {!recording && <Button label={t('end')} onPress={end} secondary disabled={starting} />}
      </View>}
      {listener.error && <Text style={ui.error}>{errorText(listener.error)}</Text>}
      {actionError && <Text style={ui.error}>{t('actionError')}: {errorText(actionError)}</Text>}
      {notice && <Text style={ui.note}>{notice}</Text>}
      {session.savingError && <View style={{ gap: 8 }}>
        <Text style={ui.error}>{t('storageError')} {errorText(session.savingError)}</Text>
        <Button label={t('retry')} onPress={session.retrySave} secondary />
      </View>}
      {recording && current?.trackEnabled && session.gpsError && <Text style={ui.note}>
        {session.gpsError === 'waiting' ? t('gpsWaiting') : session.gpsError === 'denied' ? t('gpsDenied') : `${t('gpsError')}: ${session.gpsError}`}
      </Text>}
      <AudioDiagnostics diagnostics={listener.diagnostics} listening={recording} starting={starting} now={now} clip={clip} />
      <Text style={[ui.note, { textAlign: 'center' }]}>{t('noUploads')}</Text>
      <Text style={[ui.note, { textAlign: 'center' }]}>{t('credits')}</Text>
    </ScrollView>
  </LinearGradient>;
}
const styles = StyleSheet.create({
  offline: { flexDirection: 'row', gap: 5, alignItems: 'center', padding: 9, borderRadius: 12, backgroundColor: '#FFFFFFAA' },
  offlineText: { color: colors.accent, fontSize: 10, fontWeight: '800', letterSpacing: 1 },
  stage: { height: 270, width: '100%', maxWidth: 480, alignSelf: 'center', alignItems: 'center', justifyContent: 'center' },
  orbit: { position: 'absolute', width: 210, height: 210, borderRadius: 105, borderWidth: 1, borderColor: colors.line, backgroundColor: '#FFFFFF30' },
  mic: { transform: [{ scale: 1.4 }] },
  bubble: { position: 'absolute', maxWidth: '40%', minWidth: 105, borderRadius: 22, backgroundColor: '#FFFEF9',
    borderWidth: 1, borderColor: colors.line, elevation: 2 },
  left: { left: 0, top: 10 }, right: { right: 0, top: 30 }, bottom: { bottom: 0, alignSelf: 'center' },
  bubbleButton: { alignItems: 'center', paddingHorizontal: 10, paddingVertical: 6, minHeight: 90 },
  bubbleName: { fontWeight: '700', color: colors.ink, fontSize: 12, textAlign: 'center', maxWidth: 140 },
});
