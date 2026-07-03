import { z } from 'zod';

import { publicProcedure, router } from '../trpc.js';

export const lecturesRouter = router({
  getLectures: publicProcedure.query(({ ctx }) => {
    return ctx.lectureOverviewQuery.getAll();
  }),
  getLecture: publicProcedure
    .input(z.object({ id: z.string() }))
    .query(({ ctx, input }) => {
      return ctx.lectureRepository.getById(input.id);
    }),
  createLecture: publicProcedure
    .input(
      z.object({
        title: z.string().min(1),
        description: z.string().min(1),
      }),
    )
    .mutation(({ ctx, input }) => {
      return ctx.lectureRepository.create(input);
    }),
  updateLecture: publicProcedure
    .input(
      z.object({
        id: z.string(),
        title: z.string().min(1).optional(),
        description: z.string().min(1).optional(),
      }),
    )
    .mutation(({ ctx, input }) => {
      const { id, ...data } = input;
      return ctx.lectureRepository.update(id, data);
    }),
  deleteLecture: publicProcedure
    .input(z.object({ id: z.string() }))
    .mutation(({ ctx, input }) => {
      return ctx.lectureRepository.delete(input.id);
    }),
});
