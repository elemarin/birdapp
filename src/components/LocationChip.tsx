import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { LocationState } from '@/hooks/useLocationFilter';
import { colors } from '@/theme';

type Props = { state: LocationState; enabled: boolean; onToggle: () => void; onRetry: () => void };

export function LocationChip({ state, enabled, onToggle, onRetry }: Props) {
  const local = state.status === 'ready' && enabled;
  const [icon, label] =
    state.status === 'locating'
      ? (['locate-outline', 'Finding your location…'] as const)
      : state.status === 'ready'
        ? enabled
          ? (['location', state.coordinates] as const)
          : (['earth', 'All species · tap for local only'] as const)
        : (['alert-circle-outline', 'All species · location unavailable'] as const);
  const detail = state.status === 'ready' && enabled
    ? `${state.speciesCount} species expected here · tap for all species`
    : state.status === 'denied' || state.status === 'unavailable' ? state.message : null;

  return (
    <Pressable
      onPress={state.status === 'ready' ? onToggle : onRetry}
      disabled={state.status === 'locating'}
      accessibilityRole="button"
      accessibilityLabel={[label, detail].filter(Boolean).join('. ')}
      accessibilityState={{ disabled: state.status === 'locating' }}
      style={({ pressed }) => [styles.chip, local && styles.chipLocal, pressed && { opacity: 0.7 }]}
    >
      <Ionicons name={icon} size={14} color={local ? colors.accent : colors.muted} />
      <View style={styles.labels}>
        <Text style={[styles.text, local && { color: colors.accent }]}>{label}</Text>
        {detail && <Text style={styles.detail}>{detail}</Text>}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.7)',
    borderWidth: 1,
    borderColor: colors.line,
    maxWidth: '100%',
    minHeight: 44,
  },
  chipLocal: { backgroundColor: colors.accentSoft, borderColor: 'transparent' },
  text: { fontSize: 13, fontWeight: '600', color: colors.muted },
  labels: { flexShrink: 1, gap: 2 },
  detail: { fontSize: 11, lineHeight: 16, color: colors.muted },
});
