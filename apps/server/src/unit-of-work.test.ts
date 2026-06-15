import Database from 'better-sqlite3';
import { describe, expect, it } from 'vitest';

import { reorderChapter } from '@athena/domain';

import { runMigrations } from './migration.js';
import { createChapterRepository } from './repositories.js';
import { createUnitOfWork } from './unit-of-work.js';

function seedLecture(db: Database.Database, chapterCount: number) {
  db.prepare(
    'INSERT INTO lectures (id, title, description) VALUES (?, ?, ?)',
  ).run('L1', 'Lecture', 'Desc');
  const insert = db.prepare(
    'INSERT INTO chapters (id, lectureId, association, "order") VALUES (?, ?, ?, ?)',
  );
  for (let i = 0; i < chapterCount; i++) {
    insert.run(`c${i}`, 'L1', '', i);
  }
}

describe('createUnitOfWork', () => {
  it('commits all writes when work succeeds', () => {
    const db = new Database(':memory:');
    runMigrations(db);
    seedLecture(db, 3);
    const unitOfWork = createUnitOfWork(db);

    unitOfWork.run(() => {
      db.prepare('UPDATE chapters SET "order" = ? WHERE id = ?').run(10, 'c0');
      db.prepare('UPDATE chapters SET "order" = ? WHERE id = ?').run(11, 'c1');
    });

    const orders = db
      .prepare('SELECT id, "order" FROM chapters ORDER BY id')
      .all() as { id: string; order: number }[];
    expect(orders).toEqual([
      { id: 'c0', order: 10 },
      { id: 'c1', order: 11 },
      { id: 'c2', order: 2 },
    ]);
  });

  it('rolls back every write when work throws', () => {
    const db = new Database(':memory:');
    runMigrations(db);
    seedLecture(db, 3);
    const unitOfWork = createUnitOfWork(db);

    expect(() =>
      unitOfWork.run(() => {
        db.prepare('UPDATE chapters SET "order" = ? WHERE id = ?').run(
          10,
          'c0',
        );
        throw new Error('boom');
      }),
    ).toThrow('boom');

    // The first write must not survive the rollback.
    const c0 = db
      .prepare('SELECT "order" AS o FROM chapters WHERE id = ?')
      .get('c0') as { o: number };
    expect(c0.o).toBe(0);
  });

  it('makes a reorder use case atomic end-to-end', () => {
    const db = new Database(':memory:');
    runMigrations(db);
    seedLecture(db, 4);
    const chapterRepository = createChapterRepository(db);
    const unitOfWork = createUnitOfWork(db);

    reorderChapter(
      { chapterRepository, unitOfWork },
      { chapterId: 'c3', lectureId: 'L1', newOrder: 0 },
    );

    const orders = chapterRepository.getByLectureId('L1').map((c) => c.id);
    expect(orders).toEqual(['c3', 'c0', 'c1', 'c2']);
  });
});
