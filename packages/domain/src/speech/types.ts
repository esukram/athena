/**
 * Speech bounded context — ports and value types for turning study material
 * into spoken audio. Pure contracts only; concrete TTS adapters live in
 * `apps/server`.
 */

/**
 * The languages the application can speak. Declared once here so the web app,
 * the API boundary, and the TTS adapters share a single source of truth rather
 * than re-declaring the `'de' | 'en'` union in each place.
 */
export type LanguageCode = 'de' | 'en';

/** Whether a synthesis request carries plain text or a ready-made SSML body. */
export type SpeechFormat = 'text' | 'ssml';

export interface SpeechResult {
  audioData: string; // Base64-encoded WAV
  duration: number; // Duration in milliseconds
}

export interface SpeechService {
  synthesize(
    text: string,
    language: LanguageCode,
    format?: SpeechFormat,
  ): Promise<SpeechResult>;
  isConfigured(): boolean;
}
