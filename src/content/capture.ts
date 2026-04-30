// Content-script-side capture orchestrator. Sends the capture request to the
// service worker, awaits the screenshot, serializes the visible DOM locally,
// composes the cross-context payload, and enforces the 1 MB size cap.

import { serializeVisibleDom } from '@/lib/capture/dom-serialize';
import {
  applyPayloadSizeCap,
  type CapturePayload,
} from '@/lib/capture/payload';
import type {
  ClipcvMessage,
  ClipcvResponse,
} from '@/lib/messaging/messages';

export async function requestCapture(): Promise<CapturePayload> {
  const message: ClipcvMessage = {
    kind: 'capture-request',
    url: window.location.href,
    pageTitle: document.title,
  };
  const response: ClipcvResponse = await chrome.runtime.sendMessage(message);
  if (response.kind !== 'capture-screenshot') {
    const detail = response.kind === 'error' ? response.reason : 'unknown';
    throw new Error(`capture failed: ${detail}`);
  }
  const html = serializeVisibleDom();
  const payload: CapturePayload = {
    screenshot_b64: response.screenshot_b64,
    html,
    page_url: window.location.href,
    page_title: document.title,
    captured_at: response.captured_at,
  };
  return applyPayloadSizeCap(payload);
}
