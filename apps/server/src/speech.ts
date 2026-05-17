import * as sdk from 'microsoft-cognitiveservices-speech-sdk';
import * as fs from 'node:fs';

import type { SpeechFormat, SpeechResult, SpeechService } from '@athena/api';

const VOICE_MAP: Record<'de' | 'en', string> = {
  de: 'de-DE-KlarissaNeural',
  en: 'en-GB-RyanNeural',
};

const LOCALE_MAP: Record<'de' | 'en', string> = {
  de: 'de-DE',
  en: 'en-GB',
};

const SPEECH_REGION = 'germanywestcentral';

/**
 * Wraps an SSML body fragment in a `<speak>`/`<voice>` envelope. The server
 * owns the envelope so the voice and language are authoritative and cannot be
 * spoofed by the client-supplied body.
 */
function wrapSsml(body: string, language: 'de' | 'en'): string {
  const locale = LOCALE_MAP[language];
  const voice = VOICE_MAP[language];
  return (
    `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" ` +
    `xml:lang="${locale}">` +
    `<voice name="${voice}">${body}</voice>` +
    `</speak>`
  );
}

export function createSpeechService(): SpeechService | undefined {
  let speechKey = process.env.SPEECH_KEY;
  const speechKeyFile = process.env.SPEECH_KEY_FILE;
  const speechRegion = SPEECH_REGION;

  if (!speechKey && speechKeyFile) {
    try {
      console.log('Reading SPEECH_KEY_FILE from', speechKeyFile);
      speechKey = fs.readFileSync(speechKeyFile, 'utf8').trim();
    } catch (error) {
      console.error(
        `Failed to read SPEECH_KEY_FILE from ${speechKeyFile}:`,
        error,
      );
      return undefined;
    }
  }

  if (!speechKey || !speechRegion) {
    console.log(
      'Speech service not configured. Set SPEECH_KEY or SPEECH_KEY_FILE and SPEECH_REGION environment variables.',
    );
    return undefined;
  }

  const speechConfig = sdk.SpeechConfig.fromSubscription(
    speechKey,
    speechRegion,
  );

  return {
    isConfigured(): boolean {
      return true;
    },

    async synthesize(
      text: string,
      language: 'de' | 'en',
      format: SpeechFormat = 'text',
    ): Promise<SpeechResult> {
      const voice = VOICE_MAP[language];
      console.log('Synthesizing speech with voice:', voice, 'format:', format);
      speechConfig.speechSynthesisVoiceName = voice;
      speechConfig.speechSynthesisOutputFormat =
        sdk.SpeechSynthesisOutputFormat.Audio16Khz32KBitRateMonoMp3;

      const synthesizer = new sdk.SpeechSynthesizer(speechConfig);

      return new Promise((resolve, reject) => {
        const onResult = (result: sdk.SpeechSynthesisResult) => {
          if (result.reason === sdk.ResultReason.SynthesizingAudioCompleted) {
            const audioData = Buffer.from(result.audioData).toString('base64');
            resolve({
              audioData,
              duration: result.audioDuration / 10000, // Convert from 100-nanosecond units to ms
            });
          } else {
            const errorDetails = sdk.CancellationDetails.fromResult(result);
            reject(
              new Error(
                `Speech synthesis failed: ${errorDetails.reason} - ${errorDetails.errorDetails}`,
              ),
            );
          }
          synthesizer.close();
        };

        const onError = (error: string) => {
          synthesizer.close();
          reject(new Error(`Speech synthesis error: ${error}`));
        };

        if (format === 'ssml') {
          synthesizer.speakSsmlAsync(
            wrapSsml(text, language),
            onResult,
            onError,
          );
        } else {
          synthesizer.speakTextAsync(text, onResult, onError);
        }
      });
    },
  };
}
