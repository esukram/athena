import { z } from 'zod';

import { publicProcedure, router } from '../trpc';

export const chaptersRouter = router({
  getChapters: publicProcedure
    .input(z.object({ lectureId: z.string() }))
    .query(({ ctx, input }) => {
      return ctx.chapterRepository.getByLectureId(input.lectureId);
    }),
  searchChapters: publicProcedure
    .input(z.object({ query: z.string() }))
    .query(({ ctx, input }) => {
      return ctx.chapterRepository.search(input.query);
    }),
  createChapter: publicProcedure
    .input(
      z.object({
        lectureId: z.string(),
        association: z.string().default(''),
        order: z.number().int().min(0),
      }),
    )
    .mutation(({ ctx, input }) => {
      return ctx.chapterRepository.create(input);
    }),
  updateChapter: publicProcedure
    .input(
      z.object({
        id: z.string(),
        association: z.string().optional(),
        order: z.number().int().min(0).optional(),
      }),
    )
    .mutation(({ ctx, input }) => {
      const { id, ...data } = input;
      return ctx.chapterRepository.update(id, data);
    }),
  deleteChapter: publicProcedure
    .input(z.object({ id: z.string() }))
    .mutation(({ ctx, input }) => {
      return ctx.chapterRepository.delete(input.id);
    }),
});
