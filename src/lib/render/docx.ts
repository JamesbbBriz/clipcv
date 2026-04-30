// Deterministic DOCX rendering for an ExtractedProfile (US-010).
//
// Section order matches the PDF renderer (US-009): Header -> Summary
// -> Experience -> Education -> Skills -> Certifications -> Languages.
// Empty optional sections are omitted entirely (no empty headings).
// Filename formatting is shared with the PDF renderer via
// `./filename.ts`. The output is consumable in both the MV3 service
// worker (via Packer.toBlob) and in vitest's node environment.

import {
  AlignmentType,
  Document,
  HeadingLevel,
  Packer,
  Paragraph,
  TextRun,
} from 'docx';

import type {
  EducationItem,
  ExperienceItem,
  ExtractedProfile,
} from '@/lib/schema/profile';

import { formatFilename } from './filename';

const NAME_HALF_POINTS = 40;
const HEADING_HALF_POINTS = 28;
const BODY_HALF_POINTS = 22;
const BULLET_INDENT_TWIPS = 360;

function makeHeader(profile: ExtractedProfile): Paragraph[] {
  const paragraphs: Paragraph[] = [
    new Paragraph({
      children: [
        new TextRun({
          text: profile.name,
          bold: true,
          size: NAME_HALF_POINTS,
        }),
      ],
    }),
  ];

  const titleParts: string[] = [];
  if (profile.current_title) titleParts.push(profile.current_title);
  if (profile.current_company) titleParts.push(profile.current_company);
  if (titleParts.length > 0) {
    paragraphs.push(
      new Paragraph({
        children: [
          new TextRun({
            text: titleParts.join(' - '),
            size: BODY_HALF_POINTS,
          }),
        ],
      }),
    );
  }

  const contactParts: string[] = [];
  if (profile.location) contactParts.push(profile.location);
  if (profile.email) contactParts.push(profile.email);
  if (profile.phone) contactParts.push(profile.phone);
  if (contactParts.length > 0) {
    paragraphs.push(
      new Paragraph({
        children: [
          new TextRun({
            text: contactParts.join(' | '),
            size: BODY_HALF_POINTS,
          }),
        ],
      }),
    );
  }

  return paragraphs;
}

function makeSectionHeading(text: string): Paragraph {
  return new Paragraph({
    heading: HeadingLevel.HEADING_2,
    children: [
      new TextRun({
        text,
        bold: true,
        size: HEADING_HALF_POINTS,
      }),
    ],
  });
}

function makeBodyParagraph(text: string): Paragraph {
  return new Paragraph({
    children: [
      new TextRun({
        text,
        size: BODY_HALF_POINTS,
      }),
    ],
  });
}

function makeExperience(item: ExperienceItem): Paragraph[] {
  const heading = item.location
    ? `${item.title} - ${item.company} (${item.location})`
    : `${item.title} - ${item.company}`;
  const paragraphs: Paragraph[] = [
    new Paragraph({
      children: [
        new TextRun({
          text: heading,
          bold: true,
          size: BODY_HALF_POINTS,
        }),
      ],
    }),
  ];

  const dateParts: string[] = [];
  if (item.start_date) dateParts.push(item.start_date);
  if (item.end_date) dateParts.push(item.end_date);
  if (dateParts.length > 0) {
    paragraphs.push(makeBodyParagraph(dateParts.join(' - ')));
  }

  for (const bullet of item.bullets) {
    paragraphs.push(
      new Paragraph({
        indent: { left: BULLET_INDENT_TWIPS },
        children: [
          new TextRun({
            text: `* ${bullet}`,
            size: BODY_HALF_POINTS,
          }),
        ],
      }),
    );
  }
  return paragraphs;
}

function makeEducation(item: EducationItem): Paragraph[] {
  const paragraphs: Paragraph[] = [
    new Paragraph({
      children: [
        new TextRun({
          text: item.institution,
          bold: true,
          size: BODY_HALF_POINTS,
        }),
      ],
    }),
  ];

  const detailParts: string[] = [];
  if (item.degree) detailParts.push(item.degree);
  if (item.field) detailParts.push(item.field);
  if (item.location) detailParts.push(item.location);
  if (detailParts.length > 0) {
    paragraphs.push(makeBodyParagraph(detailParts.join(', ')));
  }

  const dateParts: string[] = [];
  if (item.start_date) dateParts.push(item.start_date);
  if (item.end_date) dateParts.push(item.end_date);
  if (dateParts.length > 0) {
    paragraphs.push(makeBodyParagraph(dateParts.join(' - ')));
  }
  return paragraphs;
}

function makeListSection(heading: string, items: string[]): Paragraph[] {
  return [makeSectionHeading(heading), makeBodyParagraph(items.join(', '))];
}

function buildBody(profile: ExtractedProfile): Paragraph[] {
  const children: Paragraph[] = [];
  children.push(...makeHeader(profile));

  if (profile.summary) {
    children.push(makeSectionHeading('Summary'));
    children.push(makeBodyParagraph(profile.summary));
  }

  if (profile.experiences.length > 0) {
    children.push(makeSectionHeading('Experience'));
    for (const item of profile.experiences) {
      children.push(...makeExperience(item));
    }
  }

  if (profile.educations.length > 0) {
    children.push(makeSectionHeading('Education'));
    for (const item of profile.educations) {
      children.push(...makeEducation(item));
    }
  }

  if (profile.skills.length > 0) {
    children.push(...makeListSection('Skills', profile.skills));
  }
  if (profile.certifications.length > 0) {
    children.push(...makeListSection('Certifications', profile.certifications));
  }
  if (profile.languages.length > 0) {
    children.push(...makeListSection('Languages', profile.languages));
  }

  // Trailing empty paragraph keeps the section terminator well-formed
  // when the last block is a list section. Guards against renderer
  // edge cases where some Office versions reject a section that ends
  // mid-paragraph properties.
  children.push(new Paragraph({ alignment: AlignmentType.LEFT }));
  return children;
}

export type RenderDocxResult = {
  bytes: Uint8Array;
  filename: string;
};

export type RenderDocxOptions = {
  now?: Date;
};

export async function renderDocx(
  profile: ExtractedProfile,
  options: RenderDocxOptions = {},
): Promise<RenderDocxResult> {
  const now = options.now ?? new Date();
  const doc = new Document({
    creator: 'clipcv',
    title: profile.name,
    description: '',
    sections: [
      {
        properties: {},
        children: buildBody(profile),
      },
    ],
  });
  const blob = await Packer.toBlob(doc);
  const arrayBuffer = await blob.arrayBuffer();
  const bytes = new Uint8Array(arrayBuffer);
  const filename = formatFilename(profile.name, now, 'docx');
  return { bytes, filename };
}
