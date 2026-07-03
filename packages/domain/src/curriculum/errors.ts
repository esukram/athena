import { NotFoundError } from '../shared/errors.js';

export class LectureNotFoundError extends NotFoundError {
  constructor(public readonly lectureId: string) {
    super(`Lecture not found: ${lectureId}`);
  }
}

export class ChapterNotFoundError extends NotFoundError {
  constructor(public readonly chapterId: string) {
    super(`Chapter not found: ${chapterId}`);
  }
}

export class QuestionNotFoundError extends NotFoundError {
  constructor(public readonly questionId: string) {
    super(`Question not found: ${questionId}`);
  }
}
