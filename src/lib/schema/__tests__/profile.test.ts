import { describe, expect, it } from 'vitest';

import { ExtractedProfileSchema, type ExtractedProfile } from '../profile';

const goldenFixture = {
  name: 'Ada Lovelace',
  email: 'ada@example.org',
  phone: '+44 20 7946 0958',
  current_title: 'Mathematician',
  current_company: 'Analytical Engine Co.',
  location: 'London, UK',
  summary: 'First computer programmer; algorithmic mind.',
  experiences: [
    {
      company: 'Analytical Engine Co.',
      title: 'Mathematician',
      start_date: '1843',
      end_date: 'Present',
      location: 'London, UK',
      bullets: [
        'Wrote the first published algorithm intended for the Analytical Engine.',
        'Translated Menabrea’s memoir on the Engine and added extensive notes.',
      ],
    },
    {
      company: 'Self',
      title: 'Researcher',
      bullets: [],
    },
  ],
  educations: [
    {
      institution: 'Private Tutoring',
      degree: 'Mathematics & Science',
      field: 'Analysis',
      start_date: '1832',
      end_date: '1842',
      location: 'London, UK',
    },
  ],
  skills: ['Mathematics', 'Symbolic logic', 'Technical writing'],
  certifications: [],
  languages: ['English', 'French'],
};

describe('ExtractedProfileSchema', () => {
  it('parses the golden fixture and exposes typed output', () => {
    const result = ExtractedProfileSchema.parse(goldenFixture);
    expect(result.name).toBe('Ada Lovelace');
    expect(result.experiences).toHaveLength(2);
    expect(result.experiences[0]?.bullets).toHaveLength(2);
    expect(result.experiences[1]?.bullets).toEqual([]);
    expect(result.educations[0]?.institution).toBe('Private Tutoring');
    expect(result.skills).toEqual(['Mathematics', 'Symbolic logic', 'Technical writing']);

    // Compile-time: the inferred type aligns with the export.
    const typed: ExtractedProfile = result;
    expect(typed.name).toBe('Ada Lovelace');
  });

  it('accepts a minimal profile with only name set; arrays default to empty', () => {
    const result = ExtractedProfileSchema.parse({ name: 'Solo' });
    expect(result.name).toBe('Solo');
    expect(result.experiences).toEqual([]);
    expect(result.educations).toEqual([]);
    expect(result.skills).toEqual([]);
    expect(result.certifications).toEqual([]);
    expect(result.languages).toEqual([]);
    expect(result.email).toBeUndefined();
  });

  it('rejects a profile missing the required name field', () => {
    const parsed = ExtractedProfileSchema.safeParse({ email: 'no-name@example.org' });
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      expect(parsed.error.issues.some((i) => i.path[0] === 'name')).toBe(true);
    }
  });

  it('rejects unknown top-level keys', () => {
    const parsed = ExtractedProfileSchema.safeParse({
      name: 'Ada',
      injected_field: 'malicious',
    });
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      const unrecognized = parsed.error.issues.find(
        (i): i is typeof i & { keys: string[] } =>
          i.code === 'unrecognized_keys' && Array.isArray((i as { keys?: unknown }).keys),
      );
      expect(unrecognized?.keys).toContain('injected_field');
    }
  });

  it('rejects an experience item missing the required company / title fields', () => {
    const parsed = ExtractedProfileSchema.safeParse({
      name: 'Ada',
      experiences: [{ start_date: '1840' }],
    });
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      const paths = parsed.error.issues.map((i) => i.path.join('.'));
      expect(paths.some((p) => p.endsWith('company'))).toBe(true);
      expect(paths.some((p) => p.endsWith('title'))).toBe(true);
    }
  });

  it('rejects empty-string name (NonEmptyString invariant)', () => {
    const parsed = ExtractedProfileSchema.safeParse({ name: '' });
    expect(parsed.success).toBe(false);
  });

  it('treats date fields as free-form strings (no normalization)', () => {
    const result = ExtractedProfileSchema.parse({
      name: 'Ada',
      experiences: [
        {
          company: 'Acme',
          title: 'Engineer',
          start_date: 'sometime in 2018',
          end_date: 'still here',
          bullets: ['Did things'],
        },
      ],
    });
    expect(result.experiences[0]?.start_date).toBe('sometime in 2018');
    expect(result.experiences[0]?.end_date).toBe('still here');
  });

  it('defaults bullets to [] when omitted from an experience item', () => {
    const result = ExtractedProfileSchema.parse({
      name: 'Ada',
      experiences: [{ company: 'Acme', title: 'Engineer' }],
    });
    expect(result.experiences[0]?.bullets).toEqual([]);
  });
});
