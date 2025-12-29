import { chaptersRouter } from './routers/chapters';
import { lecturesRouter } from './routers/lectures';
import { router } from './trpc';

export const appRouter = router({
  lectures: lecturesRouter,
  chapters: chaptersRouter,
});

export type AppRouter = typeof appRouter;
