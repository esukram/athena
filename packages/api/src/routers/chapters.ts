import { z } from 'zod';

import type { ChapterRepository } from '../trpc.js';
import { publicProcedure, router } from '../trpc.js';

function normalizeChapterOrders(
  chapterRepository: Pick<ChapterRepository, 'getByLectureId' | 'update'>,
  lectureId: string,
): void {
  const chapters = chapterRepository.getByLectureId(lectureId);
  for (let i = 0; i < chapters.length; i++) {
    if (chapters[i].order !== i) {
      chapterRepository.update(chapters[i].id, { order: i });
    }
  }
}

export const chaptersRouter = router({
  getChapters: publicProcedure
    .input(z.object({ lectureId: z.string() }))
    .query(({ ctx, input }) => {
      return ctx.chapterRepository.getByLectureId(input.lectureId);
    }),
  getDistinctAssociations: publicProcedure.query(({ ctx }) => {
    return ctx.chapterRepository.getDistinctAssociations();
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
      const chapter = ctx.chapterRepository.getById(input.id);
      const result = ctx.chapterRepository.delete(input.id);
      if (result && chapter) {
        normalizeChapterOrders(ctx.chapterRepository, chapter.lectureId);
      }
      return result;
    }),
  moveChapter: publicProcedure
    .input(
      z.object({
        chapterId: z.string(),
        targetLectureId: z.string(),
      }),
    )
    .mutation(({ ctx, input }) => {
      const chapter = ctx.chapterRepository.getById(input.chapterId);
      if (!chapter) throw new Error('Chapter not found');
      const sourceLectureId = chapter.lectureId;

      // Get max order in target lecture
      const targetChapters = ctx.chapterRepository.getByLectureId(
        input.targetLectureId,
      );
      const maxOrder =
        targetChapters.length > 0
          ? Math.max(...targetChapters.map((c) => c.order))
          : -1;

      // Update chapter with new lectureId and order
      const result = ctx.chapterRepository.update(input.chapterId, {
        lectureId: input.targetLectureId,
        order: maxOrder + 1,
      });

      if (sourceLectureId !== input.targetLectureId) {
        normalizeChapterOrders(ctx.chapterRepository, sourceLectureId);
      }

      return result;
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
      const chapters = ctx.chapterRepository.getByLectureId(input.lectureId);
      let chapter = chapters[0];
      for (const c of chapters) {
        if (c.id === input.chapterId) {
          chapter = c;
          break;
        }
      }
      if (!chapter || chapter.id !== input.chapterId) {
        throw new Error('Chapter not found');
      }

      const oldOrder = chapter.order;
      const newOrder = input.newOrder;

      if (oldOrder === newOrder) {
        return chapter;
      }

      // Update orders of affected chapters
      if (newOrder < oldOrder) {
        // Moving up: shift chapters between newOrder and oldOrder-1 down by 1
        for (const c of chapters) {
          if (c.order >= newOrder && c.order < oldOrder) {
            ctx.chapterRepository.update(c.id, { order: c.order + 1 });
          }
        }
      } else {
        // Moving down: shift chapters between oldOrder+1 and newOrder up by 1
        for (const c of chapters) {
          if (c.order > oldOrder && c.order <= newOrder) {
            ctx.chapterRepository.update(c.id, { order: c.order - 1 });
          }
        }
      }

      // Update the target chapter's order
      return ctx.chapterRepository.update(input.chapterId, { order: newOrder });
    }),
});
