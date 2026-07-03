import type { TrainableChapter, TrainingMode } from './types.js';

/**
 * Orders chapters for a regular session: annotated chapters first (so the
 * learner revisits flagged material), each group keeping its natural `order`.
 */
export function sortChaptersByAnnotation<T extends TrainableChapter>(
  chapters: readonly T[],
  annotatedChapterIds: Iterable<string>,
): T[] {
  const annotated = new Set(annotatedChapterIds);
  return [...chapters].sort((a, b) => {
    const aAnnotated = annotated.has(a.id) ? 1 : 0;
    const bAnnotated = annotated.has(b.id) ? 1 : 0;
    if (bAnnotated !== aAnnotated) return bAnnotated - aAnnotated;
    return a.order - b.order;
  });
}

/**
 * Fisher–Yates shuffle returning a new array. `random` is injectable so the
 * shuffle is deterministic under test; it defaults to `Math.random`.
 */
export function shuffle<T>(
  items: readonly T[],
  random: () => number = Math.random,
): T[] {
  const shuffled = [...items];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

/**
 * Produces the chapter order for a session: shuffled for `randomized`,
 * annotated-first for `regular`.
 */
export function orderChaptersForTraining<T extends TrainableChapter>(
  chapters: readonly T[],
  mode: TrainingMode,
  annotatedChapterIds: Iterable<string>,
  random: () => number = Math.random,
): T[] {
  return mode === 'randomized'
    ? shuffle(chapters, random)
    : sortChaptersByAnnotation(chapters, annotatedChapterIds);
}
