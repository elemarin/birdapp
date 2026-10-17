import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AudioDiagnostics } from '@/components/AudioDiagnostics';
import { BirdSticker } from '@/components/BirdSticker';
import { ListenButton } from '@/components/ListenButton';
import { LocationChip } from '@/components/LocationChip';
import { SpeciesRow } from '@/components/SpeciesRow';
import type { Detection, Status } from '@/hooks/useBirdListener';
import { useBirdSession } from '@/hooks/useBirdSession';
import { colors } from '@/theme';

const LIVE_MS = 3500;

export default function Home() {
  const insets = useSafeAreaInsets();
  const { width, fontScale } = useWindowDimensions();
  const columns = width < 380 || fontScale > 1.3 ? 1 : width >= 700 ? 3 : 2;
  const { location, listener, clip } = useBirdSession();
  const { status, error, pauseReason, detections, warmup, level, diagnostics, start, stop, clear } = listener;
  const [transportError, setTransportError] = useState<string | null>(null);
  const [changingTransport, setChangingTransport] = useState(false);
  const listening = status === 'warming' || status === 'listening';
  const now = useNow(listening || detections.length > 0);
  const live = listening ? detections.filter((d) => now - d.lastHeard < LIVE_MS) : [];
  const toggleListening = async () => {
    setChangingTransport(true);
    setTransportError(null);
    try {
      if (listening) await stop();
      else {
        await clip.stopPlayback();
        await start();
      }
    } catch (e) {
      console.warn('Could not change audio mode', e);
      setTransportError(e instanceof Error ? e.message : String(e));
    } finally {
      setChangingTransport(false);
    }
  };

  return (
    <LinearGradient colors={[colors.bgTop, colors.bg]} locations={[0, 0.45]} style={styles.fill}>
      <View style={[styles.top, { paddingTop: insets.top + 12 }]}>
        <View style={styles.brandRow}>
          <View>
            <Text style={styles.title}>Birdsong<Text style={styles.titleDot}>.</Text></Text>
          </View>
          <View style={styles.offline}>
            <Ionicons name="leaf" size={13} color={colors.accent} />
            <Text style={styles.offlineText}>OFFLINE</Text>
          </View>
        </View>
        <LocationChip
          state={location.state}
          enabled={location.enabled}
          onToggle={() => location.setEnabled((v) => !v)}
          onRetry={location.retry}
        />
      </View>

      <FlatList
        key={columns}
        data={detections}
        numColumns={columns}
        keyExtractor={(item) => String(item.species.index)}
        style={styles.fill}
        contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + 24 }]}
        columnWrapperStyle={columns > 1 ? styles.columns : undefined}
        ItemSeparatorComponent={CardGap}
        renderItem={({ item }) => (
          <View style={[styles.cardSlot, { flex: 1 / columns }]}>
            <SpeciesRow detection={item} live={listening && now - item.lastHeard < LIVE_MS} now={now} />
          </View>
        )}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={<>
          <View style={styles.hero}>
            <ListenButton status={status} level={level} onPress={toggleListening} disabled={clip.busy || changingTransport} />
            <StatusLine status={status} error={error} pauseReason={pauseReason} warmup={warmup} live={live} />
          </View>
          {transportError && <Text style={styles.error}>{transportError}</Text>}
          <View style={styles.listHeader}>
            <View style={styles.collectionTitle}>
              <Text style={styles.sectionTitle}>Your birds</Text>
              <Text style={styles.count}>{detections.length}</Text>
            </View>
            {detections.length > 0 && (
              <Pressable onPress={clear} accessibilityRole="button" accessibilityLabel="Clear birds from this collection" style={styles.clearButton}>
                <Text style={styles.clear}>Clear</Text>
              </Pressable>
            )}
          </View>
        </>}
        ListEmptyComponent={<EmptyState listening={listening} />}
        ListFooterComponent={<View style={styles.footer}>
          <AudioDiagnostics diagnostics={diagnostics} listening={listening} starting={status === 'starting' || changingTransport} now={now} clip={clip} />
          <Text style={styles.credit}>On-device listening · No audio uploads</Text>
          <Text style={styles.credit}>Powered by BirdNET · Cornell Lab & TU Chemnitz</Text>
        </View>}
      />
    </LinearGradient>
  );
}

