import Database from 'better-sqlite3';
import { describe, expect, it } from 'vitest';

import { runMigrations } from './migration.js';
import { createLectureRepository } from './repositories.js';

describe('createLectureRepository update', () => {
  it('applies a partial patch, leaving other fields intact', () => {
    const db = new Database(':memory:');
    runMigrations(db);
    db.prepare(
      'INSERT INTO lectures (id, title, description) VALUES (?, ?, ?)',
    ).run('lecture-a', 'Original Title', 'Original Description');

    const repository = createLectureRepository(db);
    const updated = repository.update('lecture-a', { title: 'New Title' });

    expect(updated).toEqual({
      id: 'lecture-a',
      title: 'New Title',
      description: 'Original Description',
    });
  });

  it('returns undefined for an unknown lecture', () => {
    const db = new Database(':memory:');
    runMigrations(db);
    const repository = createLectureRepository(db);
    expect(repository.update('missing', { title: 'x' })).toBeUndefined();
  });
});

describe('createLectureRepository getAll', () => {
  it('returns chapter and question counts per lecture', () => {
    const db = new Database(':memory:');
    runMigrations(db);

    // Lecture A: 2 chapters, 3 + 2 questions => chapterCount 2, questionCount 5
    db.prepare(
      'INSERT INTO lectures (id, title, description) VALUES (?, ?, ?)',
    ).run('lecture-a', 'Lecture A', 'Description A');
    // Lecture B: no chapters => chapterCount 0, questionCount 0
    db.prepare(
      'INSERT INTO lectures (id, title, description) VALUES (?, ?, ?)',
    ).run('lecture-b', 'Lecture B', 'Description B');

    db.prepare(
      'INSERT INTO chapters (id, lectureId, association, "order") VALUES (?, ?, ?, ?)',
    ).run('chapter-a1', 'lecture-a', '', 0);
    db.prepare(
      'INSERT INTO chapters (id, lectureId, association, "order") VALUES (?, ?, ?, ?)',
    ).run('chapter-a2', 'lecture-a', '', 1);

    const insertQuestion = db.prepare(
      'INSERT INTO questions (id, chapterId, question, answer, "order", isAnnotated) VALUES (?, ?, ?, ?, ?, ?)',
    );
    insertQuestion.run('q-a1-1', 'chapter-a1', 'Q1', 'A1', 0, 0);
    insertQuestion.run('q-a1-2', 'chapter-a1', 'Q2', 'A2', 1, 0);
    insertQuestion.run('q-a1-3', 'chapter-a1', 'Q3', 'A3', 2, 0);
    insertQuestion.run('q-a2-1', 'chapter-a2', 'Q4', 'A4', 0, 0);
    insertQuestion.run('q-a2-2', 'chapter-a2', 'Q5', 'A5', 1, 0);

    const repository = createLectureRepository(db);
    const lectures = repository.getAll();

    const lectureA = lectures.find((lecture) => lecture.id === 'lecture-a');
    const lectureB = lectures.find((lecture) => lecture.id === 'lecture-b');

    expect(lectureA).toBeDefined();
    expect(lectureA?.chapterCount).toBe(2);
    expect(lectureA?.questionCount).toBe(5);

    expect(lectureB).toBeDefined();
    expect(lectureB?.chapterCount).toBe(0);
    expect(lectureB?.questionCount).toBe(0);
  });
});
