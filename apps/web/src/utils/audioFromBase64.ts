/**
 * Decodes a base64-encoded MP3 payload (as returned by the `speech.synthesize`
 * tRPC mutation) into a playable object URL.
 *
 * The caller owns the returned URL and must revoke it with
 * `URL.revokeObjectURL` once playback has ended or been aborted.
 */
export function audioUrlFromBase64(base64: string): string {
  const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
  const blob = new Blob([bytes], { type: 'audio/mpeg' });
  return URL.createObjectURL(blob);
}
