import Database, { type Database as DatabaseType } from 'better-sqlite3';
import path from 'path';

const dbPath = path.join(process.cwd(), 'athena.db');
export const db: DatabaseType = new Database(dbPath);

db.exec(`
  CREATE TABLE IF NOT EXISTS lectures (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    imageUrl TEXT NOT NULL,
    duration TEXT NOT NULL
  )
`);

const defaultLectures = [
  {
    id: '1',
    title: 'Introduction to React',
    description: 'Learn the basics of React, components, and state.',
    imageUrl: 'https://placehold.co/600x400',
    duration: '45 min',
  },
  {
    id: '2',
    title: 'Advanced TypeScript',
    description: 'Deep dive into Generics, Utility types, and more.',
    imageUrl: 'https://placehold.co/600x400',
    duration: '60 min',
  },
  {
    id: '3',
    title: 'Material Design 3',
    description: 'Building beautiful UIs with Google Material 3.',
    imageUrl: 'https://placehold.co/600x400',
    duration: '30 min',
  },
  {
    id: '4',
    title: 'Server-Side Rendering',
    description: 'Understanding SSR with Node.js and frameworks.',
    imageUrl: 'https://placehold.co/600x400',
    duration: '50 min',
  },
];

const count = db.prepare('SELECT COUNT(*) as count FROM lectures').get() as {
  count: number;
};
if (count.count === 0) {
  const insert = db.prepare(
    'INSERT INTO lectures (id, title, description, imageUrl, duration) VALUES (?, ?, ?, ?, ?)',
  );
  for (const lecture of defaultLectures) {
    insert.run(
      lecture.id,
      lecture.title,
      lecture.description,
      lecture.imageUrl,
      lecture.duration,
    );
  }
}
