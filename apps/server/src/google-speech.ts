import * as crypto from 'node:crypto';
import * as fs from 'node:fs';

import type { SpeechFormat, SpeechResult, SpeechService } from '@athena/api';

import {
  PAUSE_MARKER,
  chunkText,
  estimateDuration,
  ssmlToChirp3Markup,
} from './tts-utils.js';

const GOOGLE_TTS_ENDPOINT =
  'https://texttospeech.googleapis.com/v1/text:synthesize';
const TTS_SCOPE = 'https://www.googleapis.com/auth/cloud-platform';

/**
 * `text:synthesize` rejects input over 5000 bytes; long lectures are split
 * into chunks below this (with margin) and the resulting MP3s concatenated.
 */
const MAX_INPUT_BYTES = 4800;

const LANGUAGE_CODE: Record<'de' | 'en', string> = {
  de: 'de-DE',
  en: 'en-GB',
};

/**
 * Chirp 3 HD voice per language. Chirp 3 HD voices are named
 * `<locale>-Chirp3-HD-<speaker>`; `Kore` is a neutral female speaker.
 * Overridable via GOOGLE_TTS_VOICE (see GET /v1/voices?languageCode=de-DE).
 */
const DEFAULT_VOICE: Record<'de' | 'en', string> = {
  de: 'de-DE-Chirp3-HD-Kore',
  en: 'en-GB-Chirp3-HD-Kore',
};

interface ServiceAccount {
  client_email: string;
  private_key: string;
  token_uri: string;
}

interface GoogleSpeechResponse {
  audioContent: string;
}

function base64url(input: Buffer | string): string {
  return Buffer.from(input)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

/**
 * Mints a short-lived OAuth2 access token from the service account by signing
 * a JWT bearer assertion (RFC 7523) and exchanging it at the token endpoint.
 */
async function fetchAccessToken(sa: ServiceAccount): Promise<{
  token: string;
  expiresAt: number;
}> {
  const now = Math.floor(Date.now() / 1000);
  const header = base64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const claims = base64url(
    JSON.stringify({
      iss: sa.client_email,
      scope: TTS_SCOPE,
      aud: sa.token_uri,
      iat: now,
      exp: now + 3600,
    }),
  );
  const signingInput = `${header}.${claims}`;
  const signature = base64url(
    crypto.sign('RSA-SHA256', Buffer.from(signingInput), sa.private_key),
  );
  const assertion = `${signingInput}.${signature}`;

  const response = await fetch(sa.token_uri, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion,
    }),
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(
      `Google token exchange failed: ${response.status} ${response.statusText} - ${detail}`,
    );
  }

  const body = (await response.json()) as {
    access_token: string;
    expires_in: number;
  };
  return {
    token: body.access_token,
    expiresAt: now + body.expires_in,
  };
}

export function createGoogleSpeechService(): SpeechService | undefined {
  const credentialsPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;

  if (!credentialsPath) {
    console.log(
      'Google speech service not configured. Set GOOGLE_APPLICATION_CREDENTIALS to the service account JSON path.',
    );
    return undefined;
  }

  let serviceAccount: ServiceAccount;
  try {
    serviceAccount = JSON.parse(
      fs.readFileSync(credentialsPath, 'utf8'),
    ) as ServiceAccount;
  } catch (error) {
    console.error(
      `Failed to read service account from ${credentialsPath}:`,
      error,
    );
    return undefined;
  }

  // Optional override applied to whichever language is requested.
  const voiceOverride = process.env.GOOGLE_TTS_VOICE;

  // Cached access token, refreshed shortly before it expires.
  let cached: { token: string; expiresAt: number } | undefined;
  async function getAccessToken(): Promise<string> {
    const now = Math.floor(Date.now() / 1000);
    if (!cached || cached.expiresAt - 60 <= now) {
      cached = await fetchAccessToken(serviceAccount);
    }
    return cached.token;
  }

  return {
    isConfigured(): boolean {
      return true;
    },

    async synthesize(
      text: string,
      language: 'de' | 'en',
      format: SpeechFormat = 'text',
    ): Promise<SpeechResult> {
      // Chirp 3 HD doesn't accept SSML `<break>`/`<emphasis>`/`<prosody>`, but
      // it does accept inline `[pause …]` markers via `input.markup`. Convert
      // the SSML body so structural pauses survive; plain text passes through.
      const input = format === 'ssml' ? ssmlToChirp3Markup(text) : text;
      const voice = voiceOverride || DEFAULT_VOICE[language];
      const chunks = chunkText(input, MAX_INPUT_BYTES);
      console.log(
        'Synthesizing speech with Google voice:',
        voice,
        'language:',
        language,
        'format:',
        format,
        'chunks:',
        chunks.length,
      );

      const accessToken = await getAccessToken();

      // Route by `format`, not by per-chunk content: `ssmlToChirp3Markup` is
      // the only producer of `[pause …]` markers we trust, so SSML input goes
      // through `input.markup`. Plain-text input must never be reinterpreted
      // as markup — a user prompt containing the literal `[pause]` would
      // otherwise be silenced instead of spoken.
      const useMarkup = format === 'ssml';

      async function synthesizeChunk(chunk: string): Promise<Buffer> {
        const inputField = useMarkup ? { markup: chunk } : { text: chunk };
        const response = await fetch(GOOGLE_TTS_ENDPOINT, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            input: inputField,
            voice: { languageCode: LANGUAGE_CODE[language], name: voice },
            audioConfig: { audioEncoding: 'MP3' },
          }),
        });

        if (!response.ok) {
          const detail = await response.text();
          throw new Error(
            `Google speech synthesis failed: ${response.status} ${response.statusText} - ${detail}`,
          );
        }

        const result = (await response.json()) as GoogleSpeechResponse;
        if (!result.audioContent) {
          throw new Error('Google speech synthesis returned no audio data');
        }
        return Buffer.from(result.audioContent, 'base64');
      }

      // MP3 frame streams concatenate cleanly into a single playable clip.
      const parts: Buffer[] = [];
      for (const chunk of chunks) {
        parts.push(await synthesizeChunk(chunk));
      }

      return {
        audioData: Buffer.concat(parts).toString('base64'),
        // Strip `[pause …]` markers so they don't inflate the spoken-word count.
        duration: estimateDuration(input.replace(PAUSE_MARKER, '')),
      };
    },
  };
}
