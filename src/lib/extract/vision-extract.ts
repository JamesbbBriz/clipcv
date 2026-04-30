// Vision extraction pipeline. Given the screenshot + visible HTML payload
// captured by US-005, ask the BYOK Vision LLM to emit a JSON object that
// matches ExtractedProfileSchema (US-007), validate the response, and either
// return the parsed profile or throw a typed ExtractError.
//
// Two-attempt policy:
//  1) Base prompt: instructions + schema text + JSON-only output rule. Asks
//     the OpenAI-compatible API for response_format: {type: 'json_object'}.
//  2) On parse failure (non-JSON content OR zod schema mismatch), retry once
//     with a stricter prompt that re-includes the schema and emphasises the
//     "no prose, JSON object only" requirement.
//
// The model can also signal "no profile on this page" by returning the
// sentinel `{"_no_profile": true}`. That short-circuits to
// ExtractError('NO_PROFILE_DETECTED', ...).
//
// LLM-transport errors (AuthError / TimeoutError / RateLimitedError /
// BadRequestError / UnknownLlmError from llm/client.ts) are mapped to:
//   AuthError    → ExtractError('AUTH', ...)
//   TimeoutError → ExtractError('TIMEOUT', ...)
//   anything else (incl. RateLimited / BadRequest) → ExtractError('UNKNOWN_LLM', ...)

import { callVisionLLM, type CallVisionLLMInput } from '@/lib/llm/client';
import { AuthError, TimeoutError } from '@/lib/llm/errors';
import {
  ExtractedProfileSchema,
  type ExtractedProfile,
} from '@/lib/schema/profile';

export type ExtractErrorCode =
  | 'AUTH'
  | 'TIMEOUT'
  | 'NO_PROFILE_DETECTED'
  | 'SCHEMA_MISMATCH'
  | 'UNKNOWN_LLM';

export class ExtractError extends Error {
  readonly code: ExtractErrorCode;
  constructor(code: ExtractErrorCode, message: string) {
    super(message);
    this.name = 'ExtractError';
    this.code = code;
  }
}

export interface ExtractProfileInput {
  provider: CallVisionLLMInput['provider'];
  baseUrl: string;
  apiKey: string;
  model: string;
  screenshot_b64: string;
  html: string;
  /** Override default 30s LLM timeout. */
  timeoutMs?: number;
  /** Test-only injectable LLM caller. Defaults to callVisionLLM. */
  callImpl?: (input: CallVisionLLMInput) => Promise<string>;
  /** Test-only injectable fetch (passed through to the default caller). */
  fetchImpl?: typeof fetch;
}

const NO_PROFILE_SENTINEL_KEY = '_no_profile';

const SCHEMA_TEXT = `JSON schema (object keys; emit ONLY this shape, nothing else):
{
  "name": string (required, non-empty),
  "email": string (optional),
  "phone": string (optional),
  "current_title": string (optional),
  "current_company": string (optional),
  "location": string (optional),
  "summary": string (optional),
  "experiences": [
    { "company": string, "title": string,
      "start_date": string?, "end_date": string?, "location": string?,
      "bullets": string[] }
  ],
  "educations": [
    { "institution": string,
      "degree": string?, "field": string?,
      "start_date": string?, "end_date": string?, "location": string? }
  ],
  "skills": string[],
  "certifications": string[],
  "languages": string[]
}
Rules:
- Date fields are free-form strings — copy what the page shows; do NOT normalize.
- Omit unknown optional fields rather than emitting null or "".
- Reject empty arrays only if the section is genuinely absent on the page.
- Do NOT add keys that are not listed above; unknown top-level keys are rejected.
- If the page is NOT a person profile (e.g. a search results page, a settings panel,
  an article without an author block), respond with EXACTLY {"${NO_PROFILE_SENTINEL_KEY}": true}.`;

const BASE_PROMPT = `You are extracting a single person's profile from a web page.
Use the screenshot as the primary source of truth and the HTML excerpt as a
supplementary aid for text the screenshot may have rasterised. IGNORE navigation
bars, ads, footer, sidebars, related-content widgets, comments, and any
secondary people referenced on the page (e.g. "people also viewed",
colleague lists, embedded contact-form fields for unrelated parties).
Output ONLY the primary subject's structured data as a JSON object matching
the schema below. Do not include prose, markdown, code fences, or trailing
commentary.

${SCHEMA_TEXT}`;

