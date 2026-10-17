import { openDatabaseAsync, type SQLiteDatabase } from 'expo-sqlite';

import { schema } from './schema';
import { defaultPreferences, listeningTime, parsePreferences, type BirdSummary, type Encounter, type Preferences, type Session, type SessionSummary, type TrackPoint } from './session';

let connection: Promise<SQLiteDatabase> | null = null;
let operations = Promise.resolve();

async function database() {
  return connection ??= openDatabaseAsync('birdsong.db').then(async (db) => {
    await db.execAsync('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;');
    const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
    if ((row?.user_version ?? 0) > 1) throw new Error('This history was created by a newer version of Birdsong.');
    if (!row?.user_version) await db.withTransactionAsync(async () => { await db.execAsync(schema); });
    await db.runAsync("UPDATE sessions SET status='interrupted', activeStartedAt=NULL WHERE status='running'");
    return db;
  }).catch((error: unknown) => { connection = null; throw error; });
}

function enqueue<T>(operation: (db: SQLiteDatabase) => Promise<T>): Promise<T> {
  const next = operations.then(async () => operation(await database()));
  // Serialize reads too, so nothing joins another operation's transaction.
  operations = next.then(() => undefined, () => undefined);
  return next;
}

type SessionRow = Omit<Session, 'trackEnabled'> & { trackEnabled: number };
const fromRow = (row: SessionRow): Session => ({ ...row, trackEnabled: !!row.trackEnabled });

export async function loadPreferences() {
  return enqueue(async db => {
    const row = await db.getFirstAsync<{ value: string }>('SELECT value FROM preferences WHERE id=1');
    return row ? parsePreferences(row.value) : defaultPreferences;
  });
}

export const savePreferences = (preferences: Preferences) => enqueue(async (db) => {
  await db.runAsync('INSERT OR REPLACE INTO preferences(id,value) VALUES(1,?)', JSON.stringify(preferences));
});

export function saveSession(session: Session, encounters: Encounter[] = [], points: TrackPoint[] = []) {
  const at = Date.now();
  const snapshot = { ...session, listeningMs: listeningTime(session, at),
    activeStartedAt: session.activeStartedAt === null ? null : at, updatedAt: at };
  return enqueue(async (db) => {
    await db.withTransactionAsync(async () => {
      const tx = db;
      await tx.runAsync(`INSERT INTO sessions(id,startedAt,updatedAt,endedAt,listeningMs,activeStartedAt,status,trackEnabled,segment)
        VALUES(?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET updatedAt=excluded.updatedAt,
        endedAt=excluded.endedAt,listeningMs=excluded.listeningMs,activeStartedAt=excluded.activeStartedAt,
        status=excluded.status,segment=excluded.segment`,
      snapshot.id, snapshot.startedAt, snapshot.updatedAt, snapshot.endedAt, snapshot.listeningMs,
      snapshot.activeStartedAt, snapshot.status, Number(snapshot.trackEnabled), snapshot.segment);
      for (const e of encounters) {
        await tx.runAsync(`INSERT INTO encounters VALUES(?,?,?,?,?,?,?,?,?,?,?,?)
          ON CONFLICT(id) DO UPDATE SET lastHeard=excluded.lastHeard,best=excluded.best`,
        e.id, e.sessionId, e.scientific, e.common, e.modelIndex, e.firstHeard, e.lastHeard, e.best, e.segment,
        e.latitude, e.longitude, e.accuracy);
      }
      for (const p of points) await tx.runAsync('INSERT OR IGNORE INTO trackPoints VALUES(?,?,?,?,?,?)',
        p.sessionId, p.at, p.latitude, p.longitude, p.accuracy, p.segment);
    });
  });
}

export async function loadOpenSession() {
  return enqueue(async db => {
    const row = await db.getFirstAsync<SessionRow>("SELECT * FROM sessions WHERE status!='ended' ORDER BY startedAt DESC LIMIT 1");
    return row ? fromRow(row) : null;
  });
}
export async function loadSession(id: string) {
  return enqueue(async db => {
    const row = await db.getFirstAsync<SessionRow>('SELECT * FROM sessions WHERE id=?', id);
    return row ? fromRow(row) : null;
  });
}
export async function loadEncounters(id: string) {
  return enqueue(db => db.getAllAsync<Encounter>('SELECT * FROM encounters WHERE sessionId=? ORDER BY firstHeard', id));
}
export async function loadTrack(id: string) {
  return enqueue(db => db.getAllAsync<TrackPoint>('SELECT * FROM trackPoints WHERE sessionId=? ORDER BY at', id));
}
export const discardSession = (id: string) => enqueue(async (db) => {
  await db.runAsync('DELETE FROM sessions WHERE id=?', id);
});
export async function listSessions(offset = 0) {
  const rows = await enqueue(db => db.getAllAsync<SessionRow & { speciesCount: number; encounterCount: number }>(`
    SELECT s.*, COUNT(DISTINCT e.scientific) AS speciesCount, COUNT(e.id) AS encounterCount FROM sessions s
    JOIN encounters e ON e.sessionId=s.id GROUP BY s.id ORDER BY s.startedAt DESC LIMIT 30 OFFSET ?`, offset));
  return rows.map(row => ({ ...fromRow(row), speciesCount: row.speciesCount, encounterCount: row.encounterCount })) satisfies SessionSummary[];
}
export async function listBirds(search = '', offset = 0, scientific?: string) {
  const query = `%${search.replace(/[\\%_]/g, '\\$&')}%`;
  return enqueue(db => db.getAllAsync<BirdSummary>(`SELECT scientific, MAX(common) AS common, MAX(modelIndex) AS modelIndex,
    COUNT(*) AS count, MAX(best) AS best, MIN(firstHeard) AS firstHeard, MAX(lastHeard) AS lastHeard FROM encounters
    WHERE (common LIKE ? ESCAPE '\\' OR scientific LIKE ? ESCAPE '\\') AND (? IS NULL OR scientific=?)
    GROUP BY scientific ORDER BY lastHeard DESC LIMIT 40 OFFSET ?`, query, query, scientific ?? null, scientific ?? null, offset));
}
export async function totals() {
  return enqueue(db => db.getFirstAsync<{ sessions: number; species: number; encounters: number; listeningMs: number }>(`
    SELECT (SELECT COUNT(*) FROM sessions WHERE id IN (SELECT sessionId FROM encounters)) AS sessions,
    COUNT(DISTINCT scientific) AS species, COUNT(*) AS encounters,
    (SELECT COALESCE(SUM(listeningMs),0) FROM sessions) AS listeningMs FROM encounters`));
}
