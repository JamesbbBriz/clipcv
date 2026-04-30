import { describe, expect, it } from 'vitest';

import type { ExtractedProfile } from '@/lib/schema/profile';

import { renderPdf } from '../pdf';

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

function pdfMagic(bytes: Uint8Array): string {
  return new TextDecoder('latin1').decode(bytes.slice(0, 5));
}

describe('renderPdf', () => {
  it('produces a valid PDF for the golden fixture', async () => {
    const result = await renderPdf(goldenProfile, { now: fixedNow });
    expect(result.bytes.byteLength).toBeGreaterThan(0);
    expect(pdfMagic(result.bytes)).toBe('%PDF-');
  });

  it('uses the {Last_First}_{YYYYMMDD}.pdf filename pattern', async () => {
    const result = await renderPdf(goldenProfile, { now: fixedNow });
    expect(result.filename).toBe('Doe_Jane_20260430.pdf');
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
    const result = await renderPdf(minimal, { now: fixedNow });
    expect(result.bytes.byteLength).toBeGreaterThan(0);
    expect(pdfMagic(result.bytes)).toBe('%PDF-');
    expect(result.filename).toBe('Solo_20260430.pdf');
  });

  it('paginates content larger than a single A4 page without crashing', async () => {
    const longBullets = Array.from(
      { length: 40 },
      (_, i) => `Bullet point number ${i + 1} describing a long achievement.`,
    );
    const long: ExtractedProfile = {
      ...goldenProfile,
      experiences: [
        {
          company: 'BigCo',
          title: 'Engineer',
          start_date: 'Jan 2020',
          end_date: 'Present',
          bullets: longBullets,
        },
      ],
    };
    const result = await renderPdf(long, { now: fixedNow });
    expect(result.bytes.byteLength).toBeGreaterThan(0);
    expect(pdfMagic(result.bytes)).toBe('%PDF-');
  });
});

