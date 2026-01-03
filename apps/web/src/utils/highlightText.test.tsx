import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { highlightText } from './highlightText';

describe('highlightText', () => {
  it('returns text unchanged when query is empty', () => {
    const result = highlightText('hello world', '');
    expect(result).toBe('hello world');
  });

  it('returns text unchanged when query has only whitespace', () => {
    const result = highlightText('hello world', '   ');
    expect(result).toBe('hello world');
  });

  it('highlights a single matching token', () => {
    const result = highlightText('hello world', 'hello');
    const { container } = render(<>{result}</>);

    const mark = container.querySelector('mark');
    expect(mark).not.toBeNull();
    expect(mark?.textContent).toBe('hello');
    expect(screen.getByText('hello')).toHaveClass('bg-yellow-200');
  });

  it('highlights multiple matching tokens', () => {
    const result = highlightText('hello beautiful world', 'hello world');
    const { container } = render(<>{result}</>);

    const marks = container.querySelectorAll('mark');
    expect(marks.length).toBe(2);
    expect(marks[0].textContent).toBe('hello');
    expect(marks[1].textContent).toBe('world');
  });

  it('is case insensitive', () => {
    const result = highlightText('Hello World', 'hello world');
    const { container } = render(<>{result}</>);

    const marks = container.querySelectorAll('mark');
    expect(marks.length).toBe(2);
    expect(marks[0].textContent).toBe('Hello');
    expect(marks[1].textContent).toBe('World');
  });

  it('handles special regex characters in query', () => {
    const result = highlightText('hello (world) [test]', '(world)');
    const { container } = render(<>{result}</>);

    const mark = container.querySelector('mark');
    expect(mark).not.toBeNull();
    expect(mark?.textContent).toBe('(world)');
  });

  it('returns original text when no matches found', () => {
    const result = highlightText('hello world', 'xyz');
    const { container } = render(<>{result}</>);

    const marks = container.querySelectorAll('mark');
    expect(marks.length).toBe(0);
    expect(container.textContent).toBe('hello world');
  });
});
