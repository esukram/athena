/**
 * Curriculum bounded context — the authoring side of the application:
 * lectures, the chapters that belong to them, and the questions inside each
 * chapter, plus the ordering that links them.
 *
 * These are the persisted data shapes. Invariant-upholding behaviour lives in
 * the entities and use cases alongside them; repositories (see `ports.ts`)
 * load and save these shapes.
 */

export interface Lecture {
  id: string;
  title: string;
  description: string;
  order: number;
}

export interface LectureListItem extends Lecture {
  chapterCount: number;
  questionCount: number;
}

export interface Chapter {
  id: string;
  lectureId: string;
  association: string;
  order: number;
}

export interface Question {
  id: string;
  chapterId: string;
  question: string;
  answer: string;
  order: number;
  isAnnotated: boolean;
}
