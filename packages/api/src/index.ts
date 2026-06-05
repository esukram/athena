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
  LectureListItem,
  Chapter,
  Question,
  SpeechService,
  SpeechResult,
  SpeechFormat,
} from './types.js';
