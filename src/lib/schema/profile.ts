// Zod schema for the structured profile data the Vision LLM returns.
// Single source of truth for the LLM contract: the prompt in
// US-008 reproduces this shape verbatim, the renderers in US-009 /
// US-010 consume the inferred type. All date fields are free-form
// strings — the model returns whatever the page shows; we do not
// normalize. The only required field is `name`; everything else is
// optional or array-with-empty-default. Unknown top-level keys are
// rejected so a hostile / hallucinating model cannot silently smuggle
// extra fields into the rendered document.

import { z } from 'zod';

const NonEmptyString = z.string().min(1);

const ExperienceItemSchema = z.object({
  company: NonEmptyString,
  title: NonEmptyString,
  start_date: NonEmptyString.optional(),
  end_date: NonEmptyString.optional(),
  location: NonEmptyString.optional(),
  bullets: z.array(z.string()).default([]),
});

const EducationItemSchema = z.object({
  institution: NonEmptyString,
  degree: NonEmptyString.optional(),
  field: NonEmptyString.optional(),
  start_date: NonEmptyString.optional(),
  end_date: NonEmptyString.optional(),
  location: NonEmptyString.optional(),
});

export const ExtractedProfileSchema = z.strictObject({
  name: NonEmptyString,
  email: NonEmptyString.optional(),
  phone: NonEmptyString.optional(),
  current_title: NonEmptyString.optional(),
  current_company: NonEmptyString.optional(),
  location: NonEmptyString.optional(),
  summary: NonEmptyString.optional(),
  experiences: z.array(ExperienceItemSchema).default([]),
  educations: z.array(EducationItemSchema).default([]),
  skills: z.array(NonEmptyString).default([]),
  certifications: z.array(NonEmptyString).default([]),
  languages: z.array(NonEmptyString).default([]),
});

export type ExtractedProfile = z.infer<typeof ExtractedProfileSchema>;
export type ExperienceItem = z.infer<typeof ExperienceItemSchema>;
export type EducationItem = z.infer<typeof EducationItemSchema>;
