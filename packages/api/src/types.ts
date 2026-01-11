export interface Lecture {
  id: string;
  title: string;
  description: string;
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

export interface SpeechService {
  synthesize(text: string, language: 'de' | 'en'): Promise<SpeechResult>;
  transcribe(audioData: string, language: 'de' | 'en'): Promise<string>;
  isConfigured(): boolean;
}
