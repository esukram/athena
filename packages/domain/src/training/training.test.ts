import { describe, expect, it } from 'vitest';

import {
  orderChaptersForTraining,
  shuffle,
  sortChaptersByAnnotation,
} from './chapter-sequence.js';
import {
  isFirstQuestion,
  isLastQuestion,
  nextTrainingStep,
  prevTrainingStep,
} from './navigation.js';
import { trainingProgressPosition } from './progress.js';
import { filterChaptersByQuestionText } from './search.js';

const chapter = (id: string, order: number) => ({ id, order });

describe('sortChaptersByAnnotation', () => {
  it('puts annotated chapters first, each group keeping natural order', () => {
    const chapters = [chapter('a', 0), chapter('b', 1), chapter('c', 2)];
    const sorted = sortChaptersByAnnotation(chapters, ['c']);
    expect(sorted.map((c) => c.id)).toEqual(['c', 'a', 'b']);
  });

  it('is a stable order when nothing is annotated', () => {
    const chapters = [chapter('a', 0), chapter('b', 1)];
    expect(sortChaptersByAnnotation(chapters, []).map((c) => c.id)).toEqual([
      'a',
      'b',
    ]);
  });
});

describe('shuffle', () => {
  it('is a permutation and does not mutate the input', () => {
    const input = [1, 2, 3, 4, 5];
    // Deterministic "random" so the test never flakes.
    const result = shuffle(input, () => 0);
    expect([...result].sort()).toEqual([1, 2, 3, 4, 5]);
    expect(input).toEqual([1, 2, 3, 4, 5]);
  });
});

describe('orderChaptersForTraining', () => {
  it('shuffles in randomized mode', () => {
    const chapters = [chapter('a', 0), chapter('b', 1), chapter('c', 2)];
    const result = orderChaptersForTraining(
      chapters,
      'randomized',
      [],
      () => 0,
    );
    expect(result.map((c) => c.id).sort()).toEqual(['a', 'b', 'c']);
  });

  it('sorts annotated-first in regular mode', () => {
    const chapters = [chapter('a', 0), chapter('b', 1)];
    const result = orderChaptersForTraining(chapters, 'regular', ['b']);
    expect(result.map((c) => c.id)).toEqual(['b', 'a']);
  });
});

describe('trainingProgressPosition', () => {
  it('sums questions of earlier chapters plus current index + 1', () => {
    const position = trainingProgressPosition({
      sortedChapters: [{ id: 'a' }, { id: 'b' }, { id: 'c' }],
      selectedChapterIndex: 2,
      selectedQuestionIndex: 1,
      questionCountsPerChapter: { a: 3, b: 2, c: 4 },
    });
    // 3 + 2 (previous chapters) + 1 (current index) + 1 = 7
    expect(position).toBe(7);
  });
});

describe('filterChaptersByQuestionText', () => {
  const chapters = [
    { id: 'a', text: 'What is a matrix' },
    { id: 'b', text: 'Define eigenvalue' },
  ];
  const textOf = (c: { text: string }) => c.text;

  it('returns all chapters for a blank query', () => {
    expect(filterChaptersByQuestionText(chapters, '  ', textOf)).toHaveLength(
      2,
    );
  });

  it('matches every token (AND), case-insensitively', () => {
    const result = filterChaptersByQuestionText(
      chapters,
      'WHAT matrix',
      textOf,
    );
    expect(result.map((c) => c.id)).toEqual(['a']);
  });
});

describe('navigation steps', () => {
  const cursor = {
    selectedChapterIndex: 0,
    selectedQuestionIndex: 0,
    currentChapterQuestionCount: 2,
    chapterCount: 2,
  };

  it('advances within a chapter', () => {
    expect(nextTrainingStep(cursor)).toEqual({
      kind: 'question',
      chapterIndex: 0,
      questionIndex: 1,
    });
  });

  it('crosses to the next chapter start at a chapter end', () => {
    expect(nextTrainingStep({ ...cursor, selectedQuestionIndex: 1 })).toEqual({
      kind: 'chapter-start',
      chapterIndex: 1,
    });
  });

  it('stops at the last question of the last chapter', () => {
    const last = {
      selectedChapterIndex: 1,
      selectedQuestionIndex: 1,
      currentChapterQuestionCount: 2,
      chapterCount: 2,
    };
    expect(nextTrainingStep(last)).toBeNull();
    expect(isLastQuestion(last)).toBe(true);
  });

  it('crosses back to the previous chapter end at a chapter start', () => {
    expect(prevTrainingStep({ ...cursor, selectedChapterIndex: 1 })).toEqual({
      kind: 'chapter-end',
      chapterIndex: 0,
    });
  });

  it('stops at the first question of the first chapter', () => {
    expect(prevTrainingStep(cursor)).toBeNull();
    expect(isFirstQuestion(cursor)).toBe(true);
  });
});
