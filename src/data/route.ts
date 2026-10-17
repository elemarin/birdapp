import type { Encounter, TrackPoint } from './session';

export function projectRoute(points: TrackPoint[], encounters: Encounter[]) {
  if (!points.length) return { lines: [] as string[], markers: [] as { id: string; x: number; y: number }[] };
  const latitude = points[0].latitude;
  const factor = Math.max(0.01, Math.cos(latitude * Math.PI / 180));
  const origin = points[0].longitude;
  const unwrap = (longitude: number) => ((longitude - origin + 540) % 360 - 180) * factor;
  const xs = points.map(p => unwrap(p.longitude));
  const ys = points.map(p => p.latitude - latitude);
  const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
  const span = Math.max(maxX - minX, maxY - minY, 0.0002);
  const xy = (lat: number, lon: number) => ({
    x: 160 + (unwrap(lon) - (minX + maxX) / 2) / span * 260,
    y: 130 - (lat - latitude - (minY + maxY) / 2) / span * 210,
  });
  const lines: string[] = [];
  let current: string[] = [];
  points.forEach((p, i) => {
    const previous = points[i - 1];
    if (previous && (p.segment !== previous.segment || p.at - previous.at > 60000)) {
      if (current.length) lines.push(current.join(' '));
      current = [];
    }
    const point = xy(p.latitude, p.longitude);
    current.push(`${point.x},${point.y}`);
  });
  if (current.length) lines.push(current.join(' '));
  const markers = encounters.filter(e => e.latitude !== null && e.longitude !== null)
    .map(e => ({ id: e.id, ...xy(e.latitude!, e.longitude!) }));
  return { lines, markers };
}
