import { chaptersRouter } from './routers/chapters';
import { lecturesRouter } from './routers/lectures';
import { questionsRouter } from './routers/questions';
import { router } from './trpc';

export const appRouter = router({
  lectures: lecturesRouter,
  chapters: chaptersRouter,
  questions: questionsRouter,
});

export type AppRouter = typeof appRouter;
