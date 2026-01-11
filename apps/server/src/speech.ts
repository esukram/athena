import * as sdk from 'microsoft-cognitiveservices-speech-sdk';
import * as fs from 'node:fs';

import type { SpeechResult, SpeechService } from '@athena/api';

const VOICE_MAP: Record<'de' | 'en', string> = {
  de: 'de-DE-KlarissaNeural',
  en: 'en-GB-RyanNeural',
};

const SPEECH_REGION = 'germanywestcentral';

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

    async transcribe(
      audioData: string,
      language: 'de' | 'en',
    ): Promise<string> {
      console.log('Transcribing speech...');
      speechConfig.speechRecognitionLanguage =
        language === 'de' ? 'de-DE' : 'en-US';

      // Assume audioData is raw PCM (16kHz, 16-bit, Mono) sent as Base64
      const audioBuffer = Buffer.from(audioData, 'base64');
      const pushStream = sdk.AudioInputStream.createPushStream(
        sdk.AudioStreamFormat.getWaveFormatPCM(16000, 16, 1),
      );
      pushStream.write(audioBuffer.buffer as ArrayBuffer);
      pushStream.close();

      const audioConfig = sdk.AudioConfig.fromStreamInput(pushStream);
      const recognizer = new sdk.SpeechRecognizer(speechConfig, audioConfig);

      return new Promise((resolve, reject) => {
        recognizer.recognizeOnceAsync(
          (result) => {
            if (result.reason === sdk.ResultReason.RecognizedSpeech) {
              resolve(result.text);
            } else if (result.reason === sdk.ResultReason.NoMatch) {
              resolve(''); // No speech recognized
            } else if (result.reason === sdk.ResultReason.Canceled) {
              const cancellation = sdk.CancellationDetails.fromResult(result);
              reject(
                new Error(
                  `Speech recognition canceled: ${cancellation.reason} ${cancellation.errorDetails}`,
                ),
              );
            }
            recognizer.close();
          },
          (error) => {
            recognizer.close();
            reject(new Error(`Speech recognition error: ${error}`));
          },
        );
      });
    },
  };
}
