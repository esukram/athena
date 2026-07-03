/**
 * Training bounded context — the studying side of the application: how a
 * lecture's chapters and questions are sequenced into a study session, how
 * progress is measured, and how search narrows the chapter list. Pure rules,
 * independent of React or routing, so they can be unit-tested and reused (e.g.
 * by the README's planned server-side progress tracking).
 */

/** How a training session orders the chapters of a lecture. */
export type TrainingMode = 'regular' | 'randomized';

/** The minimal chapter shape the training rules need. */
export interface TrainableChapter {
  id: string;
  order: number;
}
