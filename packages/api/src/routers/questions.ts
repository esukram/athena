import { z } from 'zod';

import { publicProcedure, router } from '../trpc';

export const questionsRouter = router({
  getQuestions: publicProcedure
    .input(z.object({ chapterId: z.string() }))
    .query(({ ctx, input }) => {
      return ctx.questionRepository.getByChapterId(input.chapterId);
    }),
  getFirstQuestion: publicProcedure
    .input(z.object({ chapterId: z.string() }))
    .query(({ ctx, input }) => {
      return ctx.questionRepository.getFirstByChapterId(input.chapterId);
    }),
  createQuestion: publicProcedure
    .input(
      z.object({
        chapterId: z.string(),
        question: z.string().min(1),
        answer: z.string().default(''),
        order: z.number().int().min(0),
      }),
    )
    .mutation(({ ctx, input }) => {
      return ctx.questionRepository.create(input);
    }),
  updateQuestion: publicProcedure
    .input(
      z.object({
        id: z.string(),
        question: z.string().min(1).optional(),
        answer: z.string().optional(),
        order: z.number().int().min(0).optional(),
      }),
    )
    .mutation(({ ctx, input }) => {
      const { id, ...data } = input;
      return ctx.questionRepository.update(id, data);
    }),
  deleteQuestion: publicProcedure
    .input(z.object({ id: z.string() }))
    .mutation(({ ctx, input }) => {
      return ctx.questionRepository.delete(input.id);
    }),
});
