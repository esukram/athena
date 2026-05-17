import { afterEach, describe, expect, it, vi } from 'vitest';

import { audioUrlFromBase64 } from './audioFromBase64';

describe('audioUrlFromBase64', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('decodes base64 into an audio/mpeg Blob and returns its object URL', () => {
    const blobs: Blob[] = [];
    const createSpy = vi
      .spyOn(URL, 'createObjectURL')
      .mockImplementation((blob: Blob | MediaSource) => {
        blobs.push(blob as Blob);
        return 'blob:mock-url';
      });

    // base64 for the bytes [0x49, 0x44, 0x33] ("ID3", an MP3 tag header)
    const url = audioUrlFromBase64(btoa('ID3'));

    expect(url).toBe('blob:mock-url');
    expect(createSpy).toHaveBeenCalledOnce();
    expect(blobs[0].type).toBe('audio/mpeg');
    expect(blobs[0].size).toBe(3);
  });
});
