/**
 * Narrows chapters to those whose representative question text contains every
 * whitespace-separated token of `query` (case-insensitive AND match). An empty
 * query returns all chapters. `questionTextOf` projects a chapter to the text
 * to match, keeping this rule independent of the chapter/question shapes.
 */
export function filterChaptersByQuestionText<T>(
  chapters: readonly T[],
  query: string,
  questionTextOf: (chapter: T) => string,
): T[] {
  if (!query.trim()) return [...chapters];

  const tokens = query.toLowerCase().split(/\s+/).filter(Boolean);
  return chapters.filter((chapter) => {
    const text = questionTextOf(chapter).toLowerCase();
    return tokens.every((token) => text.includes(token));
  });
}
