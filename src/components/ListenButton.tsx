import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useDerivedValue,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';

import type { Status } from '@/hooks/useBirdListener';
import { colors } from '@/theme';

const SIZE = 56;

type Props = { status: Status; level: SharedValue<number>; onPress: () => void; disabled?: boolean };

export function ListenButton({ status, level, onPress, disabled }: Props) {
  const on = status === 'warming' || status === 'listening';
  const smooth = useDerivedValue(() => withTiming(level.value, { duration: 120 }));

  const glow = useAnimatedStyle(() => ({
    opacity: on ? smooth.value * 0.5 : 0,
    transform: [{ scale: 1 + smooth.value * 0.45 }],
  }));
  const wave = useAnimatedStyle(() => ({
    opacity: on ? smooth.value * 0.7 : 0,
    transform: [{ scale: 1 + smooth.value * 0.8 }],
  }));

  return (
    <View style={styles.wrap}>
      <Animated.View style={[styles.circle, styles.wave, wave]} />
      <Animated.View style={[styles.circle, styles.glow, glow]} />
      <Pressable
        onPress={onPress}
        disabled={status === 'starting' || disabled}
        accessibilityRole="button"
        accessibilityLabel={on ? 'Stop listening' : 'Start listening'}
        accessibilityState={{ disabled: status === 'starting' || !!disabled }}
        style={({ pressed }) => [styles.shadow, { transform: [{ scale: pressed ? 0.95 : 1 }] }]}
      >
        <LinearGradient
          colors={on ? [colors.live, '#C97F16'] : [colors.accent, colors.accentDeep]}
          start={{ x: 0.2, y: 0 }}
          end={{ x: 0.8, y: 1 }}
          style={styles.circle}
        >
          {status === 'starting' ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <Ionicons name={on ? 'stop' : 'mic'} size={on ? 22 : 28} color="#fff" />
          )}
        </LinearGradient>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { width: 80, height: 80, alignItems: 'center', justifyContent: 'center' },
  circle: { width: SIZE, height: SIZE, borderRadius: SIZE / 2, alignItems: 'center', justifyContent: 'center' },
  wave: { position: 'absolute', borderWidth: 2, borderColor: colors.live },
  glow: { position: 'absolute', backgroundColor: colors.live },
  shadow: {
    borderRadius: SIZE / 2,
    shadowColor: colors.accentDeep,
    shadowOpacity: 0.18,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
  },
});
