export interface Lecture {
  id: string;
  title: string;
  description: string;
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

export interface SpeechResult {
  audioData: string; // Base64-encoded WAV
  duration: number; // Duration in milliseconds
}

export type SpeechFormat = 'text' | 'ssml';

export interface SpeechService {
  synthesize(
    text: string,
    language: 'de' | 'en',
    format?: SpeechFormat,
  ): Promise<SpeechResult>;
  isConfigured(): boolean;
}
