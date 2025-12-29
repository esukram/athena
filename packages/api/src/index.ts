export { appRouter, type AppRouter } from './root';
export {
  createContext,
  type LectureRepository,
  type ChapterRepository,
  type QuestionRepository,
  type AppContext,
} from './trpc';
export type { Lecture, Chapter, Question } from './types';
