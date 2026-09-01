import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { detectImageFormat } from '@/lib/services/branding';

describe('detectImageFormat', () => {
  it('identifies a real PNG file by its actual bytes — the exact logo file used for this feature', () => {
    // Regression test for the real bug this function fixes: a browser can
    // report the wrong file.type for a genuine PNG, which previously
    // caused the server to serve it with a mismatched image/jpeg
    // Content-Type header. Using the file's own bytes sidesteps that
    // entirely.
    const bytes = new Uint8Array(readFileSync('/home/claude/zenara-logo-email.png'));
    expect(detectImageFormat(bytes)).toBe('png');
  });

  it('identifies a JPEG by its magic bytes (FF D8 FF), regardless of what a filename or MIME type might claim', () => {
    const jpegBytes = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46]);
    expect(detectImageFormat(jpegBytes)).toBe('jpeg');
  });

  it('identifies a PNG by its magic bytes (89 50 4E 47), regardless of what a filename or MIME type might claim', () => {
    const pngBytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    expect(detectImageFormat(pngBytes)).toBe('png');
  });

  it('rejects a file that is neither — e.g. a renamed text file or corrupted upload — rather than guessing', () => {
    const textBytes = new Uint8Array(Buffer.from('not actually an image'));
    expect(detectImageFormat(textBytes)).toBeNull();
  });

  it('rejects an empty or truncated file', () => {
    expect(detectImageFormat(new Uint8Array([]))).toBeNull();
    expect(detectImageFormat(new Uint8Array([0x89, 0x50]))).toBeNull();
  });
});
