import type { SpeechFormat, SpeechResult, SpeechService } from '@athena/api';

import { estimateDuration, stripSsml } from './tts-utils.js';

const MISTRAL_SPEECH_ENDPOINT = 'https://api.mistral.ai/v1/audio/speech';
const MISTRAL_TTS_MODEL = 'voxtral-mini-tts-2603';

/**
 * Neutral female preset voice. Voxtral has no German preset, but its voices are
 * cross-lingual, so this voice speaks both German and English. Overridable via
 * MISTRAL_TTS_VOICE (see GET /v1/audio/voices for other preset slugs).
 */
const DEFAULT_VOICE = 'gb_jane_neutral';

interface MistralSpeechResponse {
  audio_data: string;
}

export function createMistralSpeechService(): SpeechService | undefined {
  const apiKey = process.env.MISTRAL_API_KEY;

  if (!apiKey) {
    console.log(
      'Mistral speech service not configured. Set MISTRAL_API_KEY environment variable.',
    );
    return undefined;
  }

  const voiceId = process.env.MISTRAL_TTS_VOICE || DEFAULT_VOICE;

  return {
    isConfigured(): boolean {
      return true;
    },

    async synthesize(
      text: string,
      language: 'de' | 'en',
      format: SpeechFormat = 'text',
    ): Promise<SpeechResult> {
      const input = format === 'ssml' ? stripSsml(text) : text;
      console.log(
        'Synthesizing speech with Mistral voice:',
        voiceId,
        'language:',
        language,
        'format:',
        format,
      );

      const response = await fetch(MISTRAL_SPEECH_ENDPOINT, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: MISTRAL_TTS_MODEL,
          input,
          voice_id: voiceId,
          response_format: 'mp3',
        }),
      });

      if (!response.ok) {
        const detail = await response.text();
        throw new Error(
          `Mistral speech synthesis failed: ${response.status} ${response.statusText} - ${detail}`,
        );
      }

      const result = (await response.json()) as MistralSpeechResponse;
      if (!result.audio_data) {
        throw new Error('Mistral speech synthesis returned no audio data');
      }

      return {
        audioData: result.audio_data,
        duration: estimateDuration(input),
      };
    },
  };
}
