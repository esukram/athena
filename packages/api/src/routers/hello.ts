import { z } from 'zod';

import { publicProcedure, router } from '../trpc';

export const helloRouter = router({
  hello: publicProcedure
    .input(z.object({ text: z.string() }))
    .query(({ input }) => {
      return {
        greeting: `Hello ${input.text} from Fastify + tRPC!`,
        timestamp: new Date().toISOString(),
      };
    }),
});
