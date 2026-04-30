import { useEffect, useState } from 'react';
import { isDisclaimerAccepted } from '@/lib/storage/disclaimer-store';
import { requestCapture } from './capture';

const EXTENSION_VERSION = chrome.runtime.getManifest().version;

type SendState = 'idle' | 'sending' | 'sent' | 'error';

export function FloatingButton(): JSX.Element | null {
  const [accepted, setAccepted] = useState<boolean | null>(null);
  const [sendState, setSendState] = useState<SendState>('idle');

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const ok = await isDisclaimerAccepted(EXTENSION_VERSION);
      if (!cancelled) setAccepted(ok);
    })();
    const onChange = (
      changes: Record<string, chrome.storage.StorageChange>,
      area: chrome.storage.AreaName,
    ): void => {
      if (area !== 'local' || !changes['disclaimer_acceptance']) return;
      void (async () => {
        const ok = await isDisclaimerAccepted(EXTENSION_VERSION);
        if (!cancelled) setAccepted(ok);
      })();
    };
    chrome.storage.onChanged.addListener(onChange);
    return () => {
      cancelled = true;
      chrome.storage.onChanged.removeListener(onChange);
    };
  }, []);

  if (accepted !== true) return null;

  async function handleClick(): Promise<void> {
    setSendState('sending');
    try {
      const payload = await requestCapture();
      // Full pipeline (LLM extraction, render, download) lands in US-008..US-011.
      // For US-005 the visible signal of success is the captured payload — log
      // a small summary so the developer can confirm the round-trip works.
      console.debug('[clipcv] captured', {
        page_url: payload.page_url,
        page_title: payload.page_title,
        captured_at: payload.captured_at,
        html_bytes: payload.html.length,
        screenshot_bytes: payload.screenshot_b64.length,
      });
      setSendState('sent');
    } catch (err) {
      console.debug('[clipcv] capture error', err);
      setSendState('error');
    } finally {
      window.setTimeout(() => setSendState('idle'), 1500);
    }
  }

  const label =
    sendState === 'sending'
      ? 'Capturing…'
      : sendState === 'sent'
        ? 'Sent'
        : sendState === 'error'
          ? 'Error'
          : 'Capture this page';

  return (
    <button
      type="button"
      onClick={() => void handleClick()}
      aria-label="Capture this page with clipcv"
      className="fixed right-4 bottom-4 z-[2147483647] inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-900 shadow-lg hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
      disabled={sendState === 'sending'}
    >
      <span aria-hidden="true" className="inline-block h-2 w-2 rounded-full bg-slate-900" />
      {label}
    </button>
  );
}
