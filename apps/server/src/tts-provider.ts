import type { SpeechService } from '@athena/api';

import { createGoogleSpeechService } from './google-speech.js';
import { createMistralSpeechService } from './mistral-speech.js';
import { createSpeechService } from './speech.js';

/**
 * Selects the TTS adapter based on the TTS_PROVIDER environment variable.
 * Defaults to 'azure' so existing deployments are unaffected.
 */
export function createConfiguredSpeechService(): SpeechService | undefined {
  const provider = (process.env.TTS_PROVIDER || 'azure').toLowerCase();

  switch (provider) {
    case 'google':
      console.log('TTS provider: google');
      return createGoogleSpeechService();
    case 'mistral':
      console.log('TTS provider: mistral');
      return createMistralSpeechService();
    case 'azure':
      console.log('TTS provider: azure');
      return createSpeechService();
    default:
      console.warn(
        `Unknown TTS_PROVIDER "${provider}", falling back to azure.`,
      );
      return createSpeechService();
  }
}
