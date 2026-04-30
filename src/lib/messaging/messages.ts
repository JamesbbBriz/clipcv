// Typed cross-context message contract (popup / content script / service
// worker). CLAUDE.md §10.3 requires every chrome.runtime.sendMessage payload
// to be a discriminated union, and the service worker to reject any unknown
// `kind`. New message variants land here first; receivers must extend their
// type guard before handling.

export type ClipcvMessage =
  | { kind: 'capture-request'; url: string; pageTitle: string }
  | { kind: 'download-file'; url: string; filename: string };

export type ClipcvErrorReason =
  | 'unknown_kind'
  | 'screenshot_failed'
  | 'no_active_tab'
  | 'download_failed'
  | 'internal';

export type ClipcvResponse =
  | { kind: 'capture-screenshot'; screenshot_b64: string; captured_at: string }
  | { kind: 'download-started'; downloadId: number }
  | { kind: 'error'; reason: ClipcvErrorReason; detail?: string };

export function isClipcvMessage(value: unknown): value is ClipcvMessage {
  if (value === null || typeof value !== 'object') return false;
  const c = value as Record<string, unknown>;
  if (c['kind'] === 'capture-request') {
    return typeof c['url'] === 'string' && typeof c['pageTitle'] === 'string';
  }
  if (c['kind'] === 'download-file') {
    return typeof c['url'] === 'string' && typeof c['filename'] === 'string';
  }
  return false;
}
