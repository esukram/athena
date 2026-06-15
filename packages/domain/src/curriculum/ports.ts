import type { Chapter, Lecture, LectureListItem, Question } from './types.js';

/**
 * Repository ports for the curriculum context. These are the contracts the
 * application/domain layer depends on; concrete SQLite adapters live in
 * `apps/server`. They intentionally carry no persistence-technology types so
 * the dependency direction stays presentation → domain ← infrastructure.
 */

export interface LectureRepository {
  getAll: () => LectureListItem[];
  getById: (id: string) => Lecture | undefined;
  create: (lecture: Omit<Lecture, 'id'>) => Lecture;
  update: (id: string, lecture: Omit<Lecture, 'id'>) => Lecture | undefined;
  delete: (id: string) => boolean;
}

export interface ChapterRepository {
  getById: (id: string) => Chapter | undefined;
  getByLectureId: (lectureId: string) => Chapter[];
  getDistinctAssociations: () => string[];
  search: (query: string) => (Chapter & { firstQuestion?: Question })[];
  create: (chapter: Omit<Chapter, 'id'>) => Chapter;
  update: (
    id: string,
    chapter: Partial<Omit<Chapter, 'id'>>,
  ) => Chapter | undefined;
  delete: (id: string) => boolean;
}

export interface QuestionRepository {
  getByChapterId: (chapterId: string) => Question[];
  getFirstByChapterId: (chapterId: string) => Question | undefined;
  getFirstByLectureId: (lectureId: string) => Record<string, Question>;
  getAnnotatedChapterIdsByLecture: (lectureId: string) => string[];
  create: (question: Omit<Question, 'id'>) => Question;
  update: (
    id: string,
    question: Partial<Omit<Question, 'id'>>,
  ) => Question | undefined;
  delete: (id: string) => boolean;
  getQuestionCountsByLecture: (lectureId: string) => number;
  getQuestionCountsPerChapter: (lectureId: string) => Record<string, number>;
}
