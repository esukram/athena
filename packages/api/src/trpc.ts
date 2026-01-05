import { ZodError } from 'zod';

import { initTRPC } from '@trpc/server';

import type { Chapter, Lecture, Question, SpeechService } from './types.js';

export interface LectureRepository {
  getAll: () => Lecture[];
  getById: (id: string) => Lecture | undefined;
  create: (lecture: Omit<Lecture, 'id'>) => Lecture;
  update: (id: string, lecture: Omit<Lecture, 'id'>) => Lecture | undefined;
  delete: (id: string) => boolean;
}

export interface ChapterRepository {
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

export interface AppContext {
  lectureRepository: LectureRepository;
  chapterRepository: ChapterRepository;
  questionRepository: QuestionRepository;
  speechService?: SpeechService;
}

export const createContext = (deps: AppContext) => async () => {
  return deps;
};

type Context = AppContext;

const t = initTRPC.context<Context>().create({
  errorFormatter({ shape, error }) {
    return {
      ...shape,
      data: {
        ...shape.data,
        zodError:
          error.cause instanceof ZodError ? error.cause.flatten() : null,
      },
    };
  },
});

export const router = t.router;
export const publicProcedure = t.procedure;
