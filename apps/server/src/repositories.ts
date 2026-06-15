import { type Database } from 'better-sqlite3';

import {
  type Chapter,
  type ChapterRepository,
  type Lecture,
  type LectureRepository,
  type Question,
  type QuestionRepository,
} from '@athena/domain';

export function createLectureRepository(db: Database): LectureRepository {
  return {
    getById: (id: string): Lecture | undefined => {
      return db.prepare('SELECT * FROM lectures WHERE id = ?').get(id) as
        | Lecture
        | undefined;
    },
    create: (lecture: Omit<Lecture, 'id'>): Lecture => {
      const id = crypto.randomUUID();
      db.prepare(
        'INSERT INTO lectures (id, title, description) VALUES (?, ?, ?)',
      ).run(id, lecture.title, lecture.description);
      return { id, ...lecture };
    },
    update: (
      id: string,
      lecture: Partial<Omit<Lecture, 'id'>>,
    ): Lecture | undefined => {
      const existing = db
        .prepare('SELECT * FROM lectures WHERE id = ?')
        .get(id) as Lecture | undefined;
      if (!existing) return undefined;
      const updated = { ...existing, ...lecture };
      db.prepare(
        'UPDATE lectures SET title = ?, description = ? WHERE id = ?',
      ).run(updated.title, updated.description, id);
      return updated;
    },
    delete: (id: string): boolean => {
      const result = db.prepare('DELETE FROM lectures WHERE id = ?').run(id);
      return result.changes > 0;
    },
  };
}

export function createChapterRepository(db: Database): ChapterRepository {
  return {
    getById: (id: string): Chapter | undefined => {
      return db.prepare('SELECT * FROM chapters WHERE id = ?').get(id) as
        | Chapter
        | undefined;
    },
    getByLectureId: (lectureId: string): Chapter[] => {
      return db
        .prepare('SELECT * FROM chapters WHERE lectureId = ? ORDER BY "order"')
        .all(lectureId) as Chapter[];
    },
    create: (chapter: Omit<Chapter, 'id'>): Chapter => {
      const id = crypto.randomUUID();
      db.prepare(
        'INSERT INTO chapters (id, lectureId, association, "order") VALUES (?, ?, ?, ?)',
      ).run(id, chapter.lectureId, chapter.association, chapter.order);
      return { id, ...chapter };
    },
    update: (
      id: string,
      chapter: Partial<Omit<Chapter, 'id'>>,
    ): Chapter | undefined => {
      const existing = db
        .prepare('SELECT * FROM chapters WHERE id = ?')
        .get(id) as Chapter | undefined;
      if (!existing) return undefined;
      const updated = { ...existing, ...chapter };
      db.prepare(
        'UPDATE chapters SET lectureId = ?, association = ?, "order" = ? WHERE id = ?',
      ).run(updated.lectureId, updated.association, updated.order, id);
      return updated;
    },
    delete: (id: string): boolean => {
      const result = db.prepare('DELETE FROM chapters WHERE id = ?').run(id);
      return result.changes > 0;
    },
  };
}

export function createQuestionRepository(db: Database): QuestionRepository {
  return {
    getByChapterId: (chapterId: string): Question[] => {
      return db
        .prepare('SELECT * FROM questions WHERE chapterId = ? ORDER BY "order"')
        .all(chapterId) as Question[];
    },
    getFirstByChapterId: (chapterId: string): Question | undefined => {
      return db
        .prepare(
          'SELECT * FROM questions WHERE chapterId = ? ORDER BY "order" LIMIT 1',
        )
        .get(chapterId) as Question | undefined;
    },
    create: (question: Omit<Question, 'id'>): Question => {
      const id = crypto.randomUUID();
      db.prepare(
        'INSERT INTO questions (id, chapterId, question, answer, "order", isAnnotated) VALUES (?, ?, ?, ?, ?, ?)',
      ).run(
        id,
        question.chapterId,
        question.question,
        question.answer,
        question.order,
        question.isAnnotated ? 1 : 0,
      );
      return { id, ...question };
    },
    update: (
      id: string,
      question: Partial<Omit<Question, 'id'>>,
    ): Question | undefined => {
      const existing = db
        .prepare('SELECT * FROM questions WHERE id = ?')
        .get(id) as Question | undefined;
      if (!existing) return undefined;
      const updated = { ...existing, ...question };
      db.prepare(
        'UPDATE questions SET question = ?, answer = ?, "order" = ?, isAnnotated = ? WHERE id = ?',
      ).run(
        updated.question,
        updated.answer,
        updated.order,
        // Ensure boolean/number compatibility
        question.isAnnotated !== undefined
          ? question.isAnnotated
            ? 1
            : 0
          : existing.isAnnotated,
        id,
      );
      return updated;
    },
    delete: (id: string): boolean => {
      const result = db.prepare('DELETE FROM questions WHERE id = ?').run(id);
      return result.changes > 0;
    },
  };
}
