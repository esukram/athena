import { z } from 'zod';

import { verbalizeSymbols } from '@athena/domain';

import { publicProcedure, router } from '../trpc.js';

export const speechRouter = router({
  synthesize: publicProcedure
    .input(
      z.object({
        text: z.string().min(1),
        language: z.enum(['de', 'en']),
        format: z.enum(['text', 'ssml']).default('text'),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      if (!ctx.speechService) {
        throw new Error('Speech service not configured');
      }
      // `verbalizeSymbols` is the speech context's shared TTS text-preparation
      // primitive (in `@athena/domain`): the client SSML path applies it inside
      // `markdownToSsml` before XML-escaping, and the raw-text path applies it
      // here, so every provider speaks symbols like `/` and `->` as words
      // rather than spelling them out.
      const text =
        input.format === 'ssml' ? input.text : verbalizeSymbols(input.text);
      return ctx.speechService.synthesize(text, input.language, input.format);
    }),

  isConfigured: publicProcedure.query(({ ctx }) => {
    return ctx.speechService?.isConfigured() ?? false;
  }),
});
