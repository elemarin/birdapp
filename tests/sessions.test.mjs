import assert from 'node:assert/strict';
import { test } from 'node:test';

import { defaultPreferences, listeningTime, parsePreferences, pauseSession, recordEncounter, resumeSession, summarizeBirds, usableFix } from '../src/data/session.ts';
import { projectRoute } from '../src/data/route.ts';
import { en, es } from '../src/i18n/catalog.ts';

const initial = () => ({
  id: 'session-a', startedAt: 1000, updatedAt: 1000, endedAt: null, listeningMs: 0,
  activeStartedAt: null, status: 'paused', trackEnabled: true, segment: 0,
});
const bird = { index: 15, common: 'Bird A', scientific: 'Species A' };

test('session listening time excludes permission wait and paused time', () => {
  const session = initial();
  assert.equal(listeningTime(session, 6000), 0);
  const running = resumeSession(session, 6000);
  assert.equal(running.segment, 1);
  assert.equal(listeningTime(running, 16000), 10000);
  assert.equal(resumeSession(running, 17000), running);
  const paused = pauseSession(running, 16000);
  assert.equal(listeningTime(paused, 26000), 10000);
  const resumed = resumeSession(paused, 30000);
  assert.equal(resumed.segment, 2);
  assert.equal(listeningTime(resumed, 35000), 15000);
  assert.throws(() => resumeSession({ ...paused, status: 'ended' }, 40000), /ended/);
});

test('repeated predictions merge into one encounter; gaps and pauses create new encounters', () => {
  const s = resumeSession(initial(), 2000);
  const first = recordEncounter(undefined, s, bird, 0.6, 3000, null);
  const repeated = recordEncounter(first, s, bird, 0.9, 7000, null);
  assert.equal(first.id, repeated.id);
  assert.equal(repeated.best, 0.9);
  assert.equal(repeated.firstHeard, 3000);
  assert.equal(repeated.lastHeard, 7000);
  const separate = recordEncounter(repeated, s, bird, 0.7, 11001, null);
  assert.notEqual(separate.id, first.id);
  const resumed = resumeSession(pauseSession(s, 12000), 12001);
  const afterPause = recordEncounter(separate, resumed, bird, 0.8, 12002, null);
  assert.notEqual(afterPause.id, separate.id);
  const summary = summarizeBirds([repeated, separate, afterPause])[0];
  assert.equal(summary.count, 3);
  assert.equal(summary.best, 0.9);
  assert.equal(summary.firstHeard, 3000);
  assert.equal(summary.lastHeard, 12002);
  assert.throws(() => recordEncounter(undefined, s, bird, NaN, 5000, null), /Invalid/);
});

test('encounter coordinates require fresh, accurate fixes from the same session and segment', () => {
  const s = resumeSession(initial(), 2000);
  const point = { sessionId: s.id, segment: s.segment, at: 3000, latitude: 9.9, longitude: -84, accuracy: 20 };
  assert.equal(usableFix(point, 4000, s), point);
  for (const patch of [{ at: -100000 }, { latitude: 91 }, { longitude: NaN }, { accuracy: 150 },
    { accuracy: -1 }, { sessionId: 'other' }, { segment: 2 }]) {
    assert.equal(usableFix({ ...point, ...patch }, 4000, s), null);
  }
  const encounter = recordEncounter(undefined, s, bird, 0.8, 4000, point);
  assert.equal(encounter.accuracy, 20);
  assert.equal(encounter.latitude, 9.9);
  const withoutGps = recordEncounter(undefined, s, bird, 0.8, 90000, point);
  assert.equal(withoutGps.latitude, null);
});

test('profile preferences validate local data rather than silently replacing it', () => {
  assert.deepEqual(parsePreferences(JSON.stringify(defaultPreferences)), defaultPreferences);
  for (const patch of [{ language: 'xx' }, { avatar: 4 }, { avatar: -1 }, { trackEnabled: 'yes' }, { name: 4 }]) {
    assert.throws(() => parsePreferences(JSON.stringify({ ...defaultPreferences, ...patch })), /Invalid/);
  }
});

test('route traces break across pauses and GPS outages and never produce NaN', () => {
  const points = [
    { sessionId: 'a', segment: 1, at: 1000, latitude: 9.9, longitude: -84, accuracy: 10 },
    { sessionId: 'a', segment: 1, at: 11000, latitude: 9.901, longitude: -84.001, accuracy: 10 },
    { sessionId: 'a', segment: 2, at: 12000, latitude: 9.902, longitude: -84.002, accuracy: 10 },
    { sessionId: 'a', segment: 2, at: 90000, latitude: 9.903, longitude: -84.003, accuracy: 10 },
  ];
  const result = projectRoute(points, []);
  assert.equal(result.lines.length, 3);
  assert.ok(result.lines.every(line => !line.includes('NaN')));
  assert.deepEqual(projectRoute([], []), { lines: [], markers: [] });
  assert.ok(!projectRoute([points[0]], []).lines[0].includes('NaN'));
});

test('Spanish and English have matching keys and interpolation placeholders', () => {
  assert.deepEqual(Object.keys(es).sort(), Object.keys(en).sort());
  for (const key of Object.keys(en)) {
    assert.ok(es[key].length > 0);
    assert.deepEqual(es[key].match(/\{\w+\}/g) ?? [], en[key].match(/\{\w+\}/g) ?? [], key);
  }
});
