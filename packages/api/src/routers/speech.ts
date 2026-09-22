import { z } from 'zod';

import { verbalizeSymbols } from '@athena/domain';

import { publicProcedure, router } from '../trpc.js';

export const speechRouter = router({
  synthesize: publicProcedure
    .input(
      z.object({
        // Caps paid-provider fan-out per request (Google splits at 4800 bytes,
        // one billable call per chunk). Longest real answer is ~1.5k chars.
        text: z.string().min(1).max(10_000),
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
