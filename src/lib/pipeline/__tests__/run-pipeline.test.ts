import { describe, it, expect, vi } from 'vitest';
import type { CapturePayload } from '@/lib/capture/payload';
import {
  ExtractError,
  type ExtractProfileInput,
} from '@/lib/extract/vision-extract';
import type { RenderedFile } from '@/lib/render/dispatch';
import type { ExtractedProfile } from '@/lib/schema/profile';
import type { LoadedByok } from '@/lib/storage/byok-store';
import {
  PipelineError,
  runPipeline,
  type PipelineStage,
} from '../run-pipeline';
import { pipelineUserMessage } from '../user-messages';

const PAYLOAD: CapturePayload = {
  screenshot_b64: 'data:image/png;base64,AAAA',
  html: '<html></html>',
  page_url: 'https://example.com/people/jane',
  page_title: 'Jane Doe',
  captured_at: '2026-04-30T00:00:00.000Z',
};

const BYOK: LoadedByok = {
  settings: {
    provider: 'openai',
    baseUrl: 'https://api.openai.com/v1',
    model: 'gpt-test',
    output: 'pdf',
  },
  apiKey: 'sk-fake-key',
};

const PROFILE: ExtractedProfile = {
  name: 'Jane Doe',
  experiences: [],
  educations: [],
  skills: [],
  certifications: [],
  languages: [],
};

function pdfFile(name = 'Doe_Jane_20260430.pdf'): RenderedFile {
  return {
    bytes: new Uint8Array([0x25, 0x50, 0x44, 0x46]),
    filename: name,
    mimeType: 'application/pdf',
  };
}
function docxFile(name = 'Doe_Jane_20260430.docx'): RenderedFile {
  return {
    bytes: new Uint8Array([0x50, 0x4b, 0x03, 0x04]),
    filename: name,
    mimeType:
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  };
}

