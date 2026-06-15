import type { Chapter, LectureListItem, Question } from './types.js';

/**
 * Read models (CQRS-lite). The repository ports in `ports.ts` persist
 * aggregates; these query ports answer denormalised read questions —
 * cross-aggregate counts, search projections, lecture overviews — that don't
 * belong on a repository. No event sourcing is implied; this is just a clean
 * split between "save the aggregate" and "answer a query".
 */

/** A chapter paired with the question that best represents it in search results. */
export interface ChapterSearchResult extends Chapter {
  firstQuestion?: Question;
}

/** Lecture list with per-lecture chapter/question counts for the overview page. */
export interface LectureOverviewQuery {
  getAll(): LectureListItem[];
}

/** Search and tag (association) lookups over chapters. */
export interface ChapterSearchQuery {
  search(query: string): ChapterSearchResult[];
  getDistinctAssociations(): string[];
}

/** Lecture-scoped question projections used by the editing and learning UIs. */
export interface QuestionStatsQuery {
  getFirstByLectureId(lectureId: string): Record<string, Question>;
  getAnnotatedChapterIdsByLecture(lectureId: string): string[];
  getQuestionCountsByLecture(lectureId: string): number;
  getQuestionCountsPerChapter(lectureId: string): Record<string, number>;
}
