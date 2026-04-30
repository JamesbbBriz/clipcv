import { useEffect, useState } from 'react';
import { isDisclaimerAccepted } from '@/lib/storage/disclaimer-store';
import { DisclaimerModal } from './DisclaimerModal';

const EXTENSION_VERSION = chrome.runtime.getManifest().version;

export function Popup(): JSX.Element {
  const [accepted, setAccepted] = useState<boolean | null>(null);

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

  if (accepted === null) {
    return (
      <main className="flex w-72 flex-col gap-3 bg-white p-4 font-sans text-slate-900">
        <p className="text-xs text-slate-500">Loading…</p>
      </main>
    );
  }

  if (!accepted) {
    return <DisclaimerModal version={EXTENSION_VERSION} />;
  }

  return (
    <main className="flex w-72 flex-col gap-3 bg-white p-4 font-sans text-slate-900">
      <header className="flex items-baseline justify-between">
        <h1 className="text-base font-semibold tracking-tight">clipcv</h1>
        <span className="text-xs text-slate-500">v{EXTENSION_VERSION}</span>
      </header>

      <p className="text-xs leading-snug text-slate-600">
        Convert the page you are viewing into a clean PDF or DOCX file using your own Vision LLM API key.
      </p>

      <button
        type="button"
        disabled
        aria-disabled="true"
        title="Use the floating Capture button on the page itself."
        className="cursor-not-allowed rounded-md border border-slate-200 bg-slate-100 px-3 py-2 text-sm font-medium text-slate-400"
      >
        Capture this page
      </button>

      <p className="text-[11px] text-slate-400">
        Set up your API key in Settings before the first capture.
      </p>
    </main>
  );
}
