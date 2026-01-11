import { z } from 'zod';

import { publicProcedure, router } from '../trpc.js';

export const speechRouter = router({
  synthesize: publicProcedure
    .input(
      z.object({
        text: z.string().min(1),
        language: z.enum(['de', 'en']),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      if (!ctx.speechService) {
        throw new Error('Speech service not configured');
      }
      return ctx.speechService.synthesize(input.text, input.language);
    }),

  isConfigured: publicProcedure.query(({ ctx }) => {
    return ctx.speechService?.isConfigured() ?? false;
  }),

  transcribe: publicProcedure
    .input(
      z.object({
        audioData: z.string().min(1),
        language: z.enum(['de', 'en']),
        sampleRate: z.number().min(8000).max(48000).default(16000),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      if (!ctx.speechService) {
        throw new Error('Speech service not configured');
      }
      return ctx.speechService.transcribe(
        input.audioData,
        input.language,
        input.sampleRate,
      );
    }),
});