const STRICT_PROMPT = `Your previous response could not be parsed. Re-emit the
profile as a strict JSON OBJECT — no markdown, no code fences, no prose, no
trailing comma. The very first character of your response must be "{" and the
very last character must be "}". Do not wrap in quotes. Do not add explanatory
text. The only key not in the schema below that is allowed is "${NO_PROFILE_SENTINEL_KEY}",
and only if the page is genuinely not a person profile.

${SCHEMA_TEXT}`;

export async function extractProfile(
  input: ExtractProfileInput,
): Promise<ExtractedProfile> {
  const callImpl = input.callImpl ?? callVisionLLM;
  let lastFailure = 'no attempts made';

  for (let attempt = 0; attempt < 2; attempt++) {
    const prompt = attempt === 0 ? BASE_PROMPT : STRICT_PROMPT;
    let content: string;
    try {
      content = await callImpl({
        provider: input.provider,
        baseUrl: input.baseUrl,
        apiKey: input.apiKey,
        model: input.model,
        screenshot_b64: input.screenshot_b64,
        html: input.html,
        prompt,
        responseFormatJson: true,
        ...(input.timeoutMs !== undefined ? { timeoutMs: input.timeoutMs } : {}),
        ...(input.fetchImpl !== undefined ? { fetchImpl: input.fetchImpl } : {}),
      });
    } catch (err) {
      throw mapLlmError(err);
    }

    const parsed = parseJsonLoose(content);
    if (parsed === undefined) {
      lastFailure = `non-JSON response (first 200 chars): ${content.slice(0, 200)}`;
      continue;
    }
    if (isNoProfileSentinel(parsed)) {
      throw new ExtractError(
        'NO_PROFILE_DETECTED',
        'Model reported no profile on this page.',
      );
    }
    const result = ExtractedProfileSchema.safeParse(parsed);
    if (result.success) {
      return result.data;
    }
    lastFailure = `schema_mismatch: ${summariseZodIssues(result.error.issues)}`;
  }

  throw new ExtractError('SCHEMA_MISMATCH', lastFailure);
}

function mapLlmError(err: unknown): ExtractError {
  if (err instanceof AuthError) {
    return new ExtractError('AUTH', err.message);
  }
  if (err instanceof TimeoutError) {
    return new ExtractError('TIMEOUT', err.message);
  }
  if (err instanceof Error) {
    return new ExtractError('UNKNOWN_LLM', err.message);
  }
  return new ExtractError('UNKNOWN_LLM', 'Unknown LLM error.');
}

function parseJsonLoose(content: string): unknown {
  const direct = tryJsonParse(content);
  if (direct !== undefined) return direct;

  const stripped = stripCodeFences(content);
  if (stripped !== content) {
    const fenced = tryJsonParse(stripped);
    if (fenced !== undefined) return fenced;
  }

  const block = extractJsonBlock(content);
  if (block !== undefined) {
    const blocky = tryJsonParse(block);
    if (blocky !== undefined) return blocky;
  }

  return undefined;
}

function tryJsonParse(s: string): unknown {
  try {
    return JSON.parse(s);
  } catch {
    return undefined;
  }
}

function stripCodeFences(s: string): string {
  return s
    .replace(/^\s*```(?:json)?\s*/i, '')
    .replace(/\s*```\s*$/i, '')
    .trim();
}

function extractJsonBlock(s: string): string | undefined {
  const start = s.indexOf('{');
  const end = s.lastIndexOf('}');
  if (start < 0 || end <= start) return undefined;
  return s.slice(start, end + 1);
}

function isNoProfileSentinel(parsed: unknown): boolean {
  return (
    typeof parsed === 'object' &&
    parsed !== null &&
    (parsed as Record<string, unknown>)[NO_PROFILE_SENTINEL_KEY] === true
  );
}

interface ZodIssueShape {
  readonly path?: ReadonlyArray<PropertyKey>;
  readonly message?: string;
  readonly code?: string;
}

function summariseZodIssues(issues: ReadonlyArray<ZodIssueShape>): string {
  return issues
    .slice(0, 5)
    .map((issue) => {
      const path = issue.path && issue.path.length > 0
        ? issue.path.map((p) => String(p)).join('.')
        : '(root)';
      const message = issue.message ?? issue.code ?? 'invalid';
      return `${path}: ${message}`;
    })
    .join('; ');
}
