import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { test } from 'node:test';

registerHooks({
  resolve(specifier, context, next) {
    if (specifier === 'expo-sqlite') {
      return { url: new URL('./sqlite-adapter.mjs', import.meta.url).href, shortCircuit: true };
    }
    if (context.parentURL?.includes('/src/data/') && specifier.startsWith('.') && !specifier.endsWith('.ts')) {
      return { url: new URL(`${specifier}.ts`, context.parentURL).href, shortCircuit: true };
    }
    return next(specifier, context);
  },
});
const store = await import('../src/data/database.ts');
const { defaultPreferences, resumeSession, recordEncounter, pauseSession } = await import('../src/data/session.ts');

test('production repository persists encounters, settings, route, pagination and cascades in real SQLite', async () => {
  assert.deepEqual(await store.loadPreferences(), defaultPreferences);
  await store.savePreferences({ ...defaultPreferences, language: 'es', name: 'Local', trackEnabled: true });
  assert.equal((await store.loadPreferences()).language, 'es');
  const now = Date.now();
  let session = {
    id: 'integration', startedAt: now - 10000, updatedAt: now, endedAt: null,
    listeningMs: 0, activeStartedAt: null, status: 'paused', trackEnabled: true, segment: 0,
  };
  session = resumeSession(session, now - 5000);
  const bird = { index: 1, scientific: 'Testus birdus', common: 'Test bird' };
  const point = { sessionId: session.id, at: now - 1000, latitude: 9.9, longitude: -84.1, accuracy: 10, segment: 1 };
  const encounter = recordEncounter(undefined, session, bird, 0.8, now - 1000, point);
  await store.saveSession(session, [encounter], [point]);
  await store.saveSession(session, [{ ...encounter, best: 0.9, lastHeard: now }], [point]);
  assert.equal((await store.loadSession(session.id)).status, 'running');
  assert.equal((await store.loadEncounters(session.id)).length, 1);
  assert.equal((await store.loadTrack(session.id)).length, 1);
  assert.equal((await store.listBirds())[0].best, 0.9);
  assert.equal((await store.listBirds())[0].count, 1);
  assert.equal((await store.listBirds('Test'))[0].scientific, bird.scientific);
  assert.equal((await store.listBirds('no match')).length, 0);
  assert.equal((await store.listBirds('%')).length, 0, 'literal wildcard search');
  assert.equal((await store.listSessions())[0].speciesCount, 1);
  assert.equal((await store.listSessions(30)).length, 0);
  assert.equal((await store.totals()).encounters, 1);
  assert.equal((await store.loadOpenSession()).id, session.id);
  session = { ...pauseSession(session, now), status: 'ended', endedAt: now };
  await store.saveSession(session);
  assert.equal(await store.loadOpenSession(), null);
  assert.ok((await store.loadSession(session.id)).listeningMs >= 5000);
  await store.discardSession(session.id);
  assert.equal(await store.loadSession(session.id), null);
  assert.equal((await store.loadEncounters(session.id)).length, 0);
  assert.equal((await store.loadTrack(session.id)).length, 0);
  assert.equal((await store.listSessions()).length, 0);
});

test('transaction failure rolls back and does not prevent subsequent writes', async () => {
  const now = Date.now();
  const session = { id: 'rollback', startedAt: now, updatedAt: now, endedAt: null,
    listeningMs: 0, activeStartedAt: null, status: 'paused', trackEnabled: false, segment: 0 };
  const invalid = { id: 'invalid', sessionId: 'missing-parent', scientific: 'Invalid', common: 'Invalid',
    modelIndex: 0, firstHeard: now, lastHeard: now, best: 0.9, segment: 0, latitude: null, longitude: null, accuracy: null };
  await assert.rejects(store.saveSession(session, [invalid]), /FOREIGN KEY/);
  assert.equal(await store.loadSession(session.id), null);
  await store.saveSession(session);
  assert.equal((await store.loadSession(session.id)).id, session.id);
  await store.discardSession(session.id);
});

test('reopening the repository restores a running session as interrupted without adding offline time', async () => {
  const now = Date.now();
  const session = { id: 'interrupted', startedAt: now - 20000, updatedAt: now, endedAt: null,
    listeningMs: 5000, activeStartedAt: now - 2000, status: 'running', trackEnabled: false, segment: 1 };
  await store.saveSession(session);
  const before = await store.loadSession(session.id);
  const reopened = await import('../src/data/database.ts?reopened');
  const restored = await reopened.loadOpenSession();
  assert.equal(restored.id, session.id);
  assert.equal(restored.status, 'interrupted');
  assert.equal(restored.activeStartedAt, null);
  assert.equal(restored.listeningMs, before.listeningMs);
  assert.equal(restored.updatedAt, before.updatedAt);
  await reopened.discardSession(session.id);
});

test('history spans sessions, uses scientific identity and paginates without dropping older rows', async () => {
  const now = Date.now();
  const ids = [];
  for (let i = 0; i < 32; i++) {
    const session = { id: `page-${i}`, startedAt: now + i, updatedAt: now + i, endedAt: now + i + 1,
      listeningMs: 1000, activeStartedAt: null, status: 'ended', trackEnabled: false, segment: 1 };
    ids.push(session.id);
    const encounter = {
      id: `encounter-${i}`, sessionId: session.id, scientific: 'Shared species', common: 'Shared bird', modelIndex: i,
      firstHeard: now + i, lastHeard: now + i, best: 0.7, segment: 1,
      latitude: null, longitude: null, accuracy: null,
    };
    await store.saveSession(session, [encounter]);
  }
  const page1 = await store.listSessions();
  const page2 = await store.listSessions(30);
  assert.equal(page1.length, 30);
  assert.equal(page2.length, 2);
  assert.equal(new Set([...page1, ...page2].map(s => s.id)).size, 32);
  const birds = await store.listBirds();
  assert.equal(birds.length, 1);
  assert.equal(birds[0].count, 32);
  assert.equal((await store.totals()).sessions, 32);
  for (const id of ids) await store.discardSession(id);
});
