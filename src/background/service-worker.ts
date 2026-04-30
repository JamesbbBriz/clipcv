// MV3 service worker entry. Subsequent stories will register message handlers here.
// Important: do not hold long-lived in-memory state — the SW can be killed at any time.

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

export {};
