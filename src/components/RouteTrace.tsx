import Svg, { Circle, Polyline } from 'react-native-svg';
import { Text, View } from 'react-native';

import type { Encounter, TrackPoint } from '@/data/session';
import { projectRoute } from '@/data/route';
import { useTranslation } from '@/i18n';
import { colors } from '@/theme';
import { Card, ui } from './ui';

export function RouteTrace({ points, encounters }: { points: TrackPoint[]; encounters: Encounter[] }) {
  const { t } = useTranslation();
  const { lines, markers } = projectRoute(points, encounters);
  return <Card>
    <Text style={ui.heading}>{t('route')}</Text>
    {!points.length ? <Text style={ui.note}>{t('routeEmpty')}</Text> : <>
      <View accessible accessibilityLabel={`${t('route')}, ${points.length} ${t('points')}`}
        style={{ borderRadius: 16, backgroundColor: colors.accentSoft, overflow: 'hidden' }}>
        <Svg viewBox="0 0 320 260" width="100%" height={230}>
          {lines.map((line, i) => <Polyline key={i} points={line} stroke={colors.accent} strokeWidth={3} fill="none" />)}
          {points.length === 1 && <Circle cx={160} cy={130} r={5} fill={colors.accent} />}
          {markers.map(p => <Circle key={p.id} cx={p.x} cy={p.y} r={5} fill={colors.live} stroke={colors.surface} strokeWidth={2} />)}
        </Svg>
      </View>
      <Text style={ui.note}>{points.length} {t('points')}</Text>
    </>}
    <Text style={ui.note}>{t('routeCaveat')}</Text>
  </Card>;
}
