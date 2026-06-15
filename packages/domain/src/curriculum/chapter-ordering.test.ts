import { describe, expect, it } from 'vitest';

import { ValidationError } from '../shared/errors.js';
import {
  nextChapterOrder,
  planNormalization,
  planReorder,
} from './chapter-ordering.js';
import { ChapterNotFoundError } from './errors.js';
import type { Chapter } from './types.js';

const chapter = (id: string, order: number): Chapter => ({
  id,
  lectureId: 'L1',
  association: '',
  order,
});

/** Applies planned updates to a copy and returns ids in final order. */
function applyAndList(
  chapters: Chapter[],
  updates: { id: string; order: number }[],
) {
  const byId = new Map(chapters.map((c) => [c.id, { ...c }]));
  for (const u of updates) byId.get(u.id)!.order = u.order;
  return [...byId.values()].sort((a, b) => a.order - b.order).map((c) => c.id);
}

describe('planNormalization', () => {
  it('returns no updates when already contiguous', () => {
    const chapters = [chapter('a', 0), chapter('b', 1), chapter('c', 2)];
    expect(planNormalization(chapters)).toEqual([]);
  });

  it('closes gaps left by a deletion, preserving relative order', () => {
    const chapters = [chapter('a', 0), chapter('c', 2), chapter('d', 3)];
    const updates = planNormalization(chapters);
    expect(applyAndList(chapters, updates)).toEqual(['a', 'c', 'd']);
    expect(updates).toEqual([
      { id: 'c', order: 1 },
      { id: 'd', order: 2 },
    ]);
  });
});

describe('planReorder', () => {
  const base = () => [
    chapter('a', 0),
    chapter('b', 1),
    chapter('c', 2),
    chapter('d', 3),
  ];

  it('moves a chapter up', () => {
    const chapters = base();
    const updates = planReorder(chapters, 'd', 1);
    expect(applyAndList(chapters, updates)).toEqual(['a', 'd', 'b', 'c']);
  });

  it('moves a chapter down', () => {
    const chapters = base();
    const updates = planReorder(chapters, 'a', 2);
    expect(applyAndList(chapters, updates)).toEqual(['b', 'c', 'a', 'd']);
  });

  it('is a no-op when the target equals the current position', () => {
    expect(planReorder(base(), 'b', 1)).toEqual([]);
  });

  it('clamps a target past the end to the last position', () => {
    const chapters = base();
    const updates = planReorder(chapters, 'a', 99);
    expect(applyAndList(chapters, updates)).toEqual(['b', 'c', 'd', 'a']);
  });

  it('throws ChapterNotFoundError for an unknown chapter', () => {
    expect(() => planReorder(base(), 'zzz', 0)).toThrow(ChapterNotFoundError);
  });

  it('rejects a negative target order', () => {
    expect(() => planReorder(base(), 'a', -1)).toThrow(ValidationError);
  });
});

describe('nextChapterOrder', () => {
  it('is 0 for an empty lecture', () => {
    expect(nextChapterOrder([])).toBe(0);
  });

  it('is one past the current maximum', () => {
    expect(nextChapterOrder([chapter('a', 0), chapter('b', 4)])).toBe(5);
  });
});