function StatusLine({ status, error, pauseReason, warmup, live }: { status: Status; error: string | null; pauseReason: string | null; warmup: number; live: Detection[] }) {
  let title = 'Tap to start listening';
  let sub = pauseReason ?? 'Point your phone toward the birdsong';
  if (status === 'starting') [title, sub] = ['Getting ready…', ' '];
  if (status === 'warming') [title, sub] = ['Listening…', `First results in ${Math.max(1, Math.ceil(3 * (1 - warmup)))}s`];
  if (status === 'listening')
    [title, sub] = live.length
      ? [live.map((d) => d.species.common).join(', '), 'Singing now']
      : ['Listening…', 'Waiting for a confident match'];
  if (status === 'error') [title, sub] = [error ?? 'Something went wrong', 'Tap to try again'];

  return (
    <Animated.View key={status} entering={FadeIn.duration(250)} style={styles.status}>
      <Text style={[styles.statusTitle, status === 'error' && { color: colors.danger }]} numberOfLines={2}>
        {title}
      </Text>
      <Text style={styles.statusSub}>{sub}</Text>
    </Animated.View>
  );
}

function EmptyState({ listening }: { listening: boolean }) {
  return (
    <View style={styles.empty}>
      <BirdSticker name="first-discovery" />
      <Text style={styles.emptyTitle}>{listening ? 'Listening for birds' : 'No birds yet'}</Text>
      <Text style={styles.emptyText}>{listening ? 'Confident matches will appear here.' : 'Tap the mic to start listening.'}</Text>
    </View>
  );
}

function CardGap() {
  return <View style={styles.cardGap} />;
}

function useNow(ticking: boolean) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!ticking) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [ticking]);
  return now;
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  top: { paddingHorizontal: 20, paddingBottom: 12, gap: 8 },
  brandRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 },
  title: { fontSize: 30, fontWeight: '900', color: colors.ink, letterSpacing: -1.3 },
  titleDot: { color: colors.live },
  offline: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: '#FFFFFF99', borderRadius: 10, padding: 9, transform: [{ rotate: '5deg' }] },
  offlineText: { fontSize: 9, fontWeight: '800', letterSpacing: 1, color: colors.accent },
  hero: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#E4EBD8', borderRadius: 20, padding: 6, borderWidth: 1, borderColor: '#D6DFC9' },
  status: { flex: 1, paddingLeft: 6, paddingRight: 12, paddingVertical: 8 },
  statusTitle: { fontSize: 16, fontWeight: '700', color: colors.ink },
  statusSub: { fontSize: 12, color: colors.muted, marginTop: 3, lineHeight: 17 },
  listHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 10,
    marginBottom: 8,
    minHeight: 44,
  },
  collectionTitle: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  sectionTitle: { fontSize: 20, fontWeight: '800', color: colors.ink, letterSpacing: -0.5 },
  count: { color: colors.accentDeep, backgroundColor: colors.accentSoft, paddingHorizontal: 9, paddingVertical: 3, borderRadius: 9, fontSize: 13, fontWeight: '800', overflow: 'hidden' },
  clearButton: { minHeight: 44, minWidth: 48, alignItems: 'center', justifyContent: 'center' },
  clear: { fontSize: 14, fontWeight: '600', color: colors.accent },
  list: { paddingHorizontal: 20 },
  columns: { gap: 10 },
  cardSlot: { flex: 1 },
  cardGap: { height: 10 },
  footer: { marginTop: 16, gap: 8 },
  error: { color: colors.danger, paddingVertical: 12 },
  empty: {
    alignItems: 'center',
    gap: 10,
    paddingVertical: 18,
    paddingHorizontal: 20,
    backgroundColor: '#FFFEF980',
    borderRadius: 24,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: colors.line,
  },
  emptyTitle: { fontSize: 18, fontWeight: '800', color: colors.ink, textAlign: 'center' },
  emptyText: { fontSize: 13, lineHeight: 20, color: colors.muted, textAlign: 'center' },
  credit: { fontSize: 10, color: colors.muted, textAlign: 'center', lineHeight: 15 },
});
