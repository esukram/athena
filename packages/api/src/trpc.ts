import { ZodError } from 'zod';

import { initTRPC } from '@trpc/server';

import type { Lecture } from './types';

export interface LectureRepository {
  getAll: () => Lecture[];
  create: (lecture: Omit<Lecture, 'id'>) => Lecture;
}

export interface AppContext {
  lectureRepository: LectureRepository;
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
