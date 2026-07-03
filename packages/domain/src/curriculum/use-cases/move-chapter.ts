import type { UnitOfWork } from '../../shared/unit-of-work.js';
import { nextChapterOrder, planNormalization } from '../chapter-ordering.js';
import { ChapterNotFoundError } from '../errors.js';
import type { ChapterRepository } from '../ports.js';
import type { Chapter } from '../types.js';

export interface MoveChapterDeps {
  chapterRepository: ChapterRepository;
  unitOfWork: UnitOfWork;
}

export interface MoveChapterInput {
  chapterId: string;
  targetLectureId: string;
}

/**
 * Move a chapter to a different lecture: append it to the target lecture, then
 * renormalize the source lecture so its remaining chapters stay contiguous.
 * Targeting the chapter's own lecture is a no-op — the chapter is already in a
 * contiguous position, and appending it at `max + 1` would break the invariant.
 *
 * @throws {ChapterNotFoundError} if the chapter does not exist.
 */
export function moveChapter(
  { chapterRepository, unitOfWork }: MoveChapterDeps,
  input: MoveChapterInput,
): Chapter {
  return unitOfWork.run(() => {
    const chapter = chapterRepository.getById(input.chapterId);
    if (!chapter) throw new ChapterNotFoundError(input.chapterId);

    const sourceLectureId = chapter.lectureId;
    if (sourceLectureId === input.targetLectureId) return chapter;

    const targetChapters = chapterRepository.getByLectureId(
      input.targetLectureId,
    );

    const moved = chapterRepository.update(input.chapterId, {
      lectureId: input.targetLectureId,
      order: nextChapterOrder(targetChapters),
    });
    if (!moved) throw new ChapterNotFoundError(input.chapterId);

    const remaining = chapterRepository.getByLectureId(sourceLectureId);
    for (const update of planNormalization(remaining)) {
      chapterRepository.update(update.id, { order: update.order });
    }

    return moved;
  });
}
