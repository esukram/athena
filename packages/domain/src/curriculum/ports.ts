import type { Chapter, Lecture, Question } from './types.js';

/**
 * Repository ports for the curriculum context — aggregate persistence only.
 * Denormalised/cross-aggregate reads (overviews, search, counts) live in the
 * query ports in `read-models.ts`. These contracts carry no
 * persistence-technology types so the dependency direction stays
 * presentation → domain ← infrastructure.
 */

export interface LectureRepository {
  getById: (id: string) => Lecture | undefined;
  create: (lecture: Omit<Lecture, 'id'>) => Lecture;
  // Accepts a partial patch, consistent with the chapter and question
  // repositories, rather than requiring a full replacement object.
  update: (
    id: string,
    lecture: Partial<Omit<Lecture, 'id'>>,
  ) => Lecture | undefined;
  delete: (id: string) => boolean;
}

export interface ChapterRepository {
  getById: (id: string) => Chapter | undefined;
  getByLectureId: (lectureId: string) => Chapter[];
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
  create: (question: Omit<Question, 'id'>) => Question;
  update: (
    id: string,
    question: Partial<Omit<Question, 'id'>>,
  ) => Question | undefined;
  delete: (id: string) => boolean;
}
