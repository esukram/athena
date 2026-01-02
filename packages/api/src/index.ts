export { appRouter, type AppRouter } from './root.js';
export {
  createContext,
  type LectureRepository,
  type ChapterRepository,
  type QuestionRepository,
  type AppContext,
} from './trpc.js';
export type {
  Lecture,
  Chapter,
  Question,
  SpeechService,
  SpeechResult,
} from './types.js';
