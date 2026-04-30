// Deterministic PDF rendering for an ExtractedProfile (US-009).
//
// Layout: A4 portrait, 50pt margin, single Helvetica family.
// Body 11pt, section headings 14pt bold, name 20pt bold.
// Section order per AC: Header -> Summary -> Experience -> Education
// -> Skills -> Certifications -> Languages. Empty optional sections
// are omitted entirely (no empty headings). Filename formatting is
// shared with the DOCX renderer (US-010) via `./filename.ts`.

import { PDFDocument, PDFFont, PDFPage, StandardFonts, rgb } from 'pdf-lib';

import type {
  EducationItem,
  ExperienceItem,
  ExtractedProfile,
} from '@/lib/schema/profile';

import { formatFilename } from './filename';

const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;
const MARGIN = 50;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;
const BODY_SIZE = 11;
const HEADING_SIZE = 14;
const NAME_SIZE = 20;
const LINE_HEIGHT = 1.4;
const HEADING_LEAD = 1.6;
const HEADING_RULE_GAP = 4;
const BLOCK_GAP = 6;

type Cursor = {
  pdf: PDFDocument;
  page: PDFPage;
  y: number;
  font: PDFFont;
  bold: PDFFont;
};

function ensureSpace(cursor: Cursor, lines: number, size: number): void {
  const needed = lines * size * LINE_HEIGHT;
  if (cursor.y - needed < MARGIN) {
    cursor.page = cursor.pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    cursor.y = PAGE_HEIGHT - MARGIN;
  }
}

function wrapText(
  text: string,
  font: PDFFont,
  size: number,
  maxWidth: number,
): string[] {
  const words = text.split(/\s+/).filter((w) => w.length > 0);
  if (words.length === 0) return [''];
  const lines: string[] = [];
  let current = '';
  for (const word of words) {
    const candidate = current.length === 0 ? word : `${current} ${word}`;
    if (font.widthOfTextAtSize(candidate, size) > maxWidth) {
      if (current.length > 0) lines.push(current);
      current = word;
    } else {
      current = candidate;
    }
  }
  if (current.length > 0) lines.push(current);
  return lines;
}

function drawLine(
  cursor: Cursor,
  text: string,
  opts: { font: PDFFont; size: number; indent?: number },
): void {
  const indent = opts.indent ?? 0;
  ensureSpace(cursor, 1, opts.size);
  cursor.y -= opts.size * LINE_HEIGHT;
  cursor.page.drawText(text, {
    x: MARGIN + indent,
    y: cursor.y,
    size: opts.size,
    font: opts.font,
    color: rgb(0, 0, 0),
  });
}

function drawWrapped(
  cursor: Cursor,
  text: string,
  opts: { font: PDFFont; size: number; indent?: number },
): void {
  const indent = opts.indent ?? 0;
  const lines = wrapText(text, opts.font, opts.size, CONTENT_WIDTH - indent);
  for (const line of lines) {
    drawLine(cursor, line, { font: opts.font, size: opts.size, indent });
  }
}

function drawHeading(cursor: Cursor, text: string): void {
  ensureSpace(cursor, 2, HEADING_SIZE);
  cursor.y -= HEADING_SIZE * HEADING_LEAD;
  cursor.page.drawText(text, {
    x: MARGIN,
    y: cursor.y,
    size: HEADING_SIZE,
    font: cursor.bold,
    color: rgb(0, 0, 0),
  });
  cursor.y -= HEADING_RULE_GAP;
  cursor.page.drawLine({
    start: { x: MARGIN, y: cursor.y },
    end: { x: MARGIN + CONTENT_WIDTH, y: cursor.y },
    thickness: 0.5,
    color: rgb(0, 0, 0),
  });
}

