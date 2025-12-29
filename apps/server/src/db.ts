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
    "order" INTEGER NOT NULL,
    FOREIGN KEY (lectureId) REFERENCES lectures(id) ON DELETE CASCADE
  )
`);

// Migration: Add body column if it doesn't exist (for existing databases)
const tableInfo = db.prepare('PRAGMA table_info(chapters)').all() as {
  name: string;
}[];
const hasBodyColumn = tableInfo.some((col) => col.name === 'body');
if (!hasBodyColumn) {
  db.exec(`ALTER TABLE chapters ADD COLUMN body TEXT NOT NULL DEFAULT ''`);
}

const defaultLectures = [
  {
    id: '1',
    title: 'Introduction to React',
    description: 'Learn the basics of React, components, and state.',
  },
  {
    id: '2',
    title: 'Advanced TypeScript',
    description: 'Deep dive into Generics, Utility types, and more.',
  },
  {
    id: '3',
    title: 'Material Design 3',
    description: 'Building beautiful UIs with Google Material 3.',
  },
  {
    id: '4',
    title: 'Server-Side Rendering',
    description: 'Understanding SSR with Node.js and frameworks.',
  },
];

const count = db.prepare('SELECT COUNT(*) as count FROM lectures').get() as {
  count: number;
};
if (count.count === 0) {
  const insert = db.prepare(
    'INSERT INTO lectures (id, title, description) VALUES (?, ?, ?)',
  );
  for (const lecture of defaultLectures) {
    insert.run(
      lecture.id,
      lecture.title,
      lecture.description,
    );
  }
}
