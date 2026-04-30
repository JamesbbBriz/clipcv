// Provider-specific quirks live here. Every adapter exports the same
// `Adapter` signature so the client (client.ts) is provider-agnostic. The
// three current providers (`openai`, `openrouter`, `custom`) all speak the
// OpenAI-compatible /chat/completions schema; the abstraction exists so
// future stories can add e.g. an Anthropic /v1/messages adapter without
// touching the client.

import type { Provider } from '@/lib/storage/byok-store';

export interface AdapterInput {
  baseUrl: string;
  apiKey: string;
  model: string;
  screenshot_b64: string;
  html: string;
  prompt: string;
  /** When true, request OpenAI-style structured JSON output. */
  responseFormatJson?: boolean;
}

export interface AdapterRequest {
  url: string;
  headers: Record<string, string>;
  body: string;
}

export type Adapter = (input: AdapterInput) => AdapterRequest;

const buildOpenAICompatibleRequest: Adapter = (input) => {
  const userText = input.html
    ? `${input.prompt}\n\nVisible HTML excerpt:\n${input.html}`
    : input.prompt;
  const payload: Record<string, unknown> = {
    model: input.model,
    messages: [
      {
        role: 'user',
        content: [
          { type: 'text', text: userText },
          {
            type: 'image_url',
            image_url: { url: ensureDataUrl(input.screenshot_b64) },
          },
        ],
      },
    ],
  };
  if (input.responseFormatJson) {
    payload.response_format = { type: 'json_object' };
  }
  const body = JSON.stringify(payload);
  return {
    url: joinUrl(input.baseUrl, '/chat/completions'),
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${input.apiKey}`,
    },
    body,
  };
};

export const openaiAdapter: Adapter = buildOpenAICompatibleRequest;
export const openrouterAdapter: Adapter = buildOpenAICompatibleRequest;
export const customAdapter: Adapter = buildOpenAICompatibleRequest;

export const ADAPTERS: Readonly<Record<Provider, Adapter>> = {
  openai: openaiAdapter,
  openrouter: openrouterAdapter,
  custom: customAdapter,
};

function joinUrl(base: string, path: string): string {
  return `${base.replace(/\/+$/, '')}${path}`;
}

function ensureDataUrl(b64: string): string {
  if (b64.startsWith('data:')) return b64;
  return `data:image/png;base64,${b64}`;
}
