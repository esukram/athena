import { router, publicProcedure } from './trpc';
import { z } from 'zod';

export const appRouter = router({
  hello: publicProcedure
    .input(z.object({ text: z.string() }))
    .query(({ input }) => {
      return {
        greeting: `Hello ${input.text} from Fastify + tRPC!`,
        timestamp: new Date().toISOString()
      };
    }),
});

export type AppRouter = typeof appRouter;
