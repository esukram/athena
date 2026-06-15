import { ZodError } from 'zod';

import { initTRPC } from '@trpc/server';

import type {
  ChapterRepository,
  LectureRepository,
  QuestionRepository,
  SpeechService,
  UnitOfWork,
} from '@athena/domain';

export type {
  ChapterRepository,
  LectureRepository,
  QuestionRepository,
  UnitOfWork,
} from '@athena/domain';

export interface AppContext {
  lectureRepository: LectureRepository;
  chapterRepository: ChapterRepository;
  questionRepository: QuestionRepository;
  unitOfWork: UnitOfWork;
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
