import { ZodError } from 'zod';

import { initTRPC } from '@trpc/server';

import type { Chapter, Lecture } from './types';

export interface LectureRepository {
  getAll: () => Lecture[];
  getById: (id: string) => Lecture | undefined;
  create: (lecture: Omit<Lecture, 'id'>) => Lecture;
  update: (id: string, lecture: Omit<Lecture, 'id'>) => Lecture | undefined;
  delete: (id: string) => boolean;
}

export interface ChapterRepository {
  getByLectureId: (lectureId: string) => Chapter[];
  create: (chapter: Omit<Chapter, 'id'>) => Chapter;
  update: (
    id: string,
    chapter: Partial<Omit<Chapter, 'id'>>,
  ) => Chapter | undefined;
  delete: (id: string) => boolean;
}

export interface AppContext {
  lectureRepository: LectureRepository;
  chapterRepository: ChapterRepository;
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
