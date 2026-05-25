/** Average speaking rate (~150 wpm) used only to estimate clip duration. */
const WORDS_PER_SECOND = 2.5;

/**
 * Strips SSML markup down to plain text. `markdownToSsml` only emits
 * `<emphasis>`, `<break>` and `<prosody>` tags; adapters whose provider does
 * not support those tags call this to fall back to clean, readable text.
 *
 * XML entities are decoded back to their characters so the provider speaks
 * them naturally rather than reading the literal `&gt;` / `&amp;`. `&amp;`
 * is decoded last so an encoded entity like `&amp;gt;` is not double-decoded.
 */
export function stripSsml(body: string): string {
  return body
    .replace(/<[^>]*>/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Converts an SSML body to a Chirp 3 HD markup body. `<break time="…ms"/>`
 * tags become inline `[pause …]` markers — the only structural pause control
 * Chirp 3 HD accepts; every other tag (`<emphasis>`, `<prosody>`, …) is
 * stripped so its inner text is still spoken. Plain input passes through.
 *
 * Tier mapping is duration-based so the single source of truth stays in
 * `markdownToSsml`: ≥800ms → long, 400–799ms → default, <400ms → short.
 */
export function ssmlToChirp3Markup(body: string): string {
  return body
    .replace(/<break\s+time="(\d+)ms"\s*\/>/g, (_match, ms: string) => {
      const duration = Number(ms);
      if (duration >= 800) return ' [pause long] ';
      if (duration >= 400) return ' [pause] ';
      return ' [pause short] ';
    })
    .replace(/<[^>]*>/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&')
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
