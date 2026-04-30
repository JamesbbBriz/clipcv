// End-to-end capture-to-download orchestrator. Called from the floating
// button click. Stages: capturing (handled by the caller) → extracting →
// rendering → downloading. Cancellable via AbortSignal at every stage
// boundary; the in-flight LLM fetch is aborted mid-stream when the signal
// is aborted (the ExtractError thrown by the abort path is mapped to
// CANCELLED here).

import type { CapturePayload } from '@/lib/capture/payload';
import {
  ExtractError,
  extractProfile,
  type ExtractProfileInput,
} from '@/lib/extract/vision-extract';
import { renderForOutput, type RenderedFile } from '@/lib/render/dispatch';
import type { ExtractedProfile } from '@/lib/schema/profile';
import { loadByok, type LoadedByok } from '@/lib/storage/byok-store';
import { scrubSecrets } from '@/lib/util/scrub-secrets';

export type PipelineStage =
  | 'extracting'
  | 'rendering'
  | 'downloading'
  | 'done';

export type PipelineErrorCode =
  | 'SETTINGS_MISSING'
  | 'AUTH'
  | 'TIMEOUT'
  | 'NO_PROFILE_DETECTED'
  | 'SCHEMA_MISMATCH'
  | 'UNKNOWN_LLM'
  | 'RENDER_FAILED'
  | 'DOWNLOAD_FAILED'
  | 'CANCELLED';

export class PipelineError extends Error {
  readonly code: PipelineErrorCode;
  constructor(code: PipelineErrorCode, message: string) {
    super(message);
    this.name = 'PipelineError';
    this.code = code;
  }
}

export interface RunPipelineInput {
  payload: CapturePayload;
  signal?: AbortSignal;
  onStage?: (stage: PipelineStage) => void;
  now?: Date;
  loadByokImpl?: () => Promise<LoadedByok | null>;
  extractImpl?: (input: ExtractProfileInput) => Promise<ExtractedProfile>;
  renderImpl?: typeof renderForOutput;
  downloadImpl?: (file: RenderedFile) => Promise<void>;
  fetchImpl?: typeof fetch;
}

export interface PipelineResult {
  filenames: string[];
}

export async function runPipeline(
  input: RunPipelineInput,
): Promise<PipelineResult> {
  const loadByokImpl = input.loadByokImpl ?? loadByok;
  const extractImpl = input.extractImpl ?? extractProfile;
  const renderImpl = input.renderImpl ?? renderForOutput;
  const downloadImpl = input.downloadImpl ?? downloadViaServiceWorker;

  ensureNotAborted(input.signal);

  input.onStage?.('extracting');
  const byok = await loadByokImpl();
  if (!byok) {
    throw new PipelineError(
      'SETTINGS_MISSING',
      'Configure your LLM provider in Settings before capturing.',
    );
  }

  ensureNotAborted(input.signal);

  let profile: ExtractedProfile;
  try {
    profile = await extractImpl({
      provider: byok.settings.provider,
      baseUrl: byok.settings.baseUrl,
      apiKey: byok.apiKey,
      model: byok.settings.model,
      screenshot_b64: input.payload.screenshot_b64,
      html: input.payload.html,
      ...(input.fetchImpl !== undefined ? { fetchImpl: input.fetchImpl } : {}),
    });
  } catch (err) {
    if (input.signal?.aborted) {
      throw new PipelineError('CANCELLED', 'Capture cancelled.');
    }
    throw mapExtractError(err);
  }

  ensureNotAborted(input.signal);

  input.onStage?.('rendering');
  let files: RenderedFile[];
  try {
    const opts = input.now ? { now: input.now } : {};
    files = await renderImpl(profile, byok.settings.output, opts);
  } catch (err) {
    throw new PipelineError('RENDER_FAILED', scrubSecrets(toMessage(err)));
  }

  ensureNotAborted(input.signal);

  input.onStage?.('downloading');
  for (const file of files) {
    ensureNotAborted(input.signal);
    try {
      await downloadImpl(file);
    } catch (err) {
      throw new PipelineError('DOWNLOAD_FAILED', scrubSecrets(toMessage(err)));
    }
  }

  input.onStage?.('done');
  return { filenames: files.map((f) => f.filename) };
}

function ensureNotAborted(signal?: AbortSignal): void {
  if (signal?.aborted) {
    throw new PipelineError('CANCELLED', 'Capture cancelled.');
  }
}

function mapExtractError(err: unknown): PipelineError {
  if (err instanceof ExtractError) {
    return new PipelineError(err.code, scrubSecrets(err.message));
  }
  return new PipelineError('UNKNOWN_LLM', scrubSecrets(toMessage(err)));
}

function toMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  return String(err);
}

// Default download path (content-script context): wrap the rendered bytes in
// a Blob URL and ask the service worker to call chrome.downloads.download.
// The blob URL is revoked after a short delay so the browser process has time
// to finish reading it (eager revoke aborts with NETWORK_FAILED).
async function downloadViaServiceWorker(file: RenderedFile): Promise<void> {
  // any-justified: SDK BufferSource union vs Uint8Array<ArrayBufferLike> mismatch
  // under exactOptionalPropertyTypes; the runtime accepts the typed array directly.
  const blob = new Blob([file.bytes as unknown as BlobPart], { type: file.mimeType });
  const url = URL.createObjectURL(blob);
  try {
    const response = (await chrome.runtime.sendMessage({
      kind: 'download-file',
      url,
      filename: file.filename,
    })) as { kind?: string; detail?: string } | undefined;
    if (response?.kind !== 'download-started') {
      throw new Error(`download_failed: ${response?.detail ?? 'unknown'}`);
    }
  } finally {
    setTimeout(() => URL.revokeObjectURL(url), 1_000);
  }
}
