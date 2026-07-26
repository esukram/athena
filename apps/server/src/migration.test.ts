import Database from 'better-sqlite3';
import { describe, expect, it } from 'vitest';

import { runMigrations } from './migration.js';

describe('runMigrations lecture ordering', () => {
  it('adds a non-null order column defaulting to zero to a fresh database', () => {
    const db = new Database(':memory:');
    runMigrations(db);

    const orderColumn = db
      .prepare('PRAGMA table_info(lectures)')
      .all()
      .find((column) => (column as { name: string }).name === 'order') as
      | { notnull: number; dflt_value: string }
      | undefined;
    expect(orderColumn).toMatchObject({
      notnull: 1,
      dflt_value: '0',
    });

    db.prepare(
      'INSERT INTO lectures (id, title, description) VALUES (?, ?, ?)',
    ).run('lecture-a', 'Lecture A', 'Description A');
    expect(
      db.prepare('SELECT "order" FROM lectures WHERE id = ?').get('lecture-a'),
    ).toEqual({ order: 0 });
  });

  it('backfills a version 4 database in rowid insertion order', () => {
    const db = new Database(':memory:');
    db.exec(`
      CREATE TABLE version (
        version INTEGER NOT NULL
      );
      INSERT INTO version (version) VALUES (4);
      CREATE TABLE lectures (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        description TEXT NOT NULL
      );
      CREATE TABLE chapters (
        id TEXT PRIMARY KEY,
        lectureId TEXT NOT NULL,
        association TEXT NOT NULL DEFAULT '',
        "order" INTEGER NOT NULL,
        FOREIGN KEY (lectureId) REFERENCES lectures(id) ON DELETE CASCADE
      );
      CREATE TABLE questions (
        id TEXT PRIMARY KEY,
        chapterId TEXT NOT NULL,
        question TEXT NOT NULL,
        answer TEXT NOT NULL DEFAULT '',
        "order" INTEGER NOT NULL,
        FOREIGN KEY (chapterId) REFERENCES chapters(id) ON DELETE CASCADE
      );
      INSERT INTO lectures (id, title, description)
      VALUES
        ('lecture-c', 'Lecture C', 'Description C'),
        ('lecture-a', 'Lecture A', 'Description A'),
        ('lecture-b', 'Lecture B', 'Description B');
    `);

    runMigrations(db);

    expect(
      db.prepare('SELECT id, "order" FROM lectures ORDER BY rowid').all(),
    ).toEqual([
      { id: 'lecture-c', order: 0 },
      { id: 'lecture-a', order: 1 },
      { id: 'lecture-b', order: 2 },
    ]);
  });
});
