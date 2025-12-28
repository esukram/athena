import { chaptersRouter } from './routers/chapters';
import { helloRouter } from './routers/hello';
import { lecturesRouter } from './routers/lectures';
import { router } from './trpc';

export const appRouter = router({
  hello: helloRouter,
  lectures: lecturesRouter,
  chapters: chaptersRouter,
});

export type AppRouter = typeof appRouter;
