import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { memo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { BirdSticker } from '@/components/BirdSticker';
import type { Detection } from '@/hooks/useBirdListener';
import { colors } from '@/theme';

type Props = { detection: Detection; live: boolean; now: number };

export const SpeciesRow = memo(function SpeciesRow({ detection: d, live, now }: Props) {
  return (
      <Pressable
        onPress={() => router.navigate({ pathname: '/bird/[id]', params: { id: String(d.species.index) } })}
        accessibilityRole="button"
        accessibilityLabel={`${d.species.common}, ${Math.round(d.best * 100)} percent best model confidence. Open bird details`}
        style={({ pressed }) => [styles.card, live && styles.cardLive, pressed && styles.pressed]}
      >
        <View style={styles.cardTop}>
          <BirdSticker name={d.species.scientific} compact />
          <Ionicons name="chevron-up" size={15} color={colors.muted} />
        </View>
        <Text style={styles.common} numberOfLines={2}>{d.species.common}</Text>
        <Text style={styles.scientific} numberOfLines={1}>{d.species.scientific}</Text>
        <View style={styles.meta}>
          <Text style={[styles.when, live && styles.live]}>{live ? 'Singing now' : timeAgo(now - d.lastHeard)}</Text>
          <Text style={styles.confidence}>{Math.round(d.best * 100)}%</Text>
        </View>
      </Pressable>
  );
});

function timeAgo(ms: number) {
  const s = Math.max(0, Math.round(ms / 1000));
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  return `${Math.floor(s / 3600)}h ago`;
}

const styles = StyleSheet.create({
  card: {
    flex: 1, padding: 12, borderRadius: 18, backgroundColor: '#FFFEF9',
    borderWidth: 1.5, borderColor: colors.line,
    shadowColor: colors.ink, shadowOpacity: 0.04, shadowRadius: 6, shadowOffset: { width: 0, height: 3 }, elevation: 1,
  },
  cardLive: { borderColor: colors.live },
  pressed: { opacity: 0.75, transform: [{ scale: 0.98 }] },
  cardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 6, marginBottom: 5 },
  common: { fontSize: 15, fontWeight: '800', color: colors.ink, lineHeight: 19, minHeight: 38 },
  scientific: { fontSize: 11, lineHeight: 16, color: colors.muted, fontStyle: 'italic', marginTop: 3 },
  meta: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 4, marginTop: 10 },
  when: { fontSize: 11, color: colors.muted, fontWeight: '600' },
  live: { color: colors.accentDeep },
  confidence: { fontSize: 12, fontWeight: '800', color: colors.accent },
});
