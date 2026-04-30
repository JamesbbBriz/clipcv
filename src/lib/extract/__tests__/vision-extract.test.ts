import { describe, expect, it, vi } from 'vitest';

import type { CallVisionLLMInput } from '@/lib/llm/client';
import {
  AuthError,
  RateLimitedError,
  TimeoutError,
  UnknownLlmError,
} from '@/lib/llm/errors';

import { ExtractError, extractProfile } from '../vision-extract';

const baseInput = {
  provider: 'openai' as const,
  baseUrl: 'https://api.example.com/v1',
  apiKey: 'sk-fake-key-for-tests',
  model: 'gpt-4o',
  screenshot_b64: 'data:image/png;base64,AAAA',
  html: '<p>hello</p>',
};

const goldenProfile = {
  name: 'Jane Doe',
  email: 'jane@example.com',
  current_title: 'Senior Engineer',
  current_company: 'Acme Corp',
  location: 'Sydney, AU',
  summary: 'Backend engineer with 10 years experience.',
  experiences: [
    {
      company: 'Acme Corp',
      title: 'Senior Engineer',
      start_date: 'Jan 2022',
      end_date: 'Present',
      bullets: ['Led platform migration.', 'Mentored 3 juniors.'],
    },
  ],
  educations: [
    {
      institution: 'University of Example',
      degree: 'BSc',
      field: 'Computer Science',
    },
  ],
  skills: ['TypeScript', 'Go'],
  certifications: ['AWS Solutions Architect'],
  languages: ['English'],
};

type CallImpl = (input: CallVisionLLMInput) => Promise<string>;

