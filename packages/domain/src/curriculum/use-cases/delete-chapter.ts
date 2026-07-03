import type { UnitOfWork } from '../../shared/unit-of-work.js';
import { planNormalization } from '../chapter-ordering.js';
import type { ChapterRepository } from '../ports.js';

export interface DeleteChapterDeps {
  chapterRepository: ChapterRepository;
  unitOfWork: UnitOfWork;
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
  { chapterRepository, unitOfWork }: DeleteChapterDeps,
  input: DeleteChapterInput,
): boolean {
  return unitOfWork.run(() => {
    const chapter = chapterRepository.getById(input.id);
    const deleted = chapterRepository.delete(input.id);

    if (deleted && chapter) {
      const remaining = chapterRepository.getByLectureId(chapter.lectureId);
      for (const update of planNormalization(remaining)) {
        chapterRepository.update(update.id, { order: update.order });
      }
    }

    return deleted;
  });
}
