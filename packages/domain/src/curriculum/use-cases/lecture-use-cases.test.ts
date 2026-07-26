import { describe, expect, it } from 'vitest';

import { ValidationError } from '../../shared/errors.js';
import { noopUnitOfWork } from '../../shared/unit-of-work.js';
import { LectureNotFoundError } from '../errors.js';
import type { LectureRepository } from '../ports.js';
import type { Lecture } from '../types.js';
import { reorderLecture } from './index.js';

/** Minimal in-memory LectureRepository for exercising the use cases. */
function fakeLectureRepository(
  seed: Lecture[],
  onUpdate: () => void = () => {},
): LectureRepository {
  const store = new Map(seed.map((lecture) => [lecture.id, { ...lecture }]));
  return {
    getById: (id) => {
      const lecture = store.get(id);
      return lecture ? { ...lecture } : undefined;
    },
    getAll: () =>
      [...store.values()]
        .sort((a, b) => a.order - b.order || (a.id < b.id ? -1 : 1))
        .map((lecture) => ({ ...lecture })),
    create: (lecture) => {
      const created = {
        ...lecture,
        id: `lecture-${store.size + 1}`,
        order:
          [...store.values()].reduce(
            (max, existing) => Math.max(max, existing.order),
            -1,
          ) + 1,
      };
      store.set(created.id, created);
      return { ...created };
    },
    update: (id, patch) => {
      const existing = store.get(id);
      if (!existing) return undefined;
      onUpdate();
      const updated = { ...existing, ...patch };
      store.set(id, updated);
      return { ...updated };
    },
    delete: (id) => store.delete(id),
  };
}

const ordersOf = (repo: LectureRepository) =>
  repo.getAll().map((lecture) => ({
    id: lecture.id,
    order: lecture.order,
  }));

const lecture = (id: string, order: number): Lecture => ({
  id,
  title: `Title ${id}`,
  description: `Description ${id}`,
  order,
});

describe('reorderLecture', () => {
  it('moves a lecture down and keeps orders contiguous', () => {
    const repo = fakeLectureRepository([
      lecture('a', 0),
      lecture('b', 1),
      lecture('c', 2),
    ]);
    reorderLecture(
      { lectureRepository: repo, unitOfWork: noopUnitOfWork },
      { lectureId: 'a', newOrder: 2 },
    );
    expect(ordersOf(repo)).toEqual([
      { id: 'b', order: 0 },
      { id: 'c', order: 1 },
      { id: 'a', order: 2 },
    ]);
  });

  it('moves a lecture up and returns it with its new order', () => {
    const repo = fakeLectureRepository([
      lecture('a', 0),
      lecture('b', 1),
      lecture('c', 2),
    ]);
    const moved = reorderLecture(
      { lectureRepository: repo, unitOfWork: noopUnitOfWork },
      { lectureId: 'c', newOrder: 0 },
    );
    expect(moved).toEqual(lecture('c', 0));
    expect(ordersOf(repo)).toEqual([
      { id: 'c', order: 0 },
      { id: 'a', order: 1 },
      { id: 'b', order: 2 },
    ]);
  });

  it('does not update when the target equals the current position', () => {
    let updateCalls = 0;
    const repo = fakeLectureRepository(
      [lecture('a', 0), lecture('b', 1), lecture('c', 2)],
      () => updateCalls++,
    );
    const moved = reorderLecture(
      { lectureRepository: repo, unitOfWork: noopUnitOfWork },
      { lectureId: 'b', newOrder: 1 },
    );
    expect(moved).toEqual(lecture('b', 1));
    expect(updateCalls).toBe(0);
    expect(ordersOf(repo)).toEqual([
      { id: 'a', order: 0 },
      { id: 'b', order: 1 },
      { id: 'c', order: 2 },
    ]);
  });

  it('clamps a target past the end to the last position', () => {
    const repo = fakeLectureRepository([
      lecture('a', 0),
      lecture('b', 1),
      lecture('c', 2),
    ]);
    reorderLecture(
      { lectureRepository: repo, unitOfWork: noopUnitOfWork },
      { lectureId: 'a', newOrder: 99 },
    );
    expect(ordersOf(repo)).toEqual([
      { id: 'b', order: 0 },
      { id: 'c', order: 1 },
      { id: 'a', order: 2 },
    ]);
  });

  it('throws LectureNotFoundError for an unknown lecture', () => {
    const repo = fakeLectureRepository([]);
    expect(() =>
      reorderLecture(
        { lectureRepository: repo, unitOfWork: noopUnitOfWork },
        { lectureId: 'missing', newOrder: 0 },
      ),
    ).toThrow(LectureNotFoundError);
  });

  it('rejects a negative target order', () => {
    const repo = fakeLectureRepository([lecture('a', 0)]);
    expect(() =>
      reorderLecture(
        { lectureRepository: repo, unitOfWork: noopUnitOfWork },
        { lectureId: 'a', newOrder: -1 },
      ),
    ).toThrow(ValidationError);
  });

  it('renormalizes gapped orders while reordering', () => {
    const repo = fakeLectureRepository([
      lecture('a', 0),
      lecture('b', 2),
      lecture('c', 5),
    ]);
    reorderLecture(
      { lectureRepository: repo, unitOfWork: noopUnitOfWork },
      { lectureId: 'c', newOrder: 0 },
    );
    expect(ordersOf(repo)).toEqual([
      { id: 'c', order: 0 },
      { id: 'a', order: 1 },
      { id: 'b', order: 2 },
    ]);
  });
});