describe('extractProfile', () => {
  it('parses a well-formed JSON response on the first attempt', async () => {
    const callImpl = vi.fn(
      async () => JSON.stringify(goldenProfile),
    ) as unknown as CallImpl;
    const out = await extractProfile({ ...baseInput, callImpl });
    expect(out.name).toBe('Jane Doe');
    expect(out.experiences).toHaveLength(1);
    expect(out.experiences[0]?.bullets).toEqual([
      'Led platform migration.',
      'Mentored 3 juniors.',
    ]);
    expect(out.skills).toContain('TypeScript');
    expect(callImpl).toHaveBeenCalledTimes(1);
  });

  it('strips ```json code fences before parsing', async () => {
    const callImpl = vi.fn(
      async () => '```json\n' + JSON.stringify(goldenProfile) + '\n```',
    ) as unknown as CallImpl;
    const out = await extractProfile({ ...baseInput, callImpl });
    expect(out.name).toBe('Jane Doe');
    expect(callImpl).toHaveBeenCalledTimes(1);
  });

  it('extracts an embedded JSON object when the model adds prose', async () => {
    const callImpl = vi.fn(
      async () =>
        `Here is the profile data:\n\n${JSON.stringify(goldenProfile)}\n\nLet me know if you need anything else.`,
    ) as unknown as CallImpl;
    const out = await extractProfile({ ...baseInput, callImpl });
    expect(out.name).toBe('Jane Doe');
  });

  it('throws ExtractError(NO_PROFILE_DETECTED) on the sentinel response', async () => {
    const callImpl = vi.fn(
      async () => JSON.stringify({ _no_profile: true }),
    ) as unknown as CallImpl;
    await expect(extractProfile({ ...baseInput, callImpl })).rejects.toMatchObject(
      { name: 'ExtractError', code: 'NO_PROFILE_DETECTED' },
    );
    expect(callImpl).toHaveBeenCalledTimes(1);
  });

  it('retries once with a stricter prompt and recovers from non-JSON output', async () => {
    const prompts: string[] = [];
    let i = 0;
    const callImpl = vi.fn(async (req: CallVisionLLMInput) => {
      prompts.push(req.prompt);
      i += 1;
      if (i === 1) return 'Sure, here is the profile in plain English: ...';
      return JSON.stringify(goldenProfile);
    }) as unknown as CallImpl;
    const out = await extractProfile({ ...baseInput, callImpl });
    expect(out.name).toBe('Jane Doe');
    expect(callImpl).toHaveBeenCalledTimes(2);
    expect(prompts).toHaveLength(2);
    expect(prompts[1]).not.toBe(prompts[0]);
    expect(prompts[1]).toMatch(/strict/i);
  });

  it('throws ExtractError(SCHEMA_MISMATCH) after two parse failures', async () => {
    const callImpl = vi.fn(
      async () => JSON.stringify({ name: '', experiences: [] }),
    ) as unknown as CallImpl;
    await expect(extractProfile({ ...baseInput, callImpl })).rejects.toMatchObject(
      { name: 'ExtractError', code: 'SCHEMA_MISMATCH' },
    );
    expect(callImpl).toHaveBeenCalledTimes(2);
  });

  it('throws SCHEMA_MISMATCH when the response is missing the required name field', async () => {
    const callImpl = vi.fn(
      async () => JSON.stringify({ experiences: [], skills: ['TypeScript'] }),
    ) as unknown as CallImpl;
    const err = await extractProfile({ ...baseInput, callImpl }).catch((e) => e);
    expect(err).toBeInstanceOf(ExtractError);
    expect((err as ExtractError).code).toBe('SCHEMA_MISMATCH');
    expect(callImpl).toHaveBeenCalledTimes(2);
  });

  it('rejects unknown top-level keys (strict schema)', async () => {
    const tampered = { ...goldenProfile, _smuggled: 'oops' };
    const callImpl = vi.fn(
      async () => JSON.stringify(tampered),
    ) as unknown as CallImpl;
    await expect(extractProfile({ ...baseInput, callImpl })).rejects.toMatchObject(
      { name: 'ExtractError', code: 'SCHEMA_MISMATCH' },
    );
    expect(callImpl).toHaveBeenCalledTimes(2);
  });

  it('maps AuthError → ExtractError(AUTH)', async () => {
    const callImpl = vi.fn(async () => {
      throw new AuthError('auth_failed_401: nope');
    }) as unknown as CallImpl;
    await expect(extractProfile({ ...baseInput, callImpl })).rejects.toMatchObject(
      { name: 'ExtractError', code: 'AUTH' },
    );
    expect(callImpl).toHaveBeenCalledTimes(1);
  });

  it('maps TimeoutError → ExtractError(TIMEOUT)', async () => {
    const callImpl = vi.fn(async () => {
      throw new TimeoutError('Request timed out.');
    }) as unknown as CallImpl;
    await expect(extractProfile({ ...baseInput, callImpl })).rejects.toMatchObject(
      { name: 'ExtractError', code: 'TIMEOUT' },
    );
  });

  it('maps RateLimitedError → ExtractError(UNKNOWN_LLM)', async () => {
    const callImpl = vi.fn(async () => {
      throw new RateLimitedError('rate_limited: slow down');
    }) as unknown as CallImpl;
    await expect(extractProfile({ ...baseInput, callImpl })).rejects.toMatchObject(
      { name: 'ExtractError', code: 'UNKNOWN_LLM' },
    );
  });

  it('maps UnknownLlmError → ExtractError(UNKNOWN_LLM)', async () => {
    const callImpl = vi.fn(async () => {
      throw new UnknownLlmError('weirdness');
    }) as unknown as CallImpl;
    await expect(extractProfile({ ...baseInput, callImpl })).rejects.toMatchObject(
      { name: 'ExtractError', code: 'UNKNOWN_LLM' },
    );
  });

  it('passes responseFormatJson=true and the BYOK creds through to the caller', async () => {
    let captured: CallVisionLLMInput | undefined;
    const callImpl = vi.fn(async (req: CallVisionLLMInput) => {
      captured = req;
      return JSON.stringify(goldenProfile);
    }) as unknown as CallImpl;
    await extractProfile({ ...baseInput, callImpl, timeoutMs: 12_000 });
    expect(captured?.responseFormatJson).toBe(true);
    expect(captured?.provider).toBe('openai');
    expect(captured?.apiKey).toBe('sk-fake-key-for-tests');
    expect(captured?.model).toBe('gpt-4o');
    expect(captured?.timeoutMs).toBe(12_000);
  });

  it('base prompt instructs the model to ignore navigation/ads/footer/sidebar', async () => {
    let captured: string | undefined;
    const callImpl = vi.fn(async (req: CallVisionLLMInput) => {
      captured = req.prompt;
      return JSON.stringify(goldenProfile);
    }) as unknown as CallImpl;
    await extractProfile({ ...baseInput, callImpl });
    expect(captured).toBeDefined();
    expect(captured).toMatch(/navigation/i);
    expect(captured).toMatch(/ads?/i);
    expect(captured).toMatch(/footer/i);
    expect(captured).toMatch(/sidebar/i);
    // Schema text is included in the prompt so providers that ignore the
    // response_format API field still receive the contract.
    expect(captured).toMatch(/experiences/);
    expect(captured).toMatch(/educations/);
    expect(captured).toMatch(/_no_profile/);
  });
});
