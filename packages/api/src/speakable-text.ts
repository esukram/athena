/**
 * Re-export of the speech context's `verbalizeSymbols` so the published
 * `@athena/api/speakable-text` entry point stays stable. The implementation
 * now lives in `@athena/domain`.
 */
export { verbalizeSymbols } from '@athena/domain';
