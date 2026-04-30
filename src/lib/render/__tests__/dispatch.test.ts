import { describe, expect, it } from 'vitest';

import type { ExtractedProfile } from '@/lib/schema/profile';

import { renderForOutput } from '../dispatch';

const fixedNow = new Date('2026-04-30T12:34:56Z');

const minimalProfile: ExtractedProfile = {
  name: 'Jane Doe',
  experiences: [],
  educations: [],
  skills: [],
  certifications: [],
  languages: [],
};

describe('renderForOutput', () => {
  it("emits one PDF when output='pdf'", async () => {
    const files = await renderForOutput(minimalProfile, 'pdf', {
      now: fixedNow,
    });
    expect(files).toHaveLength(1);
    const file = files[0];
    expect(file).toBeDefined();
    expect(file?.filename).toBe('Doe_Jane_20260430.pdf');
    expect(file?.mimeType).toBe('application/pdf');
    expect(file?.bytes.byteLength).toBeGreaterThan(0);
  });

  it("emits one DOCX when output='docx'", async () => {
    const files = await renderForOutput(minimalProfile, 'docx', {
      now: fixedNow,
    });
    expect(files).toHaveLength(1);
    const file = files[0];
    expect(file).toBeDefined();
    expect(file?.filename).toBe('Doe_Jane_20260430.docx');
    expect(file?.mimeType).toBe(
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    );
    expect(file?.bytes.byteLength).toBeGreaterThan(0);
  });

  it("emits both PDF and DOCX when output='both'", async () => {
    const files = await renderForOutput(minimalProfile, 'both', {
      now: fixedNow,
    });
    expect(files).toHaveLength(2);
    expect(files.map((f) => f.filename)).toEqual([
      'Doe_Jane_20260430.pdf',
      'Doe_Jane_20260430.docx',
    ]);
    for (const f of files) {
      expect(f.bytes.byteLength).toBeGreaterThan(0);
    }
  });

  it('uses the current Date when options.now is omitted', async () => {
    const before = new Date();
    const files = await renderForOutput(minimalProfile, 'pdf');
    const after = new Date();
    expect(files).toHaveLength(1);
    const filename = files[0]?.filename ?? '';
    const match = filename.match(/_(\d{8})\.pdf$/);
    expect(match).not.toBeNull();
    const yyyymmdd = match![1] as string;
    const ymdLow = `${before.getFullYear()}${String(before.getMonth() + 1).padStart(2, '0')}${String(before.getDate()).padStart(2, '0')}`;
    const ymdHigh = `${after.getFullYear()}${String(after.getMonth() + 1).padStart(2, '0')}${String(after.getDate()).padStart(2, '0')}`;
    expect([ymdLow, ymdHigh]).toContain(yyyymmdd);
  });
});
