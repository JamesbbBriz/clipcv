import { describe, expect, it, vi } from 'vitest';

import { callVisionLLM } from '../client';
import {
  AuthError,
  BadRequestError,
  RateLimitedError,
  TimeoutError,
  UnknownLlmError,
} from '../errors';

const baseInput = {
  provider: 'openai' as const,
  baseUrl: 'https://api.example.com/v1',
  apiKey: 'sk-fake-key-for-tests',
  model: 'gpt-4o',
  screenshot_b64: 'data:image/png;base64,AAAA',
  html: '<p>hello</p>',
  prompt: 'Extract.',
};

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

function okBody(content: string): unknown {
  return { choices: [{ message: { content } }] };
}

type FetchMock = ReturnType<typeof vi.fn> & typeof fetch;

function sequenceFetch(...responses: Response[]): FetchMock {
  let i = 0;
  return vi.fn(async () => {
    const next = responses[i++];
    if (!next) throw new Error(`fetch called ${i} times but only ${responses.length} responses queued`);
    return next;
  }) as FetchMock;
}

describe('callVisionLLM', () => {
  it('returns the raw assistant content on 200', async () => {
    const fetchImpl = sequenceFetch(jsonResponse(200, okBody('hello world')));
    const out = await callVisionLLM({ ...baseInput, fetchImpl });
    expect(out).toBe('hello world');
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('builds an OpenAI-compatible /chat/completions request with vision content', async () => {
    let captured: { url: string; init: RequestInit } | undefined;
    const fetchImpl = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      captured = { url: String(url), init: init ?? {} };
      return jsonResponse(200, okBody('ok'));
    }) as FetchMock;
    await callVisionLLM({ ...baseInput, fetchImpl });
    expect(captured?.url).toBe('https://api.example.com/v1/chat/completions');
    expect(captured?.init.method).toBe('POST');
    const headers = captured?.init.headers as Record<string, string>;
    expect(headers['authorization']).toBe(`Bearer ${baseInput.apiKey}`);
    expect(headers['content-type']).toBe('application/json');
    const body = JSON.parse(String(captured?.init.body));
    expect(body.model).toBe('gpt-4o');
    expect(body.messages).toHaveLength(1);
    expect(body.messages[0].role).toBe('user');
    const parts = body.messages[0].content as Array<{ type: string; text?: string; image_url?: { url: string } }>;
    const text = parts.find((p) => p.type === 'text');
    const image = parts.find((p) => p.type === 'image_url');
    expect(text?.text).toContain('Extract.');
    expect(text?.text).toContain('<p>hello</p>');
    expect(image?.image_url?.url).toMatch(/^data:image\/png;base64,/);
  });

  it('throws AuthError on 401 and does not retry', async () => {
    const fetchImpl = sequenceFetch(
      jsonResponse(401, { error: { message: 'invalid api key' } }),
    );
    await expect(callVisionLLM({ ...baseInput, fetchImpl })).rejects.toBeInstanceOf(AuthError);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('throws AuthError on 403 and does not retry', async () => {
    const fetchImpl = sequenceFetch(jsonResponse(403, { error: { message: 'forbidden' } }));
    await expect(callVisionLLM({ ...baseInput, fetchImpl })).rejects.toBeInstanceOf(AuthError);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('throws RateLimitedError on 429 and does not retry', async () => {
    const fetchImpl = sequenceFetch(
      jsonResponse(429, { error: { message: 'too many requests' } }),
    );
    await expect(callVisionLLM({ ...baseInput, fetchImpl })).rejects.toBeInstanceOf(
      RateLimitedError,
    );
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('throws BadRequestError on 400 and does not retry', async () => {
    const fetchImpl = sequenceFetch(
      jsonResponse(400, { error: { message: 'bad input shape' } }),
    );
    await expect(callVisionLLM({ ...baseInput, fetchImpl })).rejects.toBeInstanceOf(
      BadRequestError,
    );
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('retries exactly once on 5xx and surfaces success on the second attempt', async () => {
    const fetchImpl = sequenceFetch(
      jsonResponse(503, { error: { message: 'unavailable' } }),
      jsonResponse(200, okBody('recovered')),
    );
    const out = await callVisionLLM({ ...baseInput, fetchImpl });
    expect(out).toBe('recovered');
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it('after a 5xx retry that also fails, throws UnknownLlmError', async () => {
    const fetchImpl = sequenceFetch(
      jsonResponse(502, { error: { message: 'bad gateway' } }),
      jsonResponse(503, { error: { message: 'still unavailable' } }),
    );
    await expect(callVisionLLM({ ...baseInput, fetchImpl })).rejects.toBeInstanceOf(
      UnknownLlmError,
    );
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it('throws TimeoutError when the request exceeds timeoutMs', async () => {
    const fetchImpl = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      await new Promise((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => {
          reject(new DOMException('The operation was aborted.', 'AbortError'));
        });
      });
      return new Response();
    }) as FetchMock;
    await expect(
      callVisionLLM({ ...baseInput, fetchImpl, timeoutMs: 5 }),
    ).rejects.toBeInstanceOf(TimeoutError);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('scrubs sk-... fragments from error detail in the thrown message', async () => {
    const fetchImpl = sequenceFetch(
      jsonResponse(401, { error: { message: 'bad key sk-ABCDEFGHIJ1234567890ZZZ' } }),
    );
    await expect(callVisionLLM({ ...baseInput, fetchImpl })).rejects.toMatchObject({
      message: expect.not.stringContaining('sk-ABCDEFGHIJ1234567890ZZZ'),
    });
  });

  it('throws UnknownLlmError when 200 body is missing choices[0].message.content', async () => {
    const fetchImpl = sequenceFetch(jsonResponse(200, { choices: [] }));
    await expect(callVisionLLM({ ...baseInput, fetchImpl })).rejects.toBeInstanceOf(
      UnknownLlmError,
    );
  });

  it('joins baseUrl with /chat/completions even when baseUrl has trailing slashes', async () => {
    let capturedUrl = '';
    const fetchImpl = vi.fn(async (url: string | URL | Request) => {
      capturedUrl = String(url);
      return jsonResponse(200, okBody('ok'));
    }) as FetchMock;
    await callVisionLLM({
      ...baseInput,
      baseUrl: 'https://api.example.com/v1///',
      fetchImpl,
    });
    expect(capturedUrl).toBe('https://api.example.com/v1/chat/completions');
  });

  it('treats a raw base64 string (no data: prefix) as image/png', async () => {
    let capturedBody = '';
    const fetchImpl = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      capturedBody = String(init?.body);
      return jsonResponse(200, okBody('ok'));
    }) as FetchMock;
    await callVisionLLM({ ...baseInput, screenshot_b64: 'AAAA', fetchImpl });
    const body = JSON.parse(capturedBody);
    const parts = body.messages[0].content as Array<{ type: string; image_url?: { url: string } }>;
    const image = parts.find((p) => p.type === 'image_url');
    expect(image?.image_url?.url).toBe('data:image/png;base64,AAAA');
  });
});
