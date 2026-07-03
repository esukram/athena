import type { UnitOfWork } from '../../shared/unit-of-work.js';
import { planReorder } from '../chapter-ordering.js';
import { ChapterNotFoundError } from '../errors.js';
import type { ChapterRepository } from '../ports.js';
import type { Chapter } from '../types.js';

export interface ReorderChapterDeps {
  chapterRepository: ChapterRepository;
  unitOfWork: UnitOfWork;
}

export interface ReorderChapterInput {
  chapterId: string;
  lectureId: string;
  newOrder: number;
}

/**
 * Move a chapter to a new position within its lecture, keeping all chapter
 * orders contiguous. The ordering rule lives in {@link planReorder}; this use
 * case loads the lecture's chapters, applies the planned updates, and returns
 * the moved chapter.
 */
export function reorderChapter(
  { chapterRepository, unitOfWork }: ReorderChapterDeps,
  input: ReorderChapterInput,
): Chapter {
  return unitOfWork.run(() => {
    const chapters = chapterRepository.getByLectureId(input.lectureId);
    const updates = planReorder(chapters, input.chapterId, input.newOrder);

    for (const update of updates) {
      chapterRepository.update(update.id, { order: update.order });
    }

    const moved = chapterRepository.getById(input.chapterId);
    if (!moved) throw new ChapterNotFoundError(input.chapterId);
    return moved;
  });
}
