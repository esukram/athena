/** Average speaking rate (~150 wpm) used only to estimate clip duration. */
const WORDS_PER_SECOND = 2.5;

/** Matches a Chirp 3 HD pause marker token (`[pause]`, `[pause short]`, `[pause long]`). */
export const PAUSE_MARKER = /\[pause(?: short| long)?\]/g;

/**
 * Converts an SSML body to a Chirp 3 HD markup body. `<break time="…">` tags
 * become inline `[pause …]` markers — the structural pause control we use
 * with Chirp 3 HD. Every other tag (including `<emphasis>`/`<prosody>` and
 * the Chirp-supported `<say-as>`/`<sub>`/`<p>`/`<s>`, which `markdownToSsml`
 * does not emit today) is stripped so its inner text is still spoken. Plain
 * input passes through.
 *
 * Tier mapping is duration-based so the single source of truth stays in
 * `markdownToSsml`: ≥800ms → long, 400–799ms → default, <400ms → short.
 */
export function ssmlToChirp3Markup(body: string): string {
  return body
    .replace(
      /<break\s+time=["'](\d+(?:\.\d+)?)(ms|s)["']\s*\/?>/g,
      (_match, num: string, unit: string) => {
        const duration = unit === 's' ? Number(num) * 1000 : Number(num);
        if (duration >= 800) return ' [pause long] ';
        if (duration >= 400) return ' [pause] ';
        return ' [pause short] ';
      },
    )
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
  const utf8Len = (s: string) => Buffer.byteLength(s, 'utf8');
  if (utf8Len(text) <= maxBytes) return [text];

  const sentences = text.match(/[^.!?]*[.!?]+\s*|[^.!?]+$/g) ?? [text];

  // Expand into atomic pieces: whole sentences that fit, or — for sentences
  // longer than the limit — their words and `[pause …]` markers, which must
  // stay intact so the Chirp 3 markup token survives.
  const pieces = sentences.flatMap((sentence) =>
    utf8Len(sentence) <= maxBytes
      ? [sentence]
      : sentence.split(/(\[pause(?: short| long)?\]|\s+)/).filter(Boolean),
  );

  // Greedily pack pieces, flushing the current chunk before any piece that
  // would overflow it.
  const chunks: string[] = [];
  let current = '';
  const flush = () => {
    if (current.trim()) chunks.push(current);
    current = '';
  };
  for (const piece of pieces) {
    if (current && utf8Len(current + piece) > maxBytes) flush();
    current += piece;
  }
  flush();

  return chunks;
}
