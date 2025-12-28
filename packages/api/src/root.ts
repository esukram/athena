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
  getLecture: publicProcedure
    .input(z.object({ id: z.string() }))
    .query(({ ctx, input }) => {
      return ctx.lectureRepository.getById(input.id);
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
  updateLecture: publicProcedure
    .input(
      z.object({
        id: z.string(),
        title: z.string().min(1),
        subtitle: z.string().min(1),
        description: z.string().min(1),
      }),
    )
    .mutation(({ ctx, input }) => {
      const { id, ...data } = input;
      return ctx.lectureRepository.update(id, data);
    }),
  getChapters: publicProcedure
    .input(z.object({ lectureId: z.string() }))
    .query(({ ctx, input }) => {
      return ctx.chapterRepository.getByLectureId(input.lectureId);
    }),
  createChapter: publicProcedure
    .input(
      z.object({
        lectureId: z.string(),
        title: z.string().min(1),
        body: z.string().default(''),
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
        title: z.string().min(1).optional(),
        body: z.string().optional(),
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
  deleteLecture: publicProcedure
    .input(z.object({ id: z.string() }))
    .mutation(({ ctx, input }) => {
      return ctx.lectureRepository.delete(input.id);
    }),
});

export type AppRouter = typeof appRouter;
