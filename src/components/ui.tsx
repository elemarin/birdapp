import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors } from '@/theme';

export function Button({ label, onPress, disabled, secondary = false }: {
  label: string; onPress: () => void; disabled?: boolean; secondary?: boolean;
}) {
  return <Pressable accessibilityRole="button" accessibilityState={{ disabled: !!disabled }}
    onPress={onPress} disabled={disabled} style={({ pressed }) => [
      ui.button, secondary && ui.secondary, { opacity: disabled ? 0.4 : pressed ? 0.7 : 1 },
    ]}><Text style={[ui.buttonText, secondary && { color: colors.accent }]}>{label}</Text></Pressable>;
}
export function Card({ children }: { children: ReactNode }) {
  return <View style={ui.card}>{children}</View>;
}
export function Stat({ value, label }: { value: string | number; label: string }) {
  return <View style={ui.stat}><Text style={ui.value}>{value}</Text><Text style={ui.note}>{label}</Text></View>;
}
export function duration(ms: number) {
  const seconds = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(seconds / 3600).toString().padStart(2, '0')}:${Math.floor(seconds / 60 % 60).toString().padStart(2, '0')}:${(seconds % 60).toString().padStart(2, '0')}`;
}
export const ui = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { padding: 20, gap: 16, paddingBottom: 32 },
  title: { fontSize: 28, fontWeight: '900', color: colors.ink, letterSpacing: -0.8 },
  heading: { fontSize: 19, fontWeight: '800', color: colors.ink },
  body: { fontSize: 15, color: colors.ink, lineHeight: 22 },
  note: { fontSize: 12, color: colors.muted, lineHeight: 18 },
  error: { fontSize: 13, color: colors.danger, lineHeight: 20 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, flexWrap: 'wrap' },
  card: { borderRadius: 22, padding: 18, backgroundColor: '#FFFEF9', borderWidth: 1, borderColor: colors.line, gap: 12 },
  stat: { flex: 1, minWidth: 80, gap: 3 },
  value: { fontSize: 23, fontWeight: '800', color: colors.accent },
  button: { minHeight: 46, borderRadius: 14, paddingHorizontal: 18, paddingVertical: 12, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' },
  secondary: { backgroundColor: colors.accentSoft },
  buttonText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  input: { borderWidth: 1, borderColor: colors.line, borderRadius: 14, minHeight: 48, paddingHorizontal: 14, fontSize: 15, color: colors.ink, backgroundColor: '#FFFEF9' },
});