function renderHeader(cursor: Cursor, profile: ExtractedProfile): void {
  ensureSpace(cursor, 1, NAME_SIZE);
  cursor.y -= NAME_SIZE * LINE_HEIGHT;
  cursor.page.drawText(profile.name, {
    x: MARGIN,
    y: cursor.y,
    size: NAME_SIZE,
    font: cursor.bold,
    color: rgb(0, 0, 0),
  });

  const titleParts: string[] = [];
  if (profile.current_title) titleParts.push(profile.current_title);
  if (profile.current_company) titleParts.push(profile.current_company);
  if (titleParts.length > 0) {
    drawLine(cursor, titleParts.join(' - '), {
      font: cursor.font,
      size: BODY_SIZE,
    });
  }

  const contactParts: string[] = [];
  if (profile.location) contactParts.push(profile.location);
  if (profile.email) contactParts.push(profile.email);
  if (profile.phone) contactParts.push(profile.phone);
  if (contactParts.length > 0) {
    drawLine(cursor, contactParts.join(' | '), {
      font: cursor.font,
      size: BODY_SIZE,
    });
  }
}

function renderExperience(cursor: Cursor, item: ExperienceItem): void {
  const heading = item.location
    ? `${item.title} - ${item.company} (${item.location})`
    : `${item.title} - ${item.company}`;
  drawWrapped(cursor, heading, { font: cursor.bold, size: BODY_SIZE });

  const dateParts: string[] = [];
  if (item.start_date) dateParts.push(item.start_date);
  if (item.end_date) dateParts.push(item.end_date);
  if (dateParts.length > 0) {
    drawLine(cursor, dateParts.join(' - '), {
      font: cursor.font,
      size: BODY_SIZE,
    });
  }

  for (const bullet of item.bullets) {
    drawWrapped(cursor, `* ${bullet}`, {
      font: cursor.font,
      size: BODY_SIZE,
      indent: 12,
    });
  }
  cursor.y -= BLOCK_GAP;
}

function renderEducation(cursor: Cursor, item: EducationItem): void {
  drawLine(cursor, item.institution, {
    font: cursor.bold,
    size: BODY_SIZE,
  });
  const detailParts: string[] = [];
  if (item.degree) detailParts.push(item.degree);
  if (item.field) detailParts.push(item.field);
  if (item.location) detailParts.push(item.location);
  if (detailParts.length > 0) {
    drawWrapped(cursor, detailParts.join(', '), {
      font: cursor.font,
      size: BODY_SIZE,
    });
  }
  const dateParts: string[] = [];
  if (item.start_date) dateParts.push(item.start_date);
  if (item.end_date) dateParts.push(item.end_date);
  if (dateParts.length > 0) {
    drawLine(cursor, dateParts.join(' - '), {
      font: cursor.font,
      size: BODY_SIZE,
    });
  }
  cursor.y -= BLOCK_GAP;
}

function renderList(cursor: Cursor, heading: string, items: string[]): void {
  drawHeading(cursor, heading);
  drawWrapped(cursor, items.join(', '), {
    font: cursor.font,
    size: BODY_SIZE,
  });
}

export type RenderPdfResult = {
  bytes: Uint8Array;
  filename: string;
};

export type RenderPdfOptions = {
  now?: Date;
};

export async function renderPdf(
  profile: ExtractedProfile,
  options: RenderPdfOptions = {},
): Promise<RenderPdfResult> {
  const now = options.now ?? new Date();
  const pdf = await PDFDocument.create();
  pdf.setCreationDate(now);
  pdf.setModificationDate(now);

  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const page = pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  const cursor: Cursor = {
    pdf,
    page,
    y: PAGE_HEIGHT - MARGIN,
    font,
    bold,
  };

  renderHeader(cursor, profile);

  if (profile.summary) {
    drawHeading(cursor, 'Summary');
    drawWrapped(cursor, profile.summary, {
      font: cursor.font,
      size: BODY_SIZE,
    });
  }

  if (profile.experiences.length > 0) {
    drawHeading(cursor, 'Experience');
    for (const item of profile.experiences) renderExperience(cursor, item);
  }

  if (profile.educations.length > 0) {
    drawHeading(cursor, 'Education');
    for (const item of profile.educations) renderEducation(cursor, item);
  }

  if (profile.skills.length > 0) renderList(cursor, 'Skills', profile.skills);
  if (profile.certifications.length > 0) {
    renderList(cursor, 'Certifications', profile.certifications);
  }
  if (profile.languages.length > 0) {
    renderList(cursor, 'Languages', profile.languages);
  }

  const bytes = await pdf.save();
  const filename = formatFilename(profile.name, now, 'pdf');
  return { bytes, filename };
}

