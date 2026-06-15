import { planNormalization } from '../chapter-ordering.js';
import type { ChapterRepository } from '../ports.js';

export interface DeleteChapterDeps {
  chapterRepository: ChapterRepository;
}

export interface DeleteChapterInput {
  id: string;
}

/**
 * Delete a chapter and renormalize its former lecture so the surviving
 * chapters keep contiguous order values (no gap where the deleted one was).
 * Returns whether a chapter was actually removed.
 */
export function deleteChapter(
  { chapterRepository }: DeleteChapterDeps,
  input: DeleteChapterInput,
): boolean {
  const chapter = chapterRepository.getById(input.id);
  const deleted = chapterRepository.delete(input.id);

  if (deleted && chapter) {
    const remaining = chapterRepository.getByLectureId(chapter.lectureId);
    for (const update of planNormalization(remaining)) {
      chapterRepository.update(update.id, { order: update.order });
    }
  }

  return deleted;
}
