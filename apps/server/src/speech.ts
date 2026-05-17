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
 * Tags `markdownToSsml` is allowed to emit. Anything else in a client-supplied
 * body is treated as an attempt to break out of the server-owned envelope.
 */
const ALLOWED_SSML_TAGS = new Set(['emphasis', 'break', 'prosody']);

/**
 * Verifies a client-supplied SSML body before it is wrapped. The body is
 * untrusted: a caller could otherwise close the server's `<voice>`/`<speak>`
 * envelope early and re-open it with a different voice/locale, or pull in
 * external resources via `<audio>`, `<lexicon>`, `<mstts:*>` etc. Only the
 * small set of presentational tags `markdownToSsml` produces is permitted;
 * anything else (or stray markup) is rejected outright.
 */
function assertSafeSsmlBody(body: string): void {
  const tagPattern = /<\/?([a-zA-Z][\w:-]*)\b[^>]*>/g;
  let match: RegExpExecArray | null;
  while ((match = tagPattern.exec(body)) !== null) {
    if (!ALLOWED_SSML_TAGS.has(match[1].toLowerCase())) {
      throw new Error(`Disallowed SSML tag: <${match[1]}>`);
    }
  }
  // `markdownToSsml` XML-escapes all text, so every literal `<` must open a
  // well-formed tag. A `<` that is not a tag start (comment, CDATA, stray
  // markup) means the body did not come from the trusted converter.
  if (/<(?![/!]?[a-zA-Z])/.test(body) || body.includes('<!')) {
    throw new Error('Malformed SSML body');
  }
}

/**
 * Wraps a *validated* SSML body fragment in a `<speak>`/`<voice>` envelope.
 * The server owns the envelope and the body is checked by `assertSafeSsmlBody`,
 * so the voice and language are authoritative and cannot be spoofed.
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
          try {
            assertSafeSsmlBody(text);
          } catch (error) {
            synthesizer.close();
            reject(error instanceof Error ? error : new Error(String(error)));
            return;
          }
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
