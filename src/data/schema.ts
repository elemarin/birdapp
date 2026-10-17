export const schema = `
CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY, startedAt INTEGER NOT NULL, updatedAt INTEGER NOT NULL, endedAt INTEGER,
  listeningMs INTEGER NOT NULL, activeStartedAt INTEGER, status TEXT NOT NULL,
  trackEnabled INTEGER NOT NULL, segment INTEGER NOT NULL, modelVersion TEXT NOT NULL DEFAULT 'BirdNET-2.4'
);
CREATE TABLE IF NOT EXISTS encounters (
  id TEXT PRIMARY KEY, sessionId TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  scientific TEXT NOT NULL, common TEXT NOT NULL, modelIndex INTEGER NOT NULL,
  firstHeard INTEGER NOT NULL, lastHeard INTEGER NOT NULL, best REAL NOT NULL, segment INTEGER NOT NULL,
  latitude REAL, longitude REAL, accuracy REAL
);
CREATE INDEX IF NOT EXISTS encounters_session ON encounters(sessionId, firstHeard);
CREATE INDEX IF NOT EXISTS encounters_species ON encounters(scientific, lastHeard);
CREATE INDEX IF NOT EXISTS sessions_date ON sessions(startedAt DESC);
CREATE TABLE IF NOT EXISTS trackPoints (
  sessionId TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE, at INTEGER NOT NULL,
  latitude REAL NOT NULL, longitude REAL NOT NULL, accuracy REAL NOT NULL, segment INTEGER NOT NULL,
  PRIMARY KEY(sessionId, at)
);
CREATE TABLE IF NOT EXISTS preferences (id INTEGER PRIMARY KEY CHECK(id=1), value TEXT NOT NULL);
PRAGMA user_version = 1;
`;
