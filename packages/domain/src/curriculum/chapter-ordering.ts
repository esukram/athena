import { OrderIndex } from '../shared/order-index.js';
import { ChapterNotFoundError } from './errors.js';
import type { Chapter } from './types.js';

/**
 * Chapter ordering — the invariant the Lecture aggregate owns: the chapters of
 * a lecture have contiguous `order` values `0..n-1`. These are pure functions:
 * they take the current chapters and return the minimal set of `{id, order}`
 * updates a repository must persist to satisfy an operation. Keeping the rule
 * here (rather than inline in a tRPC router) makes it unit-testable without
 * tRPC or SQLite and reusable from any entry point.
 */

/** Anything with a stable id and an order — chapters, lectures, questions. */
export interface OrderedItem {
  id: string;
  order: number;
}

export interface OrderUpdate {
  id: string;
  order: number;
}

/** Stable ordering: by `order`, then by `id` so equal orders are deterministic. */
function sortedByOrder<T extends OrderedItem>(items: readonly T[]): T[] {
  return [...items].sort((a, b) => a.order - b.order || (a.id < b.id ? -1 : 1));
}

/** Diffs the desired contiguous sequence against current orders. */
function diffToContiguous(ordered: readonly OrderedItem[]): OrderUpdate[] {
  const updates: OrderUpdate[] = [];
  ordered.forEach((item, index) => {
    if (item.order !== index) {
      updates.push({ id: item.id, order: index });
    }
  });
  return updates;
}

/**
 * Updates needed to make a lecture's chapter orders contiguous (`0..n-1`),
 * preserving their current relative order. Used after a delete or a cross-
 * lecture move leaves a gap.
 */
export function planNormalization(chapters: readonly Chapter[]): OrderUpdate[] {
  return diffToContiguous(sortedByOrder(chapters));
}

/**
 * Updates needed to move `itemId` to `targetOrder` within its collection,
 * keeping every order contiguous. Equivalent to lifting the item out and
 * re-inserting it at the clamped target position, then renumbering.
 *
 * Generic over `{id, order}` shapes (chapters, lectures, ...), but still
 * throws {@link ChapterNotFoundError} for an unknown id — non-chapter callers
 * must precheck existence and raise their own error.
 *
 * @throws {ChapterNotFoundError} if `itemId` is not among `items`.
 */
export function planReorder<T extends OrderedItem>(
  items: readonly T[],
  itemId: string,
  targetOrder: number,
): OrderUpdate[] {
  OrderIndex.assert(targetOrder);

  const ordered = sortedByOrder(items);
  const fromIndex = ordered.findIndex((item) => item.id === itemId);
  if (fromIndex === -1) {
    throw new ChapterNotFoundError(itemId);
  }

  const toIndex = Math.min(targetOrder, ordered.length - 1);
  if (toIndex === fromIndex) return [];

  const [moved] = ordered.splice(fromIndex, 1);
  ordered.splice(toIndex, 0, moved);

  return diffToContiguous(ordered);
}

/**
 * The next free order value when appending a chapter to a lecture: one past
 * the current maximum, or `0` for an empty lecture.
 */
export function nextChapterOrder(chapters: readonly Chapter[]): number {
  return (
    chapters.reduce((max, chapter) => Math.max(max, chapter.order), -1) + 1
  );
}
