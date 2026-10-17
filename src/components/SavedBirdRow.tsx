import { router } from 'expo-router';
import { Pressable, Text, View } from 'react-native';

import type { BirdSummary } from '@/data/session';
import { useTranslation } from '@/i18n';
import { BirdSticker } from './BirdSticker';
import { ui } from './ui';

export function SavedBirdRow({ bird, sessionId }: { bird: BirdSummary; sessionId?: string }) {
  const { t, birdName } = useTranslation();
  return <Pressable accessibilityRole="button" accessibilityLabel={`${birdName(bird)}, ${bird.count} ${t('encounters')}`}
    onPress={() => router.navigate({ pathname: '/bird/[id]', params: { id: bird.scientific, ...(sessionId ? { sessionId } : {}) } })}
    style={({ pressed }) => [ui.card, { flexDirection: 'row', alignItems: 'center', opacity: pressed ? 0.7 : 1 }]}>
    <BirdSticker name={bird.scientific} compact />
    <View style={{ flex: 1, gap: 4 }}>
      <Text style={[ui.body, { fontWeight: '800' }]}>{birdName(bird)}</Text>
      <Text style={ui.note}>{bird.count} {t('encounters')} · {Math.round(bird.best * 100)}%</Text>
    </View>
  </Pressable>;
}
