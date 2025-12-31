import { type Database } from 'better-sqlite3';

export function runMigrations(db: Database) {
  // Create version table if it doesn't exist
  db.exec(`
    CREATE TABLE IF NOT EXISTS version (
      version INTEGER NOT NULL
    )
  `);

  // Check current version
  const row = db.prepare('SELECT version FROM version').get() as
    | { version: number }
    | undefined;

  let currentVersion = 0;

  if (!row) {
    // Determine if we are initializing a fresh DB or retrofitting an existing one
    // We check if 'lectures' table exists as a proxy for "schema v1 exists"
    const tableExists = db
      .prepare(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='lectures'",
      )
      .get();

    if (tableExists) {
      // Existing DB, set version to 1
      db.prepare('INSERT INTO version (version) VALUES (1)').run();
      currentVersion = 1;
    } else {
      // Fresh DB, start at 0
      db.prepare('INSERT INTO version (version) VALUES (0)').run();
      currentVersion = 0;
    }
  } else {
    currentVersion = row.version;
  }

  const migrations = [
    // Migration 1: Initial Schema
    (db: Database) => {
      db.exec(`
        CREATE TABLE IF NOT EXISTS lectures (
          id TEXT PRIMARY KEY,
          title TEXT NOT NULL,
          description TEXT NOT NULL
        )
      `);
      db.exec(`
        CREATE TABLE IF NOT EXISTS chapters (
          id TEXT PRIMARY KEY,
          lectureId TEXT NOT NULL,
          association TEXT NOT NULL DEFAULT '',
          "order" INTEGER NOT NULL,
          FOREIGN KEY (lectureId) REFERENCES lectures(id) ON DELETE CASCADE
        )
      `);
      db.exec(`
        CREATE TABLE IF NOT EXISTS questions (
          id TEXT PRIMARY KEY,
          chapterId TEXT NOT NULL,
          question TEXT NOT NULL,
          answer TEXT NOT NULL DEFAULT '',
          "order" INTEGER NOT NULL,
          FOREIGN KEY (chapterId) REFERENCES chapters(id) ON DELETE CASCADE
        )
      `);
    },
  ];

  for (let i = currentVersion; i < migrations.length; i++) {
    console.log(`Running migration ${i + 1}`);
    migrations[i](db);
    db.prepare('UPDATE version SET version = ?').run(i + 1);
  }
}
