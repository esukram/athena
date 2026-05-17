/** Average speaking rate (~150 wpm) used only to estimate clip duration. */
const WORDS_PER_SECOND = 2.5;

/**
 * Strips SSML markup down to plain text. `markdownToSsml` only emits
 * `<emphasis>`, `<break>` and `<prosody>` tags; adapters whose provider does
 * not support those tags call this to fall back to clean, readable text.
 */
export function stripSsml(body: string): string {
  return body
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Rough duration estimate in ms; `SpeechResult.duration` is unused client-side. */
export function estimateDuration(text: string): number {
  const words = text.split(/\s+/).filter(Boolean).length;
  return Math.round((words / WORDS_PER_SECOND) * 1000);
}

/**
 * Splits `text` into chunks whose UTF-8 byte length stays within `maxBytes`.
 * Prefers sentence boundaries, falling back to word boundaries for sentences
 * that are themselves too long. Used to stay under provider input-size limits.
 */
export function chunkText(text: string, maxBytes: number): string[] {
  if (Buffer.byteLength(text, 'utf8') <= maxBytes) return [text];

  const sentences = text.match(/[^.!?]*[.!?]+\s*|[^.!?]+$/g) ?? [text];
  const chunks: string[] = [];
  let current = '';

  const flush = () => {
    if (current.trim()) chunks.push(current);
    current = '';
  };

  for (const sentence of sentences) {
    if (Buffer.byteLength(current + sentence, 'utf8') <= maxBytes) {
      current += sentence;
      continue;
    }
    flush();
    if (Buffer.byteLength(sentence, 'utf8') <= maxBytes) {
      current = sentence;
      continue;
    }
    // Sentence alone exceeds the limit: pack it word by word.
    for (const word of sentence.split(/(\s+)/)) {
      if (current && Buffer.byteLength(current + word, 'utf8') > maxBytes) {
        flush();
      }
      current += word;
    }
  }
  flush();
  return chunks;
}
