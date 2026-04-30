// CapturePayload is the cross-context shape returned by the capture
// orchestrator. The screenshot is a `data:image/png;base64,...` URL so it can
// be passed directly to OpenAI-compatible vision endpoints as
// `image_url.url`. The html field is the post-prune body innerHTML.

export interface CapturePayload {
  screenshot_b64: string;
  html: string;
  page_url: string;
  page_title: string;
  captured_at: string;
}

// Cap the round-trip payload at 1 MB. Over the cap we drop the html field
// (the screenshot is the primary signal for vision extraction; html is a
// secondary hint). Going over usually means a heavy SPA with thousands of
// hidden DOM nodes — sending it would inflate LLM token cost without adding
// real signal.
export const MAX_PAYLOAD_BYTES = 1_000_000;

export function utf8ByteSize(value: string): number {
  return new TextEncoder().encode(value).byteLength;
}

export function payloadByteSize(payload: CapturePayload): number {
  return utf8ByteSize(JSON.stringify(payload));
}

export function applyPayloadSizeCap(
  payload: CapturePayload,
  maxBytes: number = MAX_PAYLOAD_BYTES,
): CapturePayload {
  if (payloadByteSize(payload) <= maxBytes) return payload;
  return { ...payload, html: '' };
}
