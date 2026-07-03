/**
 * Re-exports the domain data shapes so existing `./types.js` imports inside
 * this package keep working. The canonical definitions now live in
 * `@athena/domain`; this file is a thin compatibility barrel.
 */
export type {
  Chapter,
  Lecture,
  LectureListItem,
  Question,
  SpeechFormat,
  SpeechResult,
  SpeechService,
} from '@athena/domain';
