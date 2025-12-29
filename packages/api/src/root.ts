import { chaptersRouter } from './routers/chapters.js';
import { lecturesRouter } from './routers/lectures.js';
import { questionsRouter } from './routers/questions.js';
import { router } from './trpc.js';

export const appRouter = router({
  lectures: lecturesRouter,
  chapters: chaptersRouter,
  questions: questionsRouter,
});

export type AppRouter = typeof appRouter;
