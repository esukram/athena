import { z } from 'zod';

import { reorderLecture } from '@athena/domain';

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
  reorderLecture: publicProcedure
    .input(
      z.object({
        lectureId: z.string(),
        newOrder: z.number().int().min(0),
      }),
    )
    .mutation(({ ctx, input }) => {
      return reorderLecture(
        {
          lectureRepository: ctx.lectureRepository,
          unitOfWork: ctx.unitOfWork,
        },
        input,
      );
    }),
  // ponytail: deleting a lecture may leave an order gap; the next reorder
  // renormalizes, so no explicit normalization use case here.
  deleteLecture: publicProcedure
    .input(z.object({ id: z.string() }))
    .mutation(({ ctx, input }) => {
      return ctx.lectureRepository.delete(input.id);
    }),
});
