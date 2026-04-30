// Output dispatcher: maps the BYOK settings selector
// (OutputFormat: 'pdf' | 'docx' | 'both') to the renderer(s) that
// should run on capture. Single source of truth for "which file types
// the user gets". Consumed by the end-to-end capture flow (US-011).

import type { OutputFormat } from '@/lib/storage/byok-store';

import type { ExtractedProfile } from '@/lib/schema/profile';

import { renderDocx } from './docx';
import { renderPdf } from './pdf';

export type RenderedFile = {
  bytes: Uint8Array;
  filename: string;
  mimeType: 'application/pdf' | 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
};

export type RenderForOutputOptions = {
  now?: Date;
};

export async function renderForOutput(
  profile: ExtractedProfile,
  output: OutputFormat,
  options: RenderForOutputOptions = {},
): Promise<RenderedFile[]> {
  const opts = options.now ? { now: options.now } : {};
  const files: RenderedFile[] = [];
  if (output === 'pdf' || output === 'both') {
    const pdf = await renderPdf(profile, opts);
    files.push({
      bytes: pdf.bytes,
      filename: pdf.filename,
      mimeType: 'application/pdf',
    });
  }
  if (output === 'docx' || output === 'both') {
    const docx = await renderDocx(profile, opts);
    files.push({
      bytes: docx.bytes,
      filename: docx.filename,
      mimeType:
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    });
  }
  return files;
}
