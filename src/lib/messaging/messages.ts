// Typed cross-context message contract (popup / content script / service
// worker). CLAUDE.md §10.3 requires every chrome.runtime.sendMessage payload
// to be a discriminated union, and the service worker to reject any unknown
// `kind`. New message variants land here first; receivers must extend their
// type guard before handling.

export type ClipcvMessage = { kind: 'capture-request'; url: string; pageTitle: string };

export type ClipcvResponse =
  | { kind: 'capture-request-ack'; receivedAt: string }
  | { kind: 'error'; reason: 'unknown_kind' | 'internal'; detail?: string };

export function isClipcvMessage(value: unknown): value is ClipcvMessage {
  if (value === null || typeof value !== 'object') return false;
  const candidate = value as Record<string, unknown>;
  if (candidate['kind'] !== 'capture-request') return false;
  return typeof candidate['url'] === 'string' && typeof candidate['pageTitle'] === 'string';
}
