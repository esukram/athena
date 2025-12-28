import { z } from 'zod';

import { publicProcedure, router } from './trpc';

export const appRouter = router({
  hello: publicProcedure
    .input(z.object({ text: z.string() }))
    .query(({ input }) => {
      return {
        greeting: `Hello ${input.text} from Fastify + tRPC!`,
        timestamp: new Date().toISOString(),
      };
    }),
  getLectures: publicProcedure.query(({ ctx }) => {
    return ctx.lectureRepository.getAll();
  }),
  createLecture: publicProcedure
    .input(
      z.object({
        title: z.string().min(1),
        subtitle: z.string().min(1),
        description: z.string().min(1),
      }),
    )
    .mutation(({ ctx, input }) => {
      return ctx.lectureRepository.create(input);
    }),
});

export type AppRouter = typeof appRouter;
