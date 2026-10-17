import { MaterialCommunityIcons } from '@expo/vector-icons';
import { StyleSheet, View } from 'react-native';

import { avatarColor, colors } from '@/theme';

export function BirdSticker({ name, compact = false }: { name: string; compact?: boolean }) {
  const color = avatarColor(name);
  return (
    <View accessible={false} importantForAccessibility="no-hide-descendants" style={[styles.patch, compact && styles.compactPatch]}>
      <View style={[styles.halo, { backgroundColor: color }, compact && styles.compactHalo]} />
      <View style={[styles.sticker, compact && styles.compactSticker]}>
        <MaterialCommunityIcons name="bird" size={compact ? 34 : 64} color={color} />
      </View>
      <View style={[styles.spark, { backgroundColor: color }]} />
      <View style={[styles.smallSpark, { backgroundColor: color }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  patch: { height: 104, alignItems: 'center', justifyContent: 'center' },
  compactPatch: { width: 58, height: 58 },
  halo: { position: 'absolute', width: 84, height: 84, borderRadius: 30, opacity: 0.12, transform: [{ rotate: '-12deg' }] },
  compactHalo: { width: 46, height: 46, borderRadius: 16 },
  sticker: {
    width: 82, height: 82, borderRadius: 28, backgroundColor: colors.surface,
    alignItems: 'center', justifyContent: 'center', transform: [{ rotate: '-8deg' }],
    shadowColor: colors.ink, shadowOpacity: 0.12, shadowRadius: 3, shadowOffset: { width: 1, height: 3 }, elevation: 3,
  },
  compactSticker: { width: 44, height: 44, borderRadius: 15 },
  spark: { position: 'absolute', width: 7, height: 7, borderRadius: 2, right: '15%', top: '20%', transform: [{ rotate: '25deg' }], opacity: 0.65 },
  smallSpark: { position: 'absolute', width: 4, height: 4, borderRadius: 2, left: '15%', bottom: '20%', opacity: 0.5 },
});
