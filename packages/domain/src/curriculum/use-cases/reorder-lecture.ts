import type { UnitOfWork } from '../../shared/unit-of-work.js';
import { planReorder } from '../chapter-ordering.js';
import { LectureNotFoundError } from '../errors.js';
import type { LectureRepository } from '../ports.js';
import type { Lecture } from '../types.js';

export interface ReorderLectureDeps {
  lectureRepository: LectureRepository;
  unitOfWork: UnitOfWork;
}

export interface ReorderLectureInput {
  lectureId: string;
  newOrder: number;
}

/**
 * Move a lecture to a new position on the overview, keeping all lecture orders
 * contiguous. Reuses {@link planReorder}; existence is prechecked here so an
 * unknown id surfaces as a `LectureNotFoundError` rather than the chapter one.
 */
export function reorderLecture(
  { lectureRepository, unitOfWork }: ReorderLectureDeps,
  input: ReorderLectureInput,
): Lecture {
  return unitOfWork.run(() => {
    const lectures = lectureRepository.getAll();
    if (!lectures.some((lecture) => lecture.id === input.lectureId)) {
      throw new LectureNotFoundError(input.lectureId);
    }

    const updates = planReorder(lectures, input.lectureId, input.newOrder);
    for (const update of updates) {
      lectureRepository.update(update.id, { order: update.order });
    }

    const moved = lectureRepository.getById(input.lectureId);
    if (!moved) throw new LectureNotFoundError(input.lectureId);
    return moved;
  });
}
