import { describe, expect, it } from 'vitest';

import type { ExtractedProfile } from '@/lib/schema/profile';

import { renderDocx } from '../docx';

const fixedNow = new Date('2026-04-30T12:34:56Z');

const goldenProfile: ExtractedProfile = {
  name: 'Jane Doe',
  email: 'jane@example.com',
  phone: '+1 555 0100',
  current_title: 'Senior Engineer',
  current_company: 'Acme Corp',
  location: 'Sydney, AU',
  summary:
    'Backend engineer with ten years of experience designing distributed systems, mentoring teams, and shipping production code.',
  experiences: [
    {
      company: 'Acme Corp',
      title: 'Senior Engineer',
      start_date: 'Jan 2022',
      end_date: 'Present',
      location: 'Sydney',
      bullets: [
        'Led the platform migration from a monolith to a service-oriented architecture.',
        'Mentored three junior engineers; two were promoted within twelve months.',
      ],
    },
    {
      company: 'Globex',
      title: 'Software Engineer',
      start_date: 'Mar 2018',
      end_date: 'Dec 2021',
      bullets: ['Owned the billing pipeline.'],
    },
  ],
  educations: [
    {
      institution: 'University of Example',
      degree: 'BSc',
      field: 'Computer Science',
      start_date: '2014',
      end_date: '2018',
    },
  ],
  skills: ['TypeScript', 'Go', 'Postgres', 'AWS'],
  certifications: ['AWS Solutions Architect Associate'],
  languages: ['English', 'Mandarin'],
};

function zipMagic(bytes: Uint8Array): string {
  // DOCX is a ZIP archive — the first four bytes must be the local
  // file header signature (PK\x03\x04, 0x504B0304).
  return Array.from(bytes.slice(0, 4))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

describe('renderDocx', () => {
  it('produces a valid DOCX (ZIP) for the golden fixture', async () => {
    const result = await renderDocx(goldenProfile, { now: fixedNow });
    expect(result.bytes.byteLength).toBeGreaterThan(0);
    expect(zipMagic(result.bytes)).toBe('504b0304');
  });

  it('uses the {Last_First}_{YYYYMMDD}.docx filename pattern', async () => {
    const result = await renderDocx(goldenProfile, { now: fixedNow });
    expect(result.filename).toBe('Doe_Jane_20260430.docx');
  });

  it('renders without error when only the required name is set', async () => {
    const minimal: ExtractedProfile = {
      name: 'Solo',
      experiences: [],
      educations: [],
      skills: [],
      certifications: [],
      languages: [],
    };
    const result = await renderDocx(minimal, { now: fixedNow });
    expect(result.bytes.byteLength).toBeGreaterThan(0);
    expect(zipMagic(result.bytes)).toBe('504b0304');
    expect(result.filename).toBe('Solo_20260430.docx');
  });

  it('falls back to Unknown when the name is the literal "Unknown"', async () => {
    const unknown: ExtractedProfile = {
      name: 'Unknown',
      experiences: [],
      educations: [],
      skills: [],
      certifications: [],
      languages: [],
    };
    const result = await renderDocx(unknown, { now: fixedNow });
    expect(result.filename).toBe('Unknown_20260430.docx');
  });

  it('embeds the profile name and section labels in the document XML', async () => {
    // The DOCX is a ZIP; word/document.xml is the section content.
    // Crack open the zip just enough to confirm rendering produced
    // visible content for each populated section.
    const result = await renderDocx(goldenProfile, { now: fixedNow });
    const { default: JSZip } = await import('jszip');
    const zip = await JSZip.loadAsync(result.bytes);
    const documentXml = await zip.file('word/document.xml')?.async('string');
    expect(documentXml).toBeDefined();
    const xml = documentXml as string;
    expect(xml).toContain('Jane Doe');
    expect(xml).toContain('Summary');
    expect(xml).toContain('Experience');
    expect(xml).toContain('Education');
    expect(xml).toContain('Skills');
    expect(xml).toContain('Certifications');
    expect(xml).toContain('Languages');
    // Heading-2 mapping for section titles.
    expect(xml).toContain('Heading2');
  });

  it('omits empty optional sections (no Summary heading on minimal profile)', async () => {
    const minimal: ExtractedProfile = {
      name: 'Solo',
      experiences: [],
      educations: [],
      skills: [],
      certifications: [],
      languages: [],
    };
    const result = await renderDocx(minimal, { now: fixedNow });
    const { default: JSZip } = await import('jszip');
    const zip = await JSZip.loadAsync(result.bytes);
    const xml = (await zip.file('word/document.xml')?.async('string')) ?? '';
    expect(xml).not.toContain('Summary');
    expect(xml).not.toContain('Experience');
    expect(xml).not.toContain('Education');
    expect(xml).not.toContain('Skills');
    expect(xml).not.toContain('Certifications');
    expect(xml).not.toContain('Languages');
    expect(xml).toContain('Solo');
  });
});
