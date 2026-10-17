import { DatabaseSync } from 'node:sqlite';

let instance;
export async function openDatabaseAsync() {
  if (instance) return instance;
  const db = new DatabaseSync(':memory:');
  instance = {
    async execAsync(sql) { db.exec(sql); },
    async runAsync(sql, ...params) { return db.prepare(sql).run(...params); },
    async getFirstAsync(sql, ...params) { return db.prepare(sql).get(...params) ?? null; },
    async getAllAsync(sql, ...params) { return db.prepare(sql).all(...params); },
    async withTransactionAsync(action) {
      db.exec('BEGIN IMMEDIATE');
      try { await action(); db.exec('COMMIT'); }
      catch (error) { db.exec('ROLLBACK'); throw error; }
    },
  };
  return instance;
}
