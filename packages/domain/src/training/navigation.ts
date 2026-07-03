/**
 * Where the previous/next control should move within a session. Sequencing
 * walks questions inside a chapter and then crosses chapter boundaries: moving
 * forward past a chapter's last question lands on the next chapter's first
 * question; moving back before the first lands on the previous chapter's last.
 */
export type TrainingStep =
  | { kind: 'question'; chapterIndex: number; questionIndex: number }
  | { kind: 'chapter-start'; chapterIndex: number }
  | { kind: 'chapter-end'; chapterIndex: number }
  | null;

export interface TrainingCursor {
  selectedChapterIndex: number;
  selectedQuestionIndex: number;
  currentChapterQuestionCount: number;
  chapterCount: number;
}

/** The step forward, or `null` at the very last question of the last chapter. */
export function nextTrainingStep(cursor: TrainingCursor): TrainingStep {
  if (cursor.selectedQuestionIndex < cursor.currentChapterQuestionCount - 1) {
    return {
      kind: 'question',
      chapterIndex: cursor.selectedChapterIndex,
      questionIndex: cursor.selectedQuestionIndex + 1,
    };
  }
  if (cursor.selectedChapterIndex < cursor.chapterCount - 1) {
    return {
      kind: 'chapter-start',
      chapterIndex: cursor.selectedChapterIndex + 1,
    };
  }
  return null;
}

/** The step back, or `null` at the very first question of the first chapter. */
export function prevTrainingStep(cursor: TrainingCursor): TrainingStep {
  if (cursor.selectedQuestionIndex > 0) {
    return {
      kind: 'question',
      chapterIndex: cursor.selectedChapterIndex,
      questionIndex: cursor.selectedQuestionIndex - 1,
    };
  }
  if (cursor.selectedChapterIndex > 0) {
    return {
      kind: 'chapter-end',
      chapterIndex: cursor.selectedChapterIndex - 1,
    };
  }
  return null;
}

/** True when there is no earlier question to move to. */
export function isFirstQuestion(cursor: TrainingCursor): boolean {
  return prevTrainingStep(cursor) === null;
}

/** True when there is no later question to move to. */
export function isLastQuestion(cursor: TrainingCursor): boolean {
  return nextTrainingStep(cursor) === null;
}
