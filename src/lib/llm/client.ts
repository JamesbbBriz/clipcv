// Vision LLM client. Single entry point for the extension's BYOK calls.
// Provider quirks live in adapters.ts; this module owns timeout, retry
// (one retry on 5xx, no retry on 4xx — see CLAUDE.md §6.2 acceptance), the
// OpenAI-compatible response shape extraction, and typed-error mapping.
//
// Returns the raw assistant content string. JSON parsing + zod validation
// happen downstream in US-008.

import type { Provider } from '@/lib/storage/byok-store';
import { scrubSecrets } from '@/lib/util/scrub-secrets';
import { ADAPTERS, type AdapterRequest } from './adapters';
import {
  AuthError,
  BadRequestError,
  LlmError,
  RateLimitedError,
  TimeoutError,
  UnknownLlmError,
} from './errors';

const DEFAULT_TIMEOUT_MS = 30_000;
const DETAIL_MAX_CHARS = 500;

export interface CallVisionLLMInput {
  provider: Provider;
  baseUrl: string;
  apiKey: string;
  model: string;
  screenshot_b64: string;
  html: string;
  prompt: string;
  /** Override the 30s default. */
  timeoutMs?: number;
  /** Test-only injectable fetch implementation. */
  fetchImpl?: typeof fetch;
}

export async function callVisionLLM(input: CallVisionLLMInput): Promise<string> {
  const adapter = ADAPTERS[input.provider];
  const request = adapter({
    baseUrl: input.baseUrl,
    apiKey: input.apiKey,
    model: input.model,
    screenshot_b64: input.screenshot_b64,
    html: input.html,
    prompt: input.prompt,
  });
  const fetchImpl = input.fetchImpl ?? fetch;
  const timeoutMs = input.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  let result = await singleAttempt(request, fetchImpl, timeoutMs);
  if (result.ok) return result.content;
  if (result.retryable) {
    result = await singleAttempt(request, fetchImpl, timeoutMs);
    if (result.ok) return result.content;
  }
  throw result.error;
}

interface AttemptOk {
  ok: true;
  content: string;
}

interface AttemptFail {
  ok: false;
  error: LlmError;
  retryable: boolean;
}

type AttemptResult = AttemptOk | AttemptFail;

async function singleAttempt(
  request: AdapterRequest,
  fetchImpl: typeof fetch,
  timeoutMs: number,
): Promise<AttemptResult> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetchImpl(request.url, {
      method: 'POST',
      headers: request.headers,
      body: request.body,
      signal: ctrl.signal,
    });
    if (res.ok) {
      return { ok: true, content: await extractContent(res) };
    }
    const detail = scrubSecrets(await safeText(res)).slice(0, DETAIL_MAX_CHARS);
    return {
      ok: false,
      error: mapStatus(res.status, detail),
      retryable: res.status >= 500 && res.status < 600,
    };
  } catch (err) {
    if (isAbortError(err)) {
      return {
        ok: false,
        error: new TimeoutError('Request timed out.'),
        retryable: false,
      };
    }
    if (err instanceof LlmError) {
      return { ok: false, error: err, retryable: false };
    }
    return {
      ok: false,
      error: new UnknownLlmError(scrubSecrets(toMessage(err))),
      retryable: false,
    };
  } finally {
    clearTimeout(timer);
  }
}

async function extractContent(res: Response): Promise<string> {
  let json: unknown;
  try {
    json = await res.json();
  } catch (err) {
    throw new UnknownLlmError(`malformed_json: ${toMessage(err)}`);
  }
  const content = (json as {
    choices?: Array<{ message?: { content?: unknown } }>;
  }).choices?.[0]?.message?.content;
  if (typeof content !== 'string') {
    throw new UnknownLlmError(
      'malformed_response: missing choices[0].message.content',
    );
  }
  return content;
}

function mapStatus(status: number, detail: string): LlmError {
  if (status === 401 || status === 403) {
    return new AuthError(`auth_failed_${status}: ${detail}`);
  }
  if (status === 429) {
    return new RateLimitedError(`rate_limited: ${detail}`);
  }
  if (status >= 400 && status < 500) {
    return new BadRequestError(`bad_request_${status}: ${detail}`);
  }
  return new UnknownLlmError(`http_${status}: ${detail}`);
}

async function safeText(res: Response): Promise<string> {
  try {
    return await res.text();
  } catch {
    return `${res.status} ${res.statusText}`;
  }
}

function isAbortError(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    (err as { name?: unknown }).name === 'AbortError'
  );
}

function toMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === 'string') return err;
  return 'Unknown error.';
}
