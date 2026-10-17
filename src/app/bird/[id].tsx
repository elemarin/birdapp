import { Ionicons } from '@expo/vector-icons';
import { Link, router, useLocalSearchParams } from 'expo-router';
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { species } from '@/birdnet/birdnet';
import { BirdSticker } from '@/components/BirdSticker';
import { useBirdSession } from '@/hooks/useBirdSession';
import { colors } from '@/theme';

export default function BirdDetails() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const { listener } = useBirdSession();
  const bird = typeof id === 'string' && /^\d+$/.test(id) ? species[Number(id)] : null;
  const detection = bird ? listener.detections.find((item) => item.species.index === bird.index) : null;
  const goBack = () => router.canGoBack() ? router.back() : router.replace('/');

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 24 }]}
    >
      {Platform.OS === 'android' && <View style={styles.grabber} />}
      <View style={styles.header}>
        {bird && <BirdSticker name={bird.scientific} compact />}
        <View style={styles.names}>
          <Text style={styles.title} accessibilityRole="header">{bird?.common ?? 'Bird not found'}</Text>
          {bird && <Text style={styles.scientific}>{bird.scientific}</Text>}
        </View>
        <Pressable onPress={goBack} accessibilityRole="button" accessibilityLabel="Close bird details" style={styles.close}>
          <Ionicons name="close" size={22} color={colors.accentDeep} />
        </Pressable>
      </View>
      {bird ? <>
          {detection ? <>
            <View style={styles.stats}>
              <View style={styles.stat}>
                <Text style={styles.value}>{Math.round(detection.best * 100)}%</Text>
                <Text style={styles.label}>Best model confidence</Text>
              </View>
              <View style={styles.stat}>
                <Text style={styles.value}>{detection.count}</Text>
                <Text style={styles.label}>{detection.count === 1 ? 'Encounter' : 'Encounters'}</Text>
              </View>
            </View>
            <View style={styles.observation}>
              <Text style={styles.section}>Heard in this session</Text>
              <Text style={styles.body}>First: {new Date(detection.firstHeard).toLocaleString()}</Text>
              <Text style={styles.body}>Latest: {new Date(detection.lastHeard).toLocaleString()}</Text>
            </View>
            <Text style={styles.note}>Encounters are matches separated by more than 4 seconds, not individual birds.</Text>
          </> : <Text style={styles.body}>This bird has not been heard in the current collection.</Text>}
        <View style={styles.noteCard}>
          <Text style={styles.body}>An audio match, not a confirmed sighting. Confidence is a model score, not a guarantee.</Text>
        </View>
        <Text style={styles.note}>Offline session details · Decorative artwork. Species facts and photos are not bundled yet.</Text>
        <Link href={`https://en.wikipedia.org/wiki/Special:Search?search=${encodeURIComponent(bird.scientific)}`} style={styles.guide} accessibilityLabel={`Look up ${bird.common} on Wikipedia, requires internet`}>
          Wikipedia ↗
        </Link>
        <Text style={styles.linkNote}>Opens a website · needs internet</Text>
      </> : <View style={styles.noteCard}>
        <Text style={styles.body}>This link does not match a bird in the local species list.</Text>
      </View>}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { paddingHorizontal: 20, paddingTop: 16, gap: 14, maxWidth: 640, width: '100%', alignSelf: 'center' },
  grabber: { width: 36, height: 4, borderRadius: 2, backgroundColor: colors.line, alignSelf: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  names: { flex: 1 },
  close: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 22, backgroundColor: colors.accentSoft },
  title: { fontSize: 22, fontWeight: '800', color: colors.ink, letterSpacing: -0.5 },
  scientific: { fontSize: 13, color: colors.muted, fontStyle: 'italic', marginTop: 4 },
  stats: { flexDirection: 'row', flexWrap: 'wrap', gap: 16, padding: 16, borderRadius: 18, backgroundColor: colors.surface },
  stat: { flex: 1, minWidth: 100 },
  value: { fontSize: 26, fontWeight: '800', color: colors.accentDeep },
  label: { fontSize: 12, color: colors.muted, marginTop: 4 },
  observation: { gap: 4 },
  section: { fontSize: 15, fontWeight: '800', color: colors.ink, marginBottom: 4 },
  body: { fontSize: 14, color: colors.ink, lineHeight: 22 },
  note: { fontSize: 12, color: colors.muted, lineHeight: 18 },
  noteCard: { padding: 14, backgroundColor: colors.accentSoft, borderRadius: 16 },
  guide: { color: colors.accentDeep, fontSize: 14, fontWeight: '700', textAlign: 'center', paddingVertical: 12 },
  linkNote: { fontSize: 11, color: colors.muted, textAlign: 'center', marginTop: -14 },
});
