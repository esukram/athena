import { describe, expect, it } from 'vitest';

import { markdownToSsml } from './markdownToSsml';

describe('markdownToSsml', () => {
  it('returns an empty string for empty or whitespace input', () => {
    expect(markdownToSsml('')).toBe('');
    expect(markdownToSsml('   \n  ')).toBe('');
  });

  it('renders a plain paragraph with an escaped text and a trailing break', () => {
    const ssml = markdownToSsml('Hello world');
    expect(ssml).toBe('Hello world<break time="600ms"/>');
  });

  it('maps headings to strong emphasis', () => {
    const ssml = markdownToSsml('# Big Title');
    expect(ssml).toContain('<emphasis level="strong">Big Title</emphasis>');
  });

  it('maps bold text to strong emphasis', () => {
    const ssml = markdownToSsml('This is **important** stuff');
    expect(ssml).toContain('<emphasis level="strong">important</emphasis>');
  });

  it('maps italic text to moderate emphasis', () => {
    const ssml = markdownToSsml('This is *subtle* stuff');
    expect(ssml).toContain('<emphasis level="moderate">subtle</emphasis>');
  });

  it('renders list items separated by breaks', () => {
    const ssml = markdownToSsml('- one\n- two');
    expect(ssml).toContain('one<break time="600ms"/>');
    expect(ssml).toContain('two<break time="600ms"/>');
  });

  it('keeps link text and drops the URL', () => {
    const ssml = markdownToSsml('See [the docs](https://example.com/page)');
    expect(ssml).toContain('the docs');
    expect(ssml).not.toContain('example.com');
  });

  it('strips bare URLs appearing as text', () => {
    const ssml = markdownToSsml('Visit https://example.com/secret now');
    expect(ssml).not.toContain('example.com');
    expect(ssml).toContain('Visit');
    expect(ssml).toContain('now');
  });

  it('speaks code blocks slowly via prosody', () => {
    const ssml = markdownToSsml('```\nconst x = 1;\n```');
    expect(ssml).toContain('<prosody rate="-20%">');
  });

  it('speaks inline code slowly via prosody', () => {
    const ssml = markdownToSsml('Use `npm install` here');
    expect(ssml).toContain('<prosody rate="-20%">npm install</prosody>');
  });

  it('escapes XML special characters in text', () => {
    const ssml = markdownToSsml('a & b < c > d "e" \'f\'');
    expect(ssml).toContain('&amp;');
    expect(ssml).toContain('&lt;');
    expect(ssml).toContain('&gt;');
    expect(ssml).toContain('&quot;');
    expect(ssml).toContain('&apos;');
    // No raw special chars leaked from content into the markup.
    expect(ssml).not.toMatch(/&(?!amp;|lt;|gt;|quot;|apos;)/);
  });

  it('does not emit a speak or voice envelope', () => {
    const ssml = markdownToSsml('# Title\n\nSome content.');
    expect(ssml).not.toContain('<speak');
    expect(ssml).not.toContain('<voice');
  });

  it('returns an empty string when there is no spoken text', () => {
    expect(markdownToSsml('---')).toBe('');
    expect(markdownToSsml('![alt](https://example.com/img.png)')).toBe('');
  });
});
