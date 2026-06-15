import { describe, expect, it } from 'vitest';

import { noopUnitOfWork } from '../../shared/unit-of-work.js';
import { ChapterNotFoundError } from '../errors.js';
import type { ChapterRepository } from '../ports.js';
import type { Chapter } from '../types.js';
import { deleteChapter } from './delete-chapter.js';
import { moveChapter } from './move-chapter.js';
import { reorderChapter } from './reorder-chapter.js';

/** Minimal in-memory ChapterRepository for exercising the use cases. */
function fakeChapterRepository(seed: Chapter[]): ChapterRepository {
  const store = new Map(seed.map((c) => [c.id, { ...c }]));
  return {
    getById: (id) => {
      const c = store.get(id);
      return c ? { ...c } : undefined;
    },
    getByLectureId: (lectureId) =>
      [...store.values()]
        .filter((c) => c.lectureId === lectureId)
        .sort((a, b) => a.order - b.order)
        .map((c) => ({ ...c })),
    getDistinctAssociations: () => [],
    search: () => [],
    create: (chapter) => {
      const created = { ...chapter, id: `c${store.size + 1}` };
      store.set(created.id, created);
      return created;
    },
    update: (id, patch) => {
      const existing = store.get(id);
      if (!existing) return undefined;
      const updated = { ...existing, ...patch };
      store.set(id, updated);
      return { ...updated };
    },
    delete: (id) => store.delete(id),
  };
}

const ordersOf = (repo: ChapterRepository, lectureId: string) =>
  repo.getByLectureId(lectureId).map((c) => ({ id: c.id, order: c.order }));

const chapter = (id: string, lectureId: string, order: number): Chapter => ({
  id,
  lectureId,
  association: '',
  order,
});

describe('reorderChapter', () => {
  it('reorders and keeps orders contiguous', () => {
    const repo = fakeChapterRepository([
      chapter('a', 'L1', 0),
      chapter('b', 'L1', 1),
      chapter('c', 'L1', 2),
    ]);
    const moved = reorderChapter(
      { chapterRepository: repo, unitOfWork: noopUnitOfWork },
      {
        chapterId: 'c',
        lectureId: 'L1',
        newOrder: 0,
      },
    );
    expect(moved.order).toBe(0);
    expect(ordersOf(repo, 'L1')).toEqual([
      { id: 'c', order: 0 },
      { id: 'a', order: 1 },
      { id: 'b', order: 2 },
    ]);
  });
});

describe('moveChapter', () => {
  it('appends to the target lecture and renormalizes the source', () => {
    const repo = fakeChapterRepository([
      chapter('a', 'L1', 0),
      chapter('b', 'L1', 1),
      chapter('c', 'L1', 2),
      chapter('x', 'L2', 0),
    ]);
    const moved = moveChapter(
      { chapterRepository: repo, unitOfWork: noopUnitOfWork },
      {
        chapterId: 'b',
        targetLectureId: 'L2',
      },
    );
    expect(moved.lectureId).toBe('L2');
    expect(moved.order).toBe(1);
    // Source lecture closes the gap left by 'b'.
    expect(ordersOf(repo, 'L1')).toEqual([
      { id: 'a', order: 0 },
      { id: 'c', order: 1 },
    ]);
  });

  it('throws for an unknown chapter', () => {
    const repo = fakeChapterRepository([]);
    expect(() =>
      moveChapter(
        { chapterRepository: repo, unitOfWork: noopUnitOfWork },
        {
          chapterId: 'nope',
          targetLectureId: 'L2',
        },
      ),
    ).toThrow(ChapterNotFoundError);
  });
});

describe('deleteChapter', () => {
  it('deletes and renormalizes remaining chapters', () => {
    const repo = fakeChapterRepository([
      chapter('a', 'L1', 0),
      chapter('b', 'L1', 1),
      chapter('c', 'L1', 2),
    ]);
    const deleted = deleteChapter(
      { chapterRepository: repo, unitOfWork: noopUnitOfWork },
      { id: 'a' },
    );
    expect(deleted).toBe(true);
    expect(ordersOf(repo, 'L1')).toEqual([
      { id: 'b', order: 0 },
      { id: 'c', order: 1 },
    ]);
  });

  it('returns false for a missing chapter', () => {
    const repo = fakeChapterRepository([]);
    expect(
      deleteChapter(
        { chapterRepository: repo, unitOfWork: noopUnitOfWork },
        { id: 'x' },
      ),
    ).toBe(false);
  });
});
