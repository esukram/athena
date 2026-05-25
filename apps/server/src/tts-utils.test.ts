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
  it('never splits a [pause …] token across chunks', () => {
    // Build a body well over the byte budget so chunking actually happens.
    const sentence = 'This is a moderately long sentence used to fill bytes. ';
    const body = (
      sentence.repeat(20) +
      '[pause long] ' +
      sentence.repeat(20)
    ).trim();
    const chunks = chunkText(body, 200);
    expect(chunks.length).toBeGreaterThan(1);
    for (const chunk of chunks) {
      // Any `[` in a chunk must be followed by a complete `[pause …]` token.
      const tokens = chunk.match(/\[[^\]]*\]?/g) ?? [];
      for (const token of tokens) {
        expect(token).toMatch(/^\[pause( short| long)?\]$/);
      }
    }
  });
});
