import { ZodError } from 'zod';

import { TRPCError, initTRPC } from '@trpc/server';

import {
  type ChapterRepository,
  type ChapterSearchQuery,
  type LectureOverviewQuery,
  type LectureRepository,
  NotFoundError,
  type QuestionRepository,
  type QuestionStatsQuery,
  type SpeechService,
  type UnitOfWork,
  ValidationError,
} from '@athena/domain';

export type {
  ChapterRepository,
  ChapterSearchQuery,
  LectureOverviewQuery,
  LectureRepository,
  QuestionRepository,
  QuestionStatsQuery,
  UnitOfWork,
} from '@athena/domain';

export interface AppContext {
  lectureRepository: LectureRepository;
  chapterRepository: ChapterRepository;
  questionRepository: QuestionRepository;
  lectureOverviewQuery: LectureOverviewQuery;
  chapterSearchQuery: ChapterSearchQuery;
  questionStatsQuery: QuestionStatsQuery;
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

/**
 * Translates domain errors thrown by use cases into the matching tRPC
 * transport codes, in one place, so a missing aggregate surfaces as
 * `NOT_FOUND` and an invariant violation as `BAD_REQUEST` instead of leaking
 * as `INTERNAL_SERVER_ERROR`. Non-domain errors pass through unchanged.
 */
const domainErrorMapper = t.middleware(async ({ next }) => {
  const result = await next();
  if (result.ok) return result;

  const error = result.error.cause;
  if (error instanceof NotFoundError) {
    throw new TRPCError({
      code: 'NOT_FOUND',
      message: error.message,
      cause: error,
    });
  }
  if (error instanceof ValidationError) {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: error.message,
      cause: error,
    });
  }
  return result;
});

export const publicProcedure = t.procedure.use(domainErrorMapper);
