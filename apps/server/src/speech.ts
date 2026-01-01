import * as sdk from 'microsoft-cognitiveservices-speech-sdk';

import type { SpeechResult, SpeechService } from '@athena/api';

const VOICE_MAP: Record<'de' | 'en', string> = {
  de: 'de-DE-KatjaNeural',
  en: 'en-GB-RyanNeural',
};

export function createSpeechService(): SpeechService | undefined {
  const speechKey = process.env.SPEECH_KEY;
  const speechRegion = process.env.SPEECH_REGION;

  if (!speechKey || !speechRegion) {
    console.log(
      'Speech service not configured. Set SPEECH_KEY and SPEECH_REGION environment variables.',
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
    ): Promise<SpeechResult> {
      const voice = VOICE_MAP[language];
      console.log('Synthesizing speech with voice:', voice);
      speechConfig.speechSynthesisVoiceName = voice;
      speechConfig.speechSynthesisOutputFormat =
        sdk.SpeechSynthesisOutputFormat.Audio16Khz32KBitRateMonoMp3;

      const synthesizer = new sdk.SpeechSynthesizer(speechConfig);

      return new Promise((resolve, reject) => {
        synthesizer.speakTextAsync(
          text,
          (result) => {
            if (result.reason === sdk.ResultReason.SynthesizingAudioCompleted) {
              const audioData = Buffer.from(result.audioData).toString(
                'base64',
              );
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
          },
          (error) => {
            synthesizer.close();
            reject(new Error(`Speech synthesis error: ${error}`));
          },
        );
      });
    },
  };
}
