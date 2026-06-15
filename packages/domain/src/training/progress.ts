/**
 * The learner's 1-based position across the whole lecture: every question in
 * the chapters before the current one, plus the current question index. Used
 * to drive the session progress bar.
 */
export function trainingProgressPosition(params: {
  sortedChapters: readonly { id: string }[];
  selectedChapterIndex: number;
  selectedQuestionIndex: number;
  questionCountsPerChapter: Record<string, number>;
}): number {
  const {
    sortedChapters,
    selectedChapterIndex,
    selectedQuestionIndex,
    questionCountsPerChapter,
  } = params;

  let questionsInPreviousChapters = 0;
  for (let i = 0; i < selectedChapterIndex; i++) {
    const chapterId = sortedChapters[i]?.id;
    if (chapterId) {
      questionsInPreviousChapters += questionCountsPerChapter[chapterId] || 0;
    }
  }
  return questionsInPreviousChapters + selectedQuestionIndex + 1;
}
