// MV3 service worker entry. The SW is killed between events — never hold
// long-lived in-memory state. All message handlers must be self-contained.

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

chrome.runtime.onMessage.addListener((rawMessage: unknown, _sender, sendResponse) => {
  if (!isClipcvMessage(rawMessage)) {
    const response: ClipcvResponse = { kind: 'error', reason: 'unknown_kind' };
    sendResponse(response);
    return false;
  }

  // capture-request: full pipeline lands in US-005+. For now ack so the
  // content script can confirm the round-trip works.
  console.debug('[clipcv] capture-request', rawMessage.url);
  const ack: ClipcvResponse = { kind: 'capture-request-ack', receivedAt: new Date().toISOString() };
  sendResponse(ack);
  return false;
});

export {};