describe('runPipeline', () => {
  it('happy path emits stages in order and downloads the rendered file', async () => {
    const stages: PipelineStage[] = [];
    const downloadImpl = vi.fn(async (_file: RenderedFile) => {});
    const result = await runPipeline({
      payload: PAYLOAD,
      onStage: (s) => stages.push(s),
      loadByokImpl: async () => BYOK,
      extractImpl: async () => PROFILE,
      renderImpl: async () => [pdfFile()],
      downloadImpl,
    });
    expect(stages).toEqual(['extracting', 'rendering', 'downloading', 'done']);
    expect(downloadImpl).toHaveBeenCalledTimes(1);
    expect(downloadImpl.mock.calls[0]?.[0]?.filename).toBe(
      'Doe_Jane_20260430.pdf',
    );
    expect(result.filenames).toEqual(['Doe_Jane_20260430.pdf']);
  });

  it('emits two downloads when output is both', async () => {
    const downloadImpl = vi.fn(async () => {});
    const result = await runPipeline({
      payload: PAYLOAD,
      loadByokImpl: async () => ({
        ...BYOK,
        settings: { ...BYOK.settings, output: 'both' },
      }),
      extractImpl: async () => PROFILE,
      renderImpl: async () => [pdfFile(), docxFile()],
      downloadImpl,
    });
    expect(downloadImpl).toHaveBeenCalledTimes(2);
    expect(result.filenames).toEqual([
      'Doe_Jane_20260430.pdf',
      'Doe_Jane_20260430.docx',
    ]);
  });

  it('throws SETTINGS_MISSING when BYOK is not configured', async () => {
    const downloadImpl = vi.fn(async () => {});
    await expect(
      runPipeline({
        payload: PAYLOAD,
        loadByokImpl: async () => null,
        extractImpl: vi.fn(),
        renderImpl: vi.fn(),
        downloadImpl,
      }),
    ).rejects.toMatchObject({
      name: 'PipelineError',
      code: 'SETTINGS_MISSING',
    });
    expect(downloadImpl).not.toHaveBeenCalled();
  });

  it.each([
    ['AUTH', 'AUTH'],
    ['TIMEOUT', 'TIMEOUT'],
    ['NO_PROFILE_DETECTED', 'NO_PROFILE_DETECTED'],
    ['SCHEMA_MISMATCH', 'SCHEMA_MISMATCH'],
    ['UNKNOWN_LLM', 'UNKNOWN_LLM'],
  ] as const)('maps ExtractError(%s) to PipelineError(%s)', async (input, expected) => {
    await expect(
      runPipeline({
        payload: PAYLOAD,
        loadByokImpl: async () => BYOK,
        extractImpl: async () => {
          throw new ExtractError(input, 'extract failed');
        },
        renderImpl: vi.fn(),
        downloadImpl: vi.fn(),
      }),
    ).rejects.toMatchObject({ code: expected });
  });

  it('non-ExtractError from extract maps to UNKNOWN_LLM with scrubbed message', async () => {
    let captured: PipelineError | undefined;
    try {
      await runPipeline({
        payload: PAYLOAD,
        loadByokImpl: async () => BYOK,
        extractImpl: async () => {
          throw new Error('boom sk-1234567890ABCDEFGH happened');
        },
        renderImpl: vi.fn(),
        downloadImpl: vi.fn(),
      });
    } catch (err) {
      captured = err as PipelineError;
    }
    expect(captured?.code).toBe('UNKNOWN_LLM');
    expect(captured?.message).not.toMatch(/sk-1234567890ABCDEFGH/);
    expect(captured?.message).toMatch(/\[redacted\]/);
  });

  it('render failure surfaces RENDER_FAILED', async () => {
    await expect(
      runPipeline({
        payload: PAYLOAD,
        loadByokImpl: async () => BYOK,
        extractImpl: async () => PROFILE,
        renderImpl: async () => {
          throw new Error('render kaboom');
        },
        downloadImpl: vi.fn(),
      }),
    ).rejects.toMatchObject({ code: 'RENDER_FAILED' });
  });

  it('download failure surfaces DOWNLOAD_FAILED with scrubbed message', async () => {
    let captured: PipelineError | undefined;
    try {
      await runPipeline({
        payload: PAYLOAD,
        loadByokImpl: async () => BYOK,
        extractImpl: async () => PROFILE,
        renderImpl: async () => [pdfFile()],
        downloadImpl: async () => {
          throw new Error('disk full Bearer abcdefghijklmnopqrstuvwxyz');
        },
      });
    } catch (err) {
      captured = err as PipelineError;
    }
    expect(captured?.code).toBe('DOWNLOAD_FAILED');
    expect(captured?.message).not.toMatch(/Bearer abcdefghijklmnopqrstuvwxyz/);
    expect(captured?.message).toMatch(/\[redacted\]/);
  });

  it('pre-aborted signal short-circuits before extract', async () => {
    const ctrl = new AbortController();
    ctrl.abort();
    const extractImpl = vi.fn();
    await expect(
      runPipeline({
        payload: PAYLOAD,
        signal: ctrl.signal,
        loadByokImpl: async () => BYOK,
        extractImpl,
        renderImpl: vi.fn(),
        downloadImpl: vi.fn(),
      }),
    ).rejects.toMatchObject({ code: 'CANCELLED' });
    expect(extractImpl).not.toHaveBeenCalled();
  });

  it('signal aborted mid-extract surfaces CANCELLED rather than the underlying error', async () => {
    const ctrl = new AbortController();
    const extractImpl = vi.fn(async (_input: ExtractProfileInput) => {
      ctrl.abort();
      // Simulate the abort propagating into the LLM client and surfacing as
      // an arbitrary error — the orchestrator must treat aborted-signal as
      // CANCELLED regardless of the underlying error type.
      throw new Error('aborted');
    });
    await expect(
      runPipeline({
        payload: PAYLOAD,
        signal: ctrl.signal,
        loadByokImpl: async () => BYOK,
        extractImpl,
        renderImpl: vi.fn(),
        downloadImpl: vi.fn(),
      }),
    ).rejects.toMatchObject({ code: 'CANCELLED' });
  });

  it('signal aborted between extract and render surfaces CANCELLED', async () => {
    const ctrl = new AbortController();
    const renderImpl = vi.fn();
    await expect(
      runPipeline({
        payload: PAYLOAD,
        signal: ctrl.signal,
        loadByokImpl: async () => BYOK,
        extractImpl: async () => {
          ctrl.abort();
          return PROFILE;
        },
        renderImpl,
        downloadImpl: vi.fn(),
      }),
    ).rejects.toMatchObject({ code: 'CANCELLED' });
    expect(renderImpl).not.toHaveBeenCalled();
  });

  it('forwards options.now and fetchImpl into extract', async () => {
    const fetchSpy = vi.fn();
    const extractImpl = vi.fn(async (input: ExtractProfileInput) => {
      expect(input.fetchImpl).toBe(fetchSpy);
      return PROFILE;
    });
    const renderImpl = vi.fn(async (_p, _o, opts) => {
      expect(opts).toEqual({ now: new Date('2026-04-30T12:00:00Z') });
      return [pdfFile()];
    });
    await runPipeline({
      payload: PAYLOAD,
      now: new Date('2026-04-30T12:00:00Z'),
      fetchImpl: fetchSpy as unknown as typeof fetch,
      loadByokImpl: async () => BYOK,
      extractImpl,
      renderImpl,
      downloadImpl: async () => {},
    });
    expect(extractImpl).toHaveBeenCalledTimes(1);
    expect(renderImpl).toHaveBeenCalledTimes(1);
  });
});

describe('pipelineUserMessage', () => {
  it('returns a non-empty string for every code without naming any destination service', () => {
    const codes = [
      'SETTINGS_MISSING',
      'AUTH',
      'TIMEOUT',
      'NO_PROFILE_DETECTED',
      'SCHEMA_MISMATCH',
      'UNKNOWN_LLM',
      'RENDER_FAILED',
      'DOWNLOAD_FAILED',
      'CANCELLED',
    ] as const;
    for (const code of codes) {
      const msg = pipelineUserMessage(code);
      expect(msg.length).toBeGreaterThan(0);
      expect(msg).not.toMatch(
        /\b(ats|crm|recruiter|recruiting|workflow|optitalent|linkedin|indeed|naukri)\b/i,
      );
    }
  });
});
