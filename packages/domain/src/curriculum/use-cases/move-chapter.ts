import { nextChapterOrder, planNormalization } from '../chapter-ordering.js';
import { ChapterNotFoundError } from '../errors.js';
import type { ChapterRepository } from '../ports.js';
import type { Chapter } from '../types.js';

export interface MoveChapterDeps {
  chapterRepository: ChapterRepository;
}

export interface MoveChapterInput {
  chapterId: string;
  targetLectureId: string;
}

/**
 * Move a chapter to a different lecture: append it to the target lecture, then
 * renormalize the source lecture so its remaining chapters stay contiguous.
 *
 * @throws {ChapterNotFoundError} if the chapter does not exist.
 */
export function moveChapter(
  { chapterRepository }: MoveChapterDeps,
  input: MoveChapterInput,
): Chapter {
  const chapter = chapterRepository.getById(input.chapterId);
  if (!chapter) throw new ChapterNotFoundError(input.chapterId);

  const sourceLectureId = chapter.lectureId;
  const targetChapters = chapterRepository.getByLectureId(
    input.targetLectureId,
  );

  const moved = chapterRepository.update(input.chapterId, {
    lectureId: input.targetLectureId,
    order: nextChapterOrder(targetChapters),
  });
  if (!moved) throw new ChapterNotFoundError(input.chapterId);

  if (sourceLectureId !== input.targetLectureId) {
    const remaining = chapterRepository.getByLectureId(sourceLectureId);
    for (const update of planNormalization(remaining)) {
      chapterRepository.update(update.id, { order: update.order });
    }
  }

  return moved;
}
