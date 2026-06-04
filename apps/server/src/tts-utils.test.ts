import { describe, expect, it } from 'vitest';

import { chunkText, ssmlToChirp3Markup } from './tts-utils.js';

describe('ssmlToChirp3Markup', () => {
  it('maps a long break (>=800ms) to [pause long]', () => {
    expect(ssmlToChirp3Markup('a<break time="900ms"/>b')).toBe(
      'a [pause long] b',
    );
  });

  it('maps a default break (400–799ms) to [pause]', () => {
    expect(ssmlToChirp3Markup('a<break time="600ms"/>b')).toBe('a [pause] b');
  });

  it('maps a short break (<400ms) to [pause short]', () => {
    expect(ssmlToChirp3Markup('a<break time="200ms"/>b')).toBe(
      'a [pause short] b',
    );
  });

  it('treats 400ms as the lower bound of [pause]', () => {
    expect(ssmlToChirp3Markup('a<break time="400ms"/>b')).toBe('a [pause] b');
  });

  it('treats 799ms as still [pause]', () => {
    expect(ssmlToChirp3Markup('a<break time="799ms"/>b')).toBe('a [pause] b');
  });

  it('treats 800ms as the lower bound of [pause long]', () => {
    expect(ssmlToChirp3Markup('a<break time="800ms"/>b')).toBe(
      'a [pause long] b',
    );
  });

  it('treats 399ms as still [pause short]', () => {
    expect(ssmlToChirp3Markup('a<break time="399ms"/>b')).toBe(
      'a [pause short] b',
    );
  });

  it('strips <emphasis> but keeps the inner text', () => {
    const out = ssmlToChirp3Markup(
      'Hello <emphasis level="strong">World</emphasis>',
    );
    expect(out).toBe('Hello World');
  });

  it('strips <prosody> but keeps the inner text', () => {
    const out = ssmlToChirp3Markup(
      'Run <prosody rate="-20%">npm install</prosody> now',
    );
    expect(out).toBe('Run npm install now');
  });

  it('decodes XML entities', () => {
    expect(
      ssmlToChirp3Markup('a &amp; b &lt; c &gt; d &quot;e&quot; &apos;f&apos;'),
    ).toBe('a & b < c > d "e" \'f\'');
  });

  it('decodes &amp; last so &amp;gt; becomes &gt; (not >)', () => {
    expect(ssmlToChirp3Markup('x &amp;gt; y')).toBe('x &gt; y');
  });

  it('passes plain (non-SSML) input through, trimmed', () => {
    expect(ssmlToChirp3Markup('  just plain text  ')).toBe('just plain text');
  });

  it('accepts single-quoted break attributes', () => {
    expect(ssmlToChirp3Markup("a<break time='600ms'/>b")).toBe('a [pause] b');
  });

  it('accepts breaks expressed in seconds', () => {
    expect(ssmlToChirp3Markup('a<break time="1s"/>b')).toBe('a [pause long] b');
    expect(ssmlToChirp3Markup('a<break time="0.5s"/>b')).toBe('a [pause] b');
  });

  it('preserves composite ordering of words and pause markers', () => {
    const out = ssmlToChirp3Markup(
      'Hello<break time="600ms"/><emphasis level="strong">World</emphasis><break time="900ms"/>',
    );
    expect(out).toContain('Hello');
    expect(out).toContain('[pause]');
    expect(out).toContain('World');
    expect(out).toContain('[pause long]');
    // Order check.
    const idxHello = out.indexOf('Hello');
    const idxPause = out.indexOf('[pause]');
    const idxWorld = out.indexOf('World');
    const idxLong = out.indexOf('[pause long]');
    expect(idxHello).toBeLessThan(idxPause);
    expect(idxPause).toBeLessThan(idxWorld);
    expect(idxWorld).toBeLessThan(idxLong);
  });
});

describe('chunkText with Chirp3 markup', () => {
  it('never splits a [pause …] token across chunks at sentence boundaries', () => {
    const sentence = 'This is a moderately long sentence used to fill bytes. ';
    const body = (
      sentence.repeat(20) +
      '[pause long] ' +
      sentence.repeat(20)
    ).trim();
    const chunks = chunkText(body, 200);
    expect(chunks.length).toBeGreaterThan(1);
    assertPauseTokensIntact(chunks);
  });

  it('keeps [pause …] atomic inside an over-long unpunctuated sentence', () => {
    // No `.!?` anywhere, so chunkText falls through to the word-splitting
    // branch — the only path where a marker could be torn in half.
    const clause = 'word '.repeat(80);
    const body = (clause + '[pause long] ' + clause).trim();
    const chunks = chunkText(body, 200);
    expect(chunks.length).toBeGreaterThan(1);
    assertPauseTokensIntact(chunks);
    // And the marker must appear, intact, in exactly one chunk.
    const withMarker = chunks.filter((c) => c.includes('[pause long]'));
    expect(withMarker).toHaveLength(1);
  });

  it('packs words of an over-long sentence into the preceding chunk', () => {
    // A short fitting sentence followed by an over-long one: the greedy
    // packer carries the short sentence forward and fills the chunk with the
    // next sentence's leading words rather than sealing it at the sentence
    // boundary. This pins that boundary-crossing behavior.
    const chunks = chunkText('Hi. aaaa bbbb cccc', 10);
    expect(chunks).toEqual(['Hi. aaaa ', 'bbbb cccc']);
  });

  it('keeps every divisible chunk within maxBytes', () => {
    const body = 'Short. ' + 'word '.repeat(50);
    const chunks = chunkText(body, 40);
    for (const chunk of chunks) {
      expect(Buffer.byteLength(chunk, 'utf8')).toBeLessThanOrEqual(40);
    }
  });

  it('emits an over-limit chunk for a single piece longer than maxBytes', () => {
    // A word longer than the limit cannot be split further, so it is emitted
    // as its own oversized chunk — the one case that breaches maxBytes.
    const chunks = chunkText('Hi. aaaaaaaaaaaaaaaaaaaa bye', 10);
    expect(chunks.some((c) => Buffer.byteLength(c, 'utf8') > 10)).toBe(true);
  });

  it('allows a [pause …] marker to land at a chunk start', () => {
    const body = 'word '.repeat(10) + '[pause long] ' + 'word '.repeat(10);
    const chunks = chunkText(body, 12);
    expect(chunks.some((c) => c.startsWith('[pause long]'))).toBe(true);
    assertPauseTokensIntact(chunks);
  });
});

function assertPauseTokensIntact(chunks: string[]): void {
  for (const chunk of chunks) {
    // Any `[` or `]` in a chunk must belong to a complete `[pause …]` token.
    const fragments = chunk.match(/\[[^\]]*\]?|\][^[]*/g) ?? [];
    for (const fragment of fragments) {
      if (fragment.startsWith('[')) {
        expect(fragment).toMatch(/^\[pause( short| long)?\]$/);
      } else {
        // A bare `]` with no preceding `[` means a token was torn.
        expect(fragment).not.toMatch(/^\]/);
      }
    }
  }
}
