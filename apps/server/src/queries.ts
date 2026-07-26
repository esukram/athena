import { type Database } from 'better-sqlite3';

import {
  type Chapter,
  type ChapterSearchQuery,
  type ChapterSearchResult,
  type LectureListItem,
  type LectureOverviewQuery,
  type Question,
  type QuestionStatsQuery,
} from '@athena/domain';

export function createLectureOverviewQuery(db: Database): LectureOverviewQuery {
  return {
    getAll: (): LectureListItem[] => {
      return db
        .prepare(
          `SELECT
             l.id, l.title, l.description, l."order",
             COUNT(DISTINCT c.id) AS chapterCount,
             COUNT(q.id)          AS questionCount
           FROM lectures l
           LEFT JOIN chapters c ON c.lectureId = l.id
           LEFT JOIN questions q ON q.chapterId = c.id
           GROUP BY l.id, l.title, l.description, l."order"
           ORDER BY l."order", l.id`,
        )
        .all() as LectureListItem[];
    },
  };
}

export function createChapterSearchQuery(db: Database): ChapterSearchQuery {
  return {
    getDistinctAssociations: (): string[] => {
      const rows = db
        .prepare(
          "SELECT DISTINCT association FROM chapters WHERE association != '' ORDER BY association",
        )
        .all() as { association: string }[];
      return rows.map((row) => row.association);
    },
    search: (query: string): ChapterSearchResult[] => {
      if (!query.trim()) return [];

      const tokens = query.toLowerCase().split(/\s+/).filter(Boolean);
      if (tokens.length === 0) return [];

      const questionConditions = tokens
        .map(() => 'LOWER(q.question) LIKE ?')
        .join(' AND ');
      const associationConditions = tokens
        .map(() => 'LOWER(c.association) LIKE ?')
        .join(' AND ');
      const tokenParams = tokens.map((token) => `%${token}%`);

      // Chapters that match via ANY question or the association.
      const chapters = db
        .prepare(
          `SELECT DISTINCT c.* FROM chapters c
           LEFT JOIN questions q ON q.chapterId = c.id
           WHERE (${questionConditions}) OR (${associationConditions})
           ORDER BY c."order"`,
        )
        .all(...tokenParams, ...tokenParams) as Chapter[];

      if (chapters.length === 0) return [];

      const chapterIds = chapters.map((chapter) => chapter.id);
      const idPlaceholders = chapterIds.map(() => '?').join(', ');

      // One query for the questions that match the search within those
      // chapters, and one for every chapter's first question as a fallback —
      // replacing the previous per-chapter (N+1) lookups. Ordered by `order`
      // so the first row seen per chapter is the one we want.
      const matchConditions = tokens
        .map(() => 'LOWER(question) LIKE ?')
        .join(' AND ');
      const matchingQuestions = db
        .prepare(
          `SELECT * FROM questions
           WHERE chapterId IN (${idPlaceholders}) AND (${matchConditions})
           ORDER BY chapterId, "order"`,
        )
        .all(...chapterIds, ...tokenParams) as Question[];

      const firstQuestions = db
        .prepare(
          `SELECT * FROM questions
           WHERE chapterId IN (${idPlaceholders})
           ORDER BY chapterId, "order"`,
        )
        .all(...chapterIds) as Question[];

      const firstByChapter = (rows: Question[]): Map<string, Question> => {
        const map = new Map<string, Question>();
        for (const question of rows) {
          if (!map.has(question.chapterId))
            map.set(question.chapterId, question);
        }
        return map;
      };

      const matchMap = firstByChapter(matchingQuestions);
      const fallbackMap = firstByChapter(firstQuestions);

      return chapters.map((chapter) => ({
        ...chapter,
        firstQuestion: matchMap.get(chapter.id) ?? fallbackMap.get(chapter.id),
      }));
    },
  };
}

export function createQuestionStatsQuery(db: Database): QuestionStatsQuery {
  return {
    getFirstByLectureId: (lectureId: string): Record<string, Question> => {
      const rows = db
        .prepare(
          `SELECT q.* FROM questions q
           INNER JOIN (
             SELECT chapterId, MIN("order") as minOrder
             FROM questions
             WHERE chapterId IN (SELECT id FROM chapters WHERE lectureId = ?)
             GROUP BY chapterId
           ) first ON q.chapterId = first.chapterId AND q."order" = first.minOrder`,
        )
        .all(lectureId) as Question[];

      const result: Record<string, Question> = {};
      for (const question of rows) {
        result[question.chapterId] = question;
      }
      return result;
    },
    getAnnotatedChapterIdsByLecture: (lectureId: string): string[] => {
      const rows = db
        .prepare(
          `SELECT DISTINCT q.chapterId FROM questions q
           INNER JOIN chapters c ON q.chapterId = c.id
           WHERE c.lectureId = ? AND q.isAnnotated = 1`,
        )
        .all(lectureId) as { chapterId: string }[];
      return rows.map((row) => row.chapterId);
    },
    getQuestionCountsByLecture: (lectureId: string): number => {
      const result = db
        .prepare(
          `SELECT COUNT(*) as count FROM questions q
           INNER JOIN chapters c ON q.chapterId = c.id
           WHERE c.lectureId = ?`,
        )
        .get(lectureId) as { count: number };
      return result.count;
    },
    getQuestionCountsPerChapter: (
      lectureId: string,
    ): Record<string, number> => {
      const rows = db
        .prepare(
          `SELECT c.id as chapterId, COUNT(q.id) as count
           FROM chapters c
           LEFT JOIN questions q ON q.chapterId = c.id
           WHERE c.lectureId = ?
           GROUP BY c.id`,
        )
        .all(lectureId) as { chapterId: string; count: number }[];
      const result: Record<string, number> = {};
      for (const row of rows) {
        result[row.chapterId] = row.count;
      }
      return result;
    },
  };
}
