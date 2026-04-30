import { describe, expect, it } from 'vitest';

import { formatFilename, formatYyyymmdd } from '../filename';

const fixedNow = new Date('2026-04-30T12:34:56Z');

describe('formatFilename', () => {
  it('joins last and first with an underscore for two-token names', () => {
    expect(formatFilename('Jane Doe', fixedNow, 'pdf')).toBe(
      'Doe_Jane_20260430.pdf',
    );
  });

  it('keeps the lone token as-is for single-name profiles', () => {
    expect(formatFilename('Madonna', fixedNow, 'pdf')).toBe(
      'Madonna_20260430.pdf',
    );
  });

  it('falls back to Unknown when the name is missing', () => {
    expect(formatFilename(undefined, fixedNow, 'pdf')).toBe(
      'Unknown_20260430.pdf',
    );
    expect(formatFilename('', fixedNow, 'pdf')).toBe('Unknown_20260430.pdf');
  });

  it('strips path separators, control chars, and parent-dir sequences', () => {
    expect(formatFilename('../../etc/passwd', fixedNow, 'pdf')).toBe(
      'etcpasswd_20260430.pdf',
    );
    expect(formatFilename('Name:With/Slash\\And|Pipe', fixedNow, 'pdf')).toBe(
      'NameWithSlashAndPipe_20260430.pdf',
    );
  });

  it('returns Unknown when sanitization empties the name', () => {
    expect(formatFilename('///\\\\:::', fixedNow, 'pdf')).toBe(
      'Unknown_20260430.pdf',
    );
  });

  it('caps the sanitized name at 64 characters', () => {
    const long = 'A'.repeat(120);
    const result = formatFilename(long, fixedNow, 'pdf');
    const namePart = result.split('_')[0] ?? '';
    expect(namePart.length).toBe(64);
  });

  it('uses the requested extension', () => {
    expect(formatFilename('Jane Doe', fixedNow, 'docx')).toBe(
      'Doe_Jane_20260430.docx',
    );
  });
});

describe('formatYyyymmdd', () => {
  it('zero-pads early months and days', () => {
    expect(formatYyyymmdd(new Date('2026-01-05T00:00:00Z'))).toBe('20260105');
  });

  it('formats a four-digit year', () => {
    expect(formatYyyymmdd(new Date('0987-12-31T00:00:00Z'))).toBe('09871231');
  });
});
