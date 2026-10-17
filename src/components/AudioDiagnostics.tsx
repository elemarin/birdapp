import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { AudioDiagnostics as Diagnostics } from '@/hooks/useBirdListener';
import type { useDiagnosticClip } from '@/hooks/useDiagnosticClip';
import { colors } from '@/theme';
import { useTranslation } from '@/i18n';

type Props = {
  diagnostics: Diagnostics;
  listening: boolean;
  starting: boolean;
  now: number;
  clip: ReturnType<typeof useDiagnosticClip>;
};

const healthText = {
  waiting: 'micWaiting',
  receiving: 'micReceiving',
  quiet: 'micQuiet',
  stalled: 'micStalled',
} as const;

export function AudioDiagnostics({ diagnostics: d, listening, starting, now, clip }: Props) {
  const { t, locale, birdName, errorText } = useTranslation();
  const [expanded, setExpanded] = useState(false);
  const candidate = d.strongest;
  const reason = t(candidate?.reason === 'confidence' ? 'belowThreshold'
    : candidate?.reason === 'location' ? 'filtered' : 'accepted');
  const health = starting ? t('micReady')
    : listening ? t(healthText[d.health]) : t('micStopped');
  const warning = listening && (d.health === 'quiet' || d.health === 'stalled' || d.inferenceStalled);
  const values = Array.from({ length: 30 }, (_, i) => d.history[i - (30 - d.history.length)] ?? 0);
  return (
    <View style={styles.card}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('audioCheck')}
        accessibilityHint={t(expanded ? 'hideDebug' : 'showDebug')}
        accessibilityState={{ expanded }}
        onPress={() => setExpanded((value) => !value)}
        style={styles.header}
      >
        <View style={styles.headerIcon}><Ionicons name="options-outline" size={20} color={colors.accent} /></View>
        <View style={styles.headerText}>
          <Text style={styles.title}>{t('audioCheck')}</Text>
          <Text style={[styles.note, warning && styles.warning]}>
            {d.inferenceStalled && listening ? t('modelDelayed') : health}
            {clip.playing ? ` · ${t('replaying')}` : ''}
          </Text>
        </View>
        <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={20} color={colors.muted} />
      </Pressable>
      {expanded && <View style={styles.content}>
      <View
        style={styles.meter}
        accessible
        accessibilityLabel={t('recentInput', { db: d.db.toFixed(0) })}
      >
        {values.map((value, i) => (
          <View key={i} style={[styles.bar, { height: 2 + value * 38, opacity: listening ? 1 : 0.4 }]} />
        ))}
      </View>
      <Text style={styles.body}>
        {d.db.toFixed(0)} dBFS · {(d.peak * 100).toFixed(1)}% · {t('received', { seconds: (d.samples / 48000).toFixed(1) })}
      </Text>
      <Text style={styles.note}>
        {d.sampleRate ? `${t('inputRate', { rate: d.sampleRate.toLocaleString(locale) })} ` : ''}
        {t('meterHint')}
      </Text>
      <Text style={styles.body}>
        BirdNET: {t('checks', { count: d.checks })}
        {d.lastCheckAt ? ` · ${t('ago', { seconds: Math.max(0, Math.floor((now - d.lastCheckAt) / 1000)) })} · ${d.inferenceMs} ms` : ''}
      </Text>
      {listening && d.inferenceStalled && (
        <Text style={styles.warning}>{t('modelDelayed')}</Text>
      )}
      {candidate ? (
        <Text style={styles.note}>
          {t('strongest')}: {birdName(candidate.species)} ({(candidate.confidence * 100).toFixed(1)}%) - {reason}.
          {candidate.reason !== 'accepted' ? ` ${t('notDetection')}` : ''}
        </Text>
      ) : (
        <Text style={styles.note}>{t('checkNeedsAudio')}</Text>
      )}
      <Text style={styles.title}>{t('diagnosticClip')}</Text>
      <Text style={styles.note}>
        {t('clipHint')}
      </Text>
      {clip.savedAt !== null && <Text style={styles.body}>{t('clipSaved', { time: new Date(clip.savedAt).toLocaleTimeString(locale) })}</Text>}
      <View style={styles.actions}>
        <Action label={t(clip.savedAt === null ? 'saveClip' : 'replaceClip')} disabled={starting || clip.busy || d.samples < 144000} onPress={clip.save} />
        <Action label={t(clip.playing ? 'stopReplay' : 'replay')} disabled={starting || clip.busy || clip.savedAt === null} onPress={clip.playing ? clip.stopReplay : clip.play} />
        <Action label={t('delete')} disabled={starting || clip.busy || clip.savedAt === null} onPress={clip.remove} />
      </View>
      <Text style={styles.note}>{t('replayHint')}</Text>
      {clip.error && <Text style={styles.warning}>{errorText(clip.error)}</Text>}
      </View>}
      {!expanded && clip.error && <Text style={styles.warning}>{errorText(clip.error)}</Text>}
    </View>
  );
}

function Action({ label, disabled, onPress }: { label: string; disabled: boolean; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={[styles.action, disabled && { opacity: 0.4 }]}
    >
      <Text style={styles.actionText}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: '#FFFEF9', borderRadius: 20, padding: 16, gap: 9, borderWidth: 1, borderColor: colors.line },
  header: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 48 },
  headerIcon: { width: 38, height: 38, backgroundColor: colors.accentSoft, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  headerText: { flex: 1, gap: 3 },
  content: { gap: 9, borderTopWidth: 1, borderTopColor: colors.line, paddingTop: 14 },
  title: { color: colors.ink, fontSize: 15, fontWeight: '700' },
  body: { color: colors.ink, fontSize: 13, fontVariant: ['tabular-nums'] },
  note: { color: colors.muted, fontSize: 12, lineHeight: 18 },
  warning: { color: colors.danger, fontSize: 13, lineHeight: 18 },
  meter: { flexDirection: 'row', height: 42, gap: 3, alignItems: 'center' },
  bar: { flex: 1, borderRadius: 2, backgroundColor: colors.accent },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  action: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 12, borderRadius: 10, backgroundColor: colors.accentSoft },
  actionText: { color: colors.accentDeep, fontSize: 13, fontWeight: '600' },
});
