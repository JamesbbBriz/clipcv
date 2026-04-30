// MV3 service worker entry. The SW is killed between events — never hold
// long-lived in-memory state. All message handlers must be self-contained.

import { captureAndDownsample } from '@/lib/capture/screenshot';
import {
  isClipcvMessage,
  type ClipcvResponse,
} from '@/lib/messaging/messages';

chrome.runtime.onInstalled.addListener((details) => {
  // Install/update lifecycle. The popup / settings UI surfaces user-facing messages.
  console.debug('[clipcv] onInstalled', details.reason);
});

chrome.runtime.onStartup.addListener(() => {
  // Browser launch — equivalent to the SW "activate" lifecycle event.
  console.debug('[clipcv] onStartup');
});

chrome.runtime.onSuspend.addListener(() => {
  // Runtime suspension — emitted just before the SW is torn down.
  console.debug('[clipcv] onSuspend');
});

chrome.runtime.onMessage.addListener((rawMessage: unknown, sender, sendResponse) => {
  if (!isClipcvMessage(rawMessage)) {
    const response: ClipcvResponse = { kind: 'error', reason: 'unknown_kind' };
    sendResponse(response);
    return false;
  }
  if (rawMessage.kind === 'capture-request') {
    console.debug('[clipcv] capture-request', rawMessage.url);
    void handleCaptureRequest(sender, sendResponse);
    return true;
  }
  if (rawMessage.kind === 'download-file') {
    console.debug('[clipcv] download-file', rawMessage.filename);
    void handleDownloadFile(rawMessage.url, rawMessage.filename, sendResponse);
    return true;
  }
  // Exhaustiveness fallback — unreachable while the type guard mirrors the union.
  const fallback: ClipcvResponse = { kind: 'error', reason: 'unknown_kind' };
  sendResponse(fallback);
  return false;
});

async function handleCaptureRequest(
  sender: chrome.runtime.MessageSender,
  sendResponse: (response: ClipcvResponse) => void,
): Promise<void> {
  try {
    const windowId = sender.tab?.windowId;
    const screenshotB64 = await captureAndDownsample(windowId);
    const response: ClipcvResponse = {
      kind: 'capture-screenshot',
      screenshot_b64: screenshotB64,
      captured_at: new Date().toISOString(),
    };
    sendResponse(response);
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    const response: ClipcvResponse = {
      kind: 'error',
      reason: 'screenshot_failed',
      detail,
    };
    sendResponse(response);
  }
}

async function handleDownloadFile(
  url: string,
  filename: string,
  sendResponse: (response: ClipcvResponse) => void,
): Promise<void> {
  try {
    const downloadId = await chrome.downloads.download({
      url,
      filename,
      saveAs: true,
    });
    sendResponse({ kind: 'download-started', downloadId });
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    sendResponse({ kind: 'error', reason: 'download_failed', detail });
  }
}

export {};
