// MV3 service worker entry. Subsequent stories will register message handlers here.
// Important: do not hold long-lived in-memory state — the SW can be killed at any time.

chrome.runtime.onInstalled.addListener((details) => {
  // Lifecycle events go through console.debug; the popup / settings UI surfaces user-facing messages.
  console.debug('[clipcv] onInstalled', details.reason);
});

chrome.runtime.onStartup.addListener(() => {
  console.debug('[clipcv] onStartup');
});

export {};
