import React from 'react';

/**
 * Highlights matching tokens in text with a yellow background.
 * Splits the query into space-separated tokens and highlights any match.
 *
 * @param text - The text to search within
 * @param query - Space-separated search tokens
 * @returns React nodes with matches wrapped in <mark> elements
 */
export const highlightText = (text: string, query: string): React.ReactNode => {
  if (!query.trim()) return text;

  const tokens = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return text;

  // Build a regex to match any of the tokens (case-insensitive)
  const escapedTokens = tokens.map((t) =>
    t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
  );
  const regex = new RegExp(`(${escapedTokens.join('|')})`, 'gi');

  const parts = text.split(regex);
  return parts.map((part, index) => {
    const isMatch = tokens.some((token) => part.toLowerCase() === token);
    if (isMatch) {
      return (
        <mark key={index} className="bg-yellow-200 text-inherit rounded px-0.5">
          {part}
        </mark>
      );
    }
    return part;
  });
};
