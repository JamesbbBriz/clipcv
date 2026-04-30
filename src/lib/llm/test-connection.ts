// One-shot 1-token completion against an OpenAI-compatible /chat/completions
// endpoint to confirm the user's BYOK config works. The full Vision client
// lands in US-006 — this helper is intentionally narrow and reused only by the
// options page Test button.

import { scrubSecrets } from '@/lib/util/scrub-secrets';

export type TestErrorCode =
  | 'auth_failed'
  | 'timeout'
  | 'model_not_found'
  | 'bad_request'
  | 'rate_limited'
  | 'unknown';

export type TestResult =
  | { ok: true; latencyMs: number }
  | { ok: false; code: TestErrorCode; detail: string };

export interface TestConnectionInput {
  baseUrl: string;
  model: string;
  apiKey: string;
}

const TIMEOUT_MS = 15_000;
const DETAIL_MAX_CHARS = 500;

export async function testConnection(input: TestConnectionInput): Promise<TestResult> {
  const url = joinUrl(input.baseUrl, '/chat/completions');
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  const start = nowMs();
  try {
    const res = await fetch(url, {
      method: 'POST',
      signal: ctrl.signal,
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${input.apiKey}`,
      },
      body: JSON.stringify({
        model: input.model,
        max_tokens: 1,
        messages: [{ role: 'user', content: 'ping' }],
      }),
    });
    const latencyMs = Math.round(nowMs() - start);
    if (res.ok) return { ok: true, latencyMs };
    const rawDetail = await safeText(res);
    return {
      ok: false,
      code: mapStatus(res.status, rawDetail),
      detail: scrubSecrets(rawDetail).slice(0, DETAIL_MAX_CHARS),
    };
  } catch (err) {
    const e = err as { name?: string; message?: string };
    if (e.name === 'AbortError') {
      return { ok: false, code: 'timeout', detail: 'Request timed out.' };
    }
    return {
      ok: false,
      code: 'unknown',
      detail: scrubSecrets(e.message ?? 'Network error.'),
    };
  } finally {
    clearTimeout(timer);
  }
}

function mapStatus(status: number, body: string): TestErrorCode {
  if (status === 401 || status === 403) return 'auth_failed';
  if (status === 429) return 'rate_limited';
  if (status === 404) return 'model_not_found';
  if (status === 400 && /model/i.test(body)) return 'model_not_found';
  if (status === 400) return 'bad_request';
  return 'unknown';
}

function joinUrl(base: string, path: string): string {
  return `${base.replace(/\/+$/, '')}${path}`;
}

async function safeText(res: Response): Promise<string> {
  try {
    return await res.text();
  } catch {
    return `${res.status} ${res.statusText}`;
  }
}

function nowMs(): number {
  return typeof performance !== 'undefined' ? performance.now() : Date.now();
}
