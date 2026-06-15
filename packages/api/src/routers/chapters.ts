import { z } from 'zod';

import { deleteChapter, moveChapter, reorderChapter } from '@athena/domain';

import { publicProcedure, router } from '../trpc.js';

export const chaptersRouter = router({
  getChapters: publicProcedure
    .input(z.object({ lectureId: z.string() }))
    .query(({ ctx, input }) => {
      return ctx.chapterRepository.getByLectureId(input.lectureId);
    }),
  getDistinctAssociations: publicProcedure.query(({ ctx }) => {
    return ctx.chapterSearchQuery.getDistinctAssociations();
  }),
  searchChapters: publicProcedure
    .input(z.object({ query: z.string() }))
    .query(({ ctx, input }) => {
      return ctx.chapterSearchQuery.search(input.query);
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
      return deleteChapter(
        {
          chapterRepository: ctx.chapterRepository,
          unitOfWork: ctx.unitOfWork,
        },
        input,
      );
    }),
  moveChapter: publicProcedure
    .input(
      z.object({
        chapterId: z.string(),
        targetLectureId: z.string(),
      }),
    )
    .mutation(({ ctx, input }) => {
      return moveChapter(
        {
          chapterRepository: ctx.chapterRepository,
          unitOfWork: ctx.unitOfWork,
        },
        input,
      );
    }),
  reorderChapter: publicProcedure
    .input(
      z.object({
        chapterId: z.string(),
        lectureId: z.string(),
        newOrder: z.number().int().min(0),
      }),
    )
    .mutation(({ ctx, input }) => {
      return reorderChapter(
        {
          chapterRepository: ctx.chapterRepository,
          unitOfWork: ctx.unitOfWork,
        },
        input,
      );
    }),
});
