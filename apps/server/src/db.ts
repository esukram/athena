import Database, { type Database as DatabaseType } from 'better-sqlite3';
import path from 'path';

const dbPath =
  process.env.DB_PATH || path.join(process.cwd(), '../../athena.db');
export const db: DatabaseType = new Database(dbPath);

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
    title TEXT NOT NULL,
    body TEXT NOT NULL DEFAULT '',
    association TEXT NOT NULL DEFAULT '',
    "order" INTEGER NOT NULL,
    FOREIGN KEY (lectureId) REFERENCES lectures(id) ON DELETE CASCADE
  )
`);
