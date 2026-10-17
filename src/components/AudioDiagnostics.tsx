import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { AudioDiagnostics as Diagnostics } from '@/hooks/useBirdListener';
import type { useDiagnosticClip } from '@/hooks/useDiagnosticClip';
import { colors } from '@/theme';

type Props = {
  diagnostics: Diagnostics;
  listening: boolean;
  starting: boolean;
  now: number;
  clip: ReturnType<typeof useDiagnosticClip>;
};

const healthText = {
  waiting: 'Waiting for microphone audio',
  receiving: 'Receiving microphone audio',
  quiet: 'Input is near silent - check the microphone',
  stalled: 'No audio buffers - microphone stream stalled',
};

export function AudioDiagnostics({ diagnostics: d, listening, starting, now, clip }: Props) {
  const [expanded, setExpanded] = useState(false);
  const candidate = d.strongest;
  const reason = candidate?.reason === 'confidence' ? 'below the 50% detection threshold'
    : candidate?.reason === 'location' ? 'excluded by the location filter' : 'passed detection filters';
  const health = starting ? 'Getting the microphone ready'
    : listening ? healthText[d.health] : 'Microphone stopped';
  const warning = listening && (d.health === 'quiet' || d.health === 'stalled' || d.inferenceStalled);
  const values = Array.from({ length: 30 }, (_, i) => d.history[i - (30 - d.history.length)] ?? 0);
  return (
    <View style={styles.card}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Audio check"
        accessibilityHint={expanded ? 'Hide microphone diagnostics and clip controls' : 'Show microphone diagnostics and clip controls'}
        accessibilityState={{ expanded }}
        onPress={() => setExpanded((value) => !value)}
        style={styles.header}
      >
        <View style={styles.headerIcon}><Ionicons name="options-outline" size={20} color={colors.accent} /></View>
        <View style={styles.headerText}>
          <Text style={styles.title}>Audio check</Text>
          <Text style={[styles.note, warning && styles.warning]}>
            {d.inferenceStalled && listening ? 'BirdNET check delayed' : health}
            {clip.playing ? ' · Replaying clip' : ''}
          </Text>
        </View>
        <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={20} color={colors.muted} />
      </Pressable>
      {expanded && <View style={styles.content}>
      <View
        style={styles.meter}
        accessible
        accessibilityLabel={`Recent microphone input, ${d.db.toFixed(0)} decibels relative to full scale`}
      >
        {values.map((value, i) => (
          <View key={i} style={[styles.bar, { height: 2 + value * 38, opacity: listening ? 1 : 0.4 }]} />
        ))}
      </View>
      <Text style={styles.body}>
        {d.db.toFixed(0)} dBFS · Peak {(d.peak * 100).toFixed(1)}% · {(d.samples / 48000).toFixed(1)}s received
      </Text>
      <Text style={styles.note}>
        {d.sampleRate ? `${d.sampleRate.toLocaleString()} Hz input, analyzed at 48,000 Hz. ` : ''}
        Bars show measured volume, not a timer. -100 dBFS is silence.
      </Text>
      <Text style={styles.body}>
        BirdNET: {d.checks} completed {d.checks === 1 ? 'check' : 'checks'}
        {d.lastCheckAt ? ` · ${Math.max(0, Math.floor((now - d.lastCheckAt) / 1000))}s ago · ${d.inferenceMs} ms` : ''}
      </Text>
      {listening && d.inferenceStalled && (
        <Text style={styles.warning}>BirdNET has not finished its current check for over 5 seconds.</Text>
      )}
      {candidate ? (
        <Text style={styles.note}>
          Strongest bird candidate: {candidate.species.common} ({(candidate.confidence * 100).toFixed(1)}%) - {reason}.
          {candidate.reason !== 'accepted' ? ' This is not a detection.' : ''}
        </Text>
      ) : (
        <Text style={styles.note}>A check needs 3 seconds of audio. No result is not proof of silence.</Text>
      )}
      <Text style={styles.title}>Diagnostic clip</Text>
      <Text style={styles.note}>
        Save the latest 3 seconds fed to BirdNET, without volume boost. One clip stays on this device until replaced or deleted. No upload.
      </Text>
      {clip.savedAt !== null && <Text style={styles.body}>3s WAV · Saved {new Date(clip.savedAt).toLocaleTimeString()}</Text>}
      <View style={styles.actions}>
        <Action label={clip.savedAt === null ? 'Save last 3s' : 'Replace clip'} disabled={starting || clip.busy || d.samples < 144000} onPress={clip.save} />
        <Action label={clip.playing ? 'Stop replay' : 'Replay'} disabled={starting || clip.busy || clip.savedAt === null} onPress={clip.playing ? clip.stopReplay : clip.play} />
        <Action label="Delete" disabled={starting || clip.busy || clip.savedAt === null} onPress={clip.remove} />
      </View>
      <Text style={styles.note}>Replay stops listening so the app does not hear itself.</Text>
      {clip.error && <Text style={styles.warning}>{clip.error}</Text>}
      </View>}
      {!expanded && clip.error && <Text style={styles.warning}>{clip.error}</Text>}
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
