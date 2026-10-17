import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { LocationState } from '@/hooks/useLocationFilter';
import { colors } from '@/theme';
import { useTranslation } from '@/i18n';

type Props = { state: LocationState; enabled: boolean; onToggle: () => void; onRetry: () => void };

export function LocationChip({ state, enabled, onToggle, onRetry }: Props) {
  const { t, errorText } = useTranslation();
  const local = state.status === 'ready' && enabled;
  const [icon, label] =
    !enabled ? (['earth', `${t('allSpecies')} · ${t('tapLocal')}`] as const)
    : state.status === 'locating'
      ? (['locate-outline', t('locating')] as const)
      : state.status === 'ready'
        ? enabled
          ? (['location', state.coordinates] as const)
          : (['earth', `${t('allSpecies')} · ${t('tapLocal')}`] as const)
        : (['alert-circle-outline', t('locationUnavailable')] as const);
  const detail = !enabled ? null : state.status === 'ready'
    ? `${t('localSpecies', { count: state.speciesCount })} · ${t('tapAll')}`
    : state.status === 'denied' ? t(state.canAskAgain ? 'permissionDenied' : 'locationSettings')
      : state.status === 'unavailable' ? errorText(state.message) : null;

  return (
    <Pressable
      onPress={!enabled || state.status === 'ready' ? onToggle : onRetry}
      disabled={enabled && state.status === 'locating'}
      accessibilityRole="button"
      accessibilityLabel={[label, detail].filter(Boolean).join('. ')}
      accessibilityState={{ disabled: enabled && state.status === 'locating' }}
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
