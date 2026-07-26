import Database from 'better-sqlite3';
import { beforeEach, describe, expect, it } from 'vitest';

import { runMigrations } from './migration.js';
import {
  createChapterSearchQuery,
  createLectureOverviewQuery,
  createQuestionStatsQuery,
} from './queries.js';

function freshDb(): Database.Database {
  const db = new Database(':memory:');
  runMigrations(db);
  return db;
}

const insertLecture = (db: Database.Database, id: string) =>
  db
    .prepare('INSERT INTO lectures (id, title, description) VALUES (?, ?, ?)')
    .run(id, `Title ${id}`, `Desc ${id}`);

const insertChapter = (
  db: Database.Database,
  id: string,
  lectureId: string,
  order: number,
  association = '',
) =>
  db
    .prepare(
      'INSERT INTO chapters (id, lectureId, association, "order") VALUES (?, ?, ?, ?)',
    )
    .run(id, lectureId, association, order);

const insertQuestion = (
  db: Database.Database,
  id: string,
  chapterId: string,
  question: string,
  order: number,
) =>
  db
    .prepare(
      'INSERT INTO questions (id, chapterId, question, answer, "order", isAnnotated) VALUES (?, ?, ?, ?, ?, ?)',
    )
    .run(id, chapterId, question, '', order, 0);

describe('createLectureOverviewQuery', () => {
  it('returns chapter and question counts per lecture', () => {
    const db = freshDb();
    insertLecture(db, 'lecture-a');
    insertLecture(db, 'lecture-b');
    insertChapter(db, 'chapter-a1', 'lecture-a', 0);
    insertChapter(db, 'chapter-a2', 'lecture-a', 1);
    insertQuestion(db, 'q1', 'chapter-a1', 'Q1', 0);
    insertQuestion(db, 'q2', 'chapter-a1', 'Q2', 1);
    insertQuestion(db, 'q3', 'chapter-a1', 'Q3', 2);
    insertQuestion(db, 'q4', 'chapter-a2', 'Q4', 0);
    insertQuestion(db, 'q5', 'chapter-a2', 'Q5', 1);

    const lectures = createLectureOverviewQuery(db).getAll();
    const lectureA = lectures.find((l) => l.id === 'lecture-a');
    const lectureB = lectures.find((l) => l.id === 'lecture-b');

    expect(lectureA?.chapterCount).toBe(2);
    expect(lectureA?.questionCount).toBe(5);
    expect(lectureB?.chapterCount).toBe(0);
    expect(lectureB?.questionCount).toBe(0);
  });

  it('returns order fields and sorts lectures by order without changing counts', () => {
    const db = freshDb();
    insertLecture(db, 'lecture-a');
    insertLecture(db, 'lecture-b');
    insertLecture(db, 'lecture-c');
    db.prepare('UPDATE lectures SET "order" = ? WHERE id = ?').run(
      2,
      'lecture-a',
    );
    db.prepare('UPDATE lectures SET "order" = ? WHERE id = ?').run(
      0,
      'lecture-b',
    );
    db.prepare('UPDATE lectures SET "order" = ? WHERE id = ?').run(
      1,
      'lecture-c',
    );
    insertChapter(db, 'chapter-a1', 'lecture-a', 0);
    insertQuestion(db, 'q-a1', 'chapter-a1', 'A1', 0);
    insertChapter(db, 'chapter-c1', 'lecture-c', 0);
    insertQuestion(db, 'q-c1', 'chapter-c1', 'C1', 0);
    insertQuestion(db, 'q-c2', 'chapter-c1', 'C2', 1);

    expect(createLectureOverviewQuery(db).getAll()).toEqual([
      {
        id: 'lecture-b',
        title: 'Title lecture-b',
        description: 'Desc lecture-b',
        order: 0,
        chapterCount: 0,
        questionCount: 0,
      },
      {
        id: 'lecture-c',
        title: 'Title lecture-c',
        description: 'Desc lecture-c',
        order: 1,
        chapterCount: 1,
        questionCount: 2,
      },
      {
        id: 'lecture-a',
        title: 'Title lecture-a',
        description: 'Desc lecture-a',
        order: 2,
        chapterCount: 1,
        questionCount: 1,
      },
    ]);
  });
});

describe('createChapterSearchQuery', () => {
  let db: Database.Database;

  beforeEach(() => {
    db = freshDb();
    insertLecture(db, 'L1');
    insertChapter(db, 'c1', 'L1', 0, 'algebra');
    insertChapter(db, 'c2', 'L1', 1, 'geometry');
    insertQuestion(db, 'q1a', 'c1', 'What is a matrix', 0);
    insertQuestion(db, 'q1b', 'c1', 'Define eigenvalue', 1);
    insertQuestion(db, 'q2a', 'c2', 'What is a triangle', 0);
  });

  it('attaches the first matching question for a question-text match', () => {
    const results = createChapterSearchQuery(db).search('eigenvalue');
    expect(results).toHaveLength(1);
    expect(results[0].id).toBe('c1');
    expect(results[0].firstQuestion?.id).toBe('q1b');
  });

  it('falls back to the first question for an association match', () => {
    const results = createChapterSearchQuery(db).search('geometry');
    expect(results).toHaveLength(1);
    expect(results[0].id).toBe('c2');
    expect(results[0].firstQuestion?.id).toBe('q2a');
  });

  it('returns nothing for a blank query', () => {
    expect(createChapterSearchQuery(db).search('   ')).toEqual([]);
  });

  it('lists distinct non-empty associations', () => {
    expect(createChapterSearchQuery(db).getDistinctAssociations()).toEqual([
      'algebra',
      'geometry',
    ]);
  });
});

describe('createQuestionStatsQuery', () => {
  it('reports first questions, counts and annotations per lecture', () => {
    const db = freshDb();
    insertLecture(db, 'L1');
    insertChapter(db, 'c1', 'L1', 0);
    insertChapter(db, 'c2', 'L1', 1);
    insertQuestion(db, 'q1', 'c1', 'First c1', 0);
    insertQuestion(db, 'q2', 'c1', 'Second c1', 1);
    insertQuestion(db, 'q3', 'c2', 'First c2', 0);
    db.prepare('UPDATE questions SET isAnnotated = 1 WHERE id = ?').run('q2');

    const query = createQuestionStatsQuery(db);
    expect(query.getQuestionCountsByLecture('L1')).toBe(3);
    expect(query.getQuestionCountsPerChapter('L1')).toEqual({ c1: 2, c2: 1 });
    expect(query.getFirstByLectureId('L1').c1.id).toBe('q1');
    expect(query.getFirstByLectureId('L1').c2.id).toBe('q3');
    expect(query.getAnnotatedChapterIdsByLecture('L1')).toEqual(['c1']);
  });
});
